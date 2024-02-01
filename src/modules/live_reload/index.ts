import { appendFileSync, readFileSync } from "node:fs"
import EventEmitter from "node:events"
import { IncomingMessage } from "node:http"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { WebSocketServer, WebSocket } from "ws"
import chokidar from "chokidar"

import { log } from "../../tools/console_io.js"
import { Atomic } from "src/atomic.js"
import { ATOMICREACT_GLOBAL, getPathForModule, transpileModule } from "../../compile_settings.js"
import { Client } from "./client.js"

export * from "./client.js"

const __dirname = dirname(fileURLToPath(import.meta.url))

export interface ILiveReloadConfig {
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

export class LiveReload {
  public eventEmitter: EventEmitter
  id: number = 1
  webSocketServer: WebSocketServer
  clients: Array<IClient> = []
  watcher: chokidar.FSWatcher
  watchingPaths: string[] = []

  private clientLib: string

  constructor(public config: ILiveReloadConfig) {
    this.config.port = this.config.port || 1337
    this.config.host = this.config.host || "127.0.0.1"

    this.eventEmitter = new EventEmitter()
    this.clientLib = transpileModule(LiveReload.name, readFileSync(resolve(__dirname, `client.js`), { encoding: "utf-8" }))

    /* WebSocket */
    this.webSocketServer = new WebSocketServer({ port: this.config.port, host: this.config.host })

    this.webSocketServer.on("connection", this.onConnection.bind(this))
    this.webSocketServer.on("listening", async () => {
      if (this.config.verbose) log(`─── [${LiveReload.name}] is listening on ws://${this.config.host}:${this.config.port}`)
      await this.bundle()
      this.addToWatch(this.config.atomic.config.atomicDir)
    })

    /* Watcher */
    this.watcher = chokidar.watch(this.watchingPaths)

    this.watcher.on('change', (async (file, stats) => {
      await this.reload("<atomicreact.hotreload.RELOAD>");
    }))
  }

  onConnection = ((webSocketClient: WebSocket, req: IncomingMessage) => {
    const client: IClient = {
      id: this.id,
      webSocket: webSocketClient,
      ip: req.socket.remoteAddress,
      port: req.socket.remotePort
    }

    webSocketClient.on("close", ((code, reason) => {
      if (this.config.verbose) log(`─── [${LiveReload.name}] Client [${client.id}]@${client.ip}:${client.port} closed [code: ${code}]`, reason.toString());
      this.clients = this.clients.filter(c => (c.id != client.id))
    }))

    this.clients.push(client)

    if (this.config.verbose) log(`─── [${LiveReload.name}] Client [${client.id}]@${client.ip}:${client.port} connected`);

    this.id++
  })

  addToWatch(path: string) {
    if (this.watchingPaths.indexOf(path) !== -1) return

    this.watchingPaths.push(path)
    this.watcher.add(path)
    if (this.config.verbose) log(`─── [${LiveReload.name}] [+] Watching path: ${path}`);

  }

  async reload(message: string) {
    this.eventEmitter.emit('reload', message)
    await this.bundle()

    try {
      this.clients.forEach((client) => {
        if (client.webSocket.readyState != WebSocket.OPEN) return
        client.webSocket.send(message);
      })
    } catch (e) { }
  }

  async bundle() {
    await this.config.atomic.bundle()

    /* Append LiveReload Client */
    appendFileSync(this.config.atomic.bundleScriptPath, this.clientLib)
    appendFileSync(this.config.atomic.bundleScriptPath, `${ATOMICREACT_GLOBAL}.${getPathForModule(LiveReload.name).replaceAll("/", ".")}.${Client.name}.${Client.connect.name}("${this.config.host}", ${this.config.port});`)
  }
}