import { readFileSync } from "node:fs"
import EventEmitter from "node:events"
import { IncomingMessage } from "node:http"
import { dirname } from "node:path"
import { fileURLToPath } from "node:url"

import { WebSocketServer, WebSocket } from "ws"
import chokidar from "chokidar"

import { error, log, tab } from "../../tools/console_io.js"
import { Atomic } from "../../atomic.js"
import { IClientConfig, IMessageData, CommandType } from "./lib.js"
import { createHash } from "node:crypto"
import { LoaderMethods } from "../../constants.js"
import { FileExtensionsPattern, FileType, getFileDescription } from "../../transpile.js"

export * from "./lib.js"

const __dirname = dirname(fileURLToPath(import.meta.url))

export interface IHotReloadConfig {
  atomic: Atomic
  port?: number,
  host?: string,
  verbose?: boolean
}

interface IClient {
  id: number,
  webSocket: WebSocket,
  ip: string,
  port: number
}

export class HotReload {
  public eventEmitter: EventEmitter
  id: number = 1
  webSocketServer: WebSocketServer
  clients: Array<IClient> = []
  watcher: chokidar.FSWatcher
  watchingPaths: string[] = []

  constructor(public config: IHotReloadConfig) {
    this.config.port = this.config.port || 1337
    this.config.host = this.config.host || "127.0.0.1"

    this.eventEmitter = new EventEmitter()

    /* WebSocket */
    this.webSocketServer = new WebSocketServer({ port: this.config.port, host: this.config.host })

    this.webSocketServer.on("connection", this.onConnection.bind(this))
    this.webSocketServer.on("listening", async () => {
      if (this.config.verbose) log(`─── [${HotReload.name}] is listening on ws://${this.config.host}:${this.config.port}`)
      await this.config.atomic.bundle()
      this.addToWatch(this.config.atomic.indexScriptDirPath)
    })

    /* Watcher */
    this.watcher = chokidar.watch(this.watchingPaths)

    this.watcher.on('change', (async (filePath, stats) => {

    const fileDescription = getFileDescription(filePath, this.config.atomic.config.packageName, this.config.atomic.getModuleName(filePath), false)[0]

      try {
        let type: CommandType = null
        let content = undefined
        let moduleName = undefined
        switch (fileDescription.type) {
          case FileType.StyleModule:
            type = CommandType.CSS
            content = (await this.config.atomic.bundleModuleCSS(readFileSync(filePath, { encoding: "utf-8" }), filePath, fileDescription.fullModuleName)).outCSS
            break
          case FileType.NonStyleModule:
            type = CommandType.CSS
            content = (await this.config.atomic.bundleGlobalCSS(readFileSync(filePath, { encoding: "utf-8" }))).outCSS
            break
          case FileType.ScriptJS: case FileType.ScriptTS: case FileType.ScriptJSX: case FileType.ScriptTSX:
            type = CommandType.SCRIPT
            let r = (await this.config.atomic.bundleScript(readFileSync(filePath, { encoding: "utf-8" }), filePath))
            content = r.outJS
            moduleName = `${LoaderMethods.ATOMS}/${fileDescription.fullModuleName}`
            break
          default:
            return
        }

        await this.broadcast({
          uid: createHash("md5").update(filePath).digest("hex").slice(0, 17),
          filePath,
          command: {
            type,
            content,
            moduleName
          }
        })
      } catch (e) {
        error(`${tab}├── [X] ${filePath}`, e)
        return
      }

    }))

    /* Register LiveReload Module */
    this.config.atomic.registerModule(
      HotReload.name, __dirname,
      [
        {
          relativePath: "./lib.js",
          config: { host: this.config.host, port: this.config.port, verbose: this.config.verbose } as IClientConfig
        }
      ]
    )
  }

  onConnection = (async (webSocketClient: WebSocket, req: IncomingMessage) => {
    const client: IClient = {
      id: this.id,
      webSocket: webSocketClient,
      ip: req.socket.remoteAddress,
      port: req.socket.remotePort
    }

    webSocketClient.on("close", ((code, reason) => {
      if (this.config.verbose) log(`─── [${HotReload.name}] Client [${client.id}]@${client.ip}:${client.port} closed [code: ${code}]`, reason.toString());
      this.clients = this.clients.filter(c => (c.id != client.id))
    }))

    this.clients.push(client)

    if (this.config.verbose) log(`─── [${HotReload.name}] Client [${client.id}]@${client.ip}:${client.port} connected`);

    this.id++

    this.config.atomic.bundle().then(({ version }) => {
      this.sendMessage(client, {
        command: {
          type: CommandType.REFRESH_BUNDLE,
          content: version
        }
      })
    })

  })

  addToWatch(path: string) {
    if (this.watchingPaths.indexOf(path) !== -1) return

    this.watchingPaths.push(path)
    this.watcher.add(path)
    if (this.config.verbose) log(`─── [${HotReload.name}] [+] Watching path: ${path}`);

  }

  /* Broadcast message */
  async broadcast(message: IMessageData) {
    this.clients.forEach((client) => {
      this.sendMessage(client, message)
    })
  }
  async sendMessage(client: IClient, message: IMessageData) {
    try {
      if (client.webSocket.readyState != WebSocket.OPEN) return
      client.webSocket.send(JSON.stringify(message));
    } catch (e) { }
  }

}