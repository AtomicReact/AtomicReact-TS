import { AtomicReact, IAtomicElement } from "../../lib.js"

declare function getValueOfPath(context, paths): Object /* Global function defined in dom_helpers/loader.js */
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
        content?: string,
        moduleName?: string
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
                const msgData = JSON.parse(e.data) as IMessageData
                if (__config.verbose) console.log("[LiveReload] on message:", msgData)

                switch (msgData.command.type) {
                    case CommandType.CSS:
                        this.redefineCSS(msgData.uid, msgData.command.content)
                        break
                    case CommandType.SCRIPT:
                        this.redefineScript(msgData.command.moduleName, msgData.command.content)
                        break
                    case CommandType.EVAL:
                        eval(msgData.command.content)
                        break
                    case CommandType.REFRESH_BUNDLE:
                        this.refreshBundle(msgData.command.content)
                        break
                    default:
                        break
                }

            } catch (e) {
                console.error(`[LiveReload] Client onmessage error`, e)
            }
        }
    }

    static redefineScript(moduleName: string, script: string) {
        eval(script)

        const context = getValueOfPath(AtomicReact.global, moduleName.split("/"))

        document.querySelectorAll<IAtomicElement>(`[a-i]`).forEach((atomEl) => {
            if (!atomEl || !atomEl.Atomic || !atomEl.Atomic.atom || !atomEl.Atomic.atom.getElement() ) return
            const oldAtom = atomEl.Atomic.atom

            const factory = Object.getPrototypeOf(oldAtom).__factory
            if (factory !== moduleName) return

            const atomKey = oldAtom.constructor.name
            if (context[atomKey] === undefined) return

            const newAtom = new context[atomKey](oldAtom.prop, oldAtom.id)

            if (oldAtom.__nucleus_children) Object.defineProperty(newAtom, "__nucleus_children", { value: oldAtom.__nucleus_children })

            let attrs = {}

            Object.values(AtomicReact.ClientVariables).forEach((attrName) => {
                const attrValue = oldAtom.getElement().attributes.getNamedItem(attrName)
                if (attrValue) { attrs[attrName] = attrValue.value }
            })

            AtomicReact.renderElement(newAtom, oldAtom.getElement(), "replace", attrs)

            if (oldAtom.__nucleus_children) newAtom.nucleus.innerHTML = newAtom.__nucleus_children
        })
    }

    static redefineCSS(uid: string, css: string) {
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

AtomicReact.onLoad = () => {
    Client.connect()
}