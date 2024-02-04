import { AtomicReact } from "../../lib.js"

export interface IClientConfig {
    host?: string,
    port?: number,
    verbose?: boolean,
    other?: string
}

export const __config: IClientConfig = {
    host: "127.0.0.1",
    port: 1337,
    verbose: false
}

export enum CommandType {
    CSS,
    SCRIPT,
    EVAL,
    REFRESH_BUNDLE
}

export type IMessageData = {
    command: {
        type: CommandType,
        data?: string,
    },
    uid?: string
    filePath?: string
}

export class Client {

    static client: WebSocket

    static connect(host: string = __config.host, port: number = __config.port) {
        const wsServerURL = `ws://${host}:${port}`
        if (!this.client || this.client.readyState !== WebSocket.OPEN) {
            this.client = new WebSocket(wsServerURL)
        } else if (this.client.url.indexOf(wsServerURL) === -1) {
            if (__config.verbose) console.log(`[LiveReload] Client will change connection to ${wsServerURL}`)
            this.client.close(4000, `Closed. Connection changed to ${wsServerURL}`)
            return this.connect(host, port)
        } else {
            if (__config.verbose) console.log(`[LiveReload] Client already connected on ${wsServerURL}`)
        }

        this.client.onopen = (e) => {
            if (__config.verbose) console.log(`[LiveReload] Client connected on ${wsServerURL}`)
        }

        this.client.onmessage = (e) => {
            try {
                const data = JSON.parse(e.data) as IMessageData
                console.log("[LiveReload] on message:", data)
                try {
                    switch (data.command.type) {
                        case CommandType.CSS:
                            this.reloadCSS(data.uid, data.command.data)
                            break
                        case CommandType.EVAL:
                            eval(data.command.data)
                            break
                        case CommandType.REFRESH_BUNDLE:
                            this.refreshBundle(data.command.data)
                            break
                        default:
                            break
                    }
                } catch (e) {
                    console.log("error live reload", e)
                }
            } catch (e) {

            }

            // if (e.data == "<atomicreact.hotreload.RELOAD>") {

            /* getValueOfPath(this[ATOMIC_REACT][ATOMS], ($0.Atomic.atom.__proto__.__factory + "/" + $0.Atomic.atom.constructor.name).split("/")) */
            // location.reload()
            // }
        }
    }

    static reloadCSS(uid: string, css: string) {
        let style = document.querySelector(`style[for="${uid}"]`) as HTMLStyleElement
        if (!style) {
            style = document.createElement("style")
            style.setAttribute("for", uid)
            document.head.appendChild(style)
        }

        style.innerHTML = css
    }

    static refreshBundle(version: string) {
        function addRandomParam(url: string) {
            const _url = (new URL(url))
            _url.searchParams.append("atomic_react", version)
            return _url.toString()
        }
        /* Reload Links */
        document.head.querySelectorAll("link").forEach(linkElement => {
            linkElement.href = addRandomParam(linkElement.href)
        })
        /* Reload Scripts */
        document.head.querySelectorAll("script").forEach(linkElement => {
            linkElement.src = addRandomParam(linkElement.src)
        })
    }
}

// const _onLoad = AtomicReact.onLoad 
AtomicReact.onLoad = () => {
    Client.connect()
}