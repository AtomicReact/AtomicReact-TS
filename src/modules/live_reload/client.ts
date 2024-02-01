import { AtomicReact } from "../../lib.js"

export class Client {

    static client: WebSocket

    static connect(host: string = "127.0.0.1", port: number = 1337) {
        if (!this.client || this.client.readyState !== WebSocket.OPEN) {
            this.client = new WebSocket("ws://" + host + ":" + port)
        } else if (this.client.url.indexOf(`ws://${host}:${port}`) === -1) {
            this.client.close(4000, `Closed. Connection changed to ws://${host}:${port}`)
            this.connect(host, port)
        }

        this.client.onmessage = (e) => {
            console.log("[LiveReload] on message:", e.data)
            // if (e.data == "<atomicreact.hotreload.RELOAD>") {

            /* getValueOfPath(this[ATOMIC_REACT][ATOMS], ($0.Atomic.atom.__proto__.__factory + "/" + $0.Atomic.atom.constructor.name).split("/")) */
            // location.reload()
            // }
        }
    }
}

/* const _onLoad = AtomicReact.onLoad 
AtomicReact.onLoad = ()=>{
    Client.connect()
    _onLoad()
} */