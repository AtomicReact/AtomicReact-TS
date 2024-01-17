export interface IClientVariables {
    Id: string,
    Key: string,
    Nucleus: string,
    Sub: string,
    SubOf: string
}

export interface IAtomicVariables {
    Nucleus: string,
    Sub: string
}

export enum EAtomicEvent {
    LOADED = "<ATOMIC.LOADED>"
}
export type IAtomicEvents = {
    [key in (keyof typeof EAtomicEvent)]: EAtomicEvent
}
export interface IProps {
    [propKey: string]: any
}
export interface IAtomic {
    key: string,
    id: string,
}
export interface IAtomicElement extends Element {
    Atomic: IAtomic & {
        main: AtomicClass
    }
}
export interface IAtom {
    key: string,
    struct?: string
    main?: AtomicClass,
    mainClass?: typeof AtomicClass,
}

interface IHotReload {
    addrs: string,
    port: number
}

export class AtomicReact {
    static atoms: Array<IAtom> = []

    static hotReload: IHotReload

    static onLoad: () => void = null

    static ClientVariables: IClientVariables = {
        Id: "a-i",
        Key: "a-k",
        Nucleus: "a-n",
        Sub: "a-s",
        SubOf: "a-sof"
    }

    static AtomicVariables: IAtomicVariables = {
        Nucleus: "nucleus",
        Sub: "sub"
    }

    static AtomicEvents: IAtomicEvents = {
        LOADED: EAtomicEvent.LOADED
    }

    static enableHotReloadOnClient(addrs: string, port: number) {
        if (this["WebSocketClient"] != null && this["WebSocketClient"] != undefined) { return }
        this["WebSocketClient"] = new WebSocket("ws://" + addrs + ":" + port)
        this["WebSocketClient"].onmessage = function (e) {
            console.log(e.data)
            if (e.data == "<atomicreact.hotreload.RELOAD>") {
                location.reload()
            }
        }
    }

    static makeID(length = 8) {
        let result = ''
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
        let counter = 0
        while (counter < length) {
            result += characters.charAt(Math.floor(Math.random() * characters.length))
            counter++
        }
        return result
    }

    static renderElement(atomicClass: AtomicClass, domElement: Element, insertPosition?: InsertPosition): IAtomicElement {

        const renderedAtom = atomicClass.render(atomicClass.props || {}, {
            id: atomicClass.id,
            key: atomicClass["__proto__"]["constructor"]["name"],
        })

        if (!insertPosition) {
            domElement.innerHTML = renderedAtom
        } else {
            domElement.insertAdjacentHTML(insertPosition, renderedAtom)
        }

        const rootAtom = document.querySelector(`[${AtomicReact.ClientVariables.Id}="${atomicClass.id}"]`) as IAtomicElement

        /* Define Atomic on root atom */
        rootAtom.Atomic = {
            id: atomicClass.id,
            key: atomicClass["__proto__"]["constructor"]["name"],
            main: atomicClass
        }

        JSX["jsx-runtime"].queue.reverse().forEach((item) => {
            let atom = document.querySelector(`[${AtomicReact.ClientVariables.Id}="${item.id}"]`) as IAtomicElement
            /* Define Atomic on rendered atoms */
            atom.Atomic = {
                id: item.id,
                key: item.atomicClass["prototype"]["constructor"]["name"],
                main: new (item.atomicClass)(item.props, item.id)
            }
            atom.Atomic.main.id = item.id

            /* Fire onRender event on rendered atoms */
            if (atom.Atomic.main.onRender) atom.Atomic.main.onRender()
        })
        JSX["jsx-runtime"].queue = []

        /* Fire onRender on root atom */
        rootAtom.Atomic.main.onRender()


        return rootAtom
    }


    static getSub(atomElement: IAtomicElement, subName: string | number): Element {
        return (atomElement.querySelector(`[${AtomicReact.ClientVariables.SubOf}="${atomElement.getAttribute(AtomicReact.ClientVariables.Id)}"][${AtomicReact.ClientVariables.Sub}="${subName}"]`))
    }
    static getAtomicSub<T extends AtomicClass>(atomElement: IAtomicElement, subName: string | number): T {
        return (atomElement.querySelector(`[${AtomicReact.ClientVariables.SubOf}="${atomElement.getAttribute(AtomicReact.ClientVariables.Id)}"][${AtomicReact.ClientVariables.Sub}="${subName}"]`) as IAtomicElement).Atomic.main as T
    }
    static getNucleus(atomElement: IAtomicElement) {
        return document.querySelector(`[${AtomicReact.ClientVariables.Nucleus}="${atomElement.getAttribute(AtomicReact.ClientVariables.Id)}"]`)
    }
    static getElement(atomId: string): IAtomicElement {
        return document.querySelector(`[${AtomicReact.ClientVariables.Id}="${atomId}"]`) as IAtomicElement
    }
    static add(atomElement: IAtomicElement, atomicClass: AtomicClass, insertPosition: InsertPosition): IAtomicElement {
        insertPosition = insertPosition || "beforeend"

        const nucleusElement = AtomicReact.getNucleus(atomElement)

        const insertedAtom = AtomicReact.renderElement(atomicClass, nucleusElement, insertPosition)

        //notifyAtom onAdded
        if (atomElement.Atomic.main && atomElement.Atomic.main.onAdded) {
            atomElement.Atomic.main.onAdded(insertedAtom)
        }

        return insertedAtom
    }
}
export class AtomicClass {

    public struct: (props?: any, atom?: IAtomic) => string = null


    constructor(public props?: IProps, public id?: string) {
        if(!this.props) this.props = {}
        if (!this.id) this.id = AtomicReact.makeID()
        if (this.props["children"]) delete this.props["children"]
    }

    render(props?: IProps, atom?: IAtomic): string {
        if (!this.struct) return ""

        const beforeAtom = Object.assign({}, JSX["jsx-runtime"].atom)
        JSX["jsx-runtime"].atom = {
            id: this.id,
            key: this["__proto__"]["constructor"]["name"]
        }

        let rendered = this.struct(props, atom)

        const tag = rendered.trim()
        if (tag.startsWith("<") && tag.endsWith(">")) {
            const posToSplit = (tag.at(tag.length - 2) == "/") ? tag.length - 2 : tag.indexOf(">")
            rendered = `${tag.slice(0, posToSplit)} ${AtomicReact.ClientVariables.Key}="${this["__proto__"]["constructor"]["name"]}" ${AtomicReact.ClientVariables.Id}="${this.id}"${tag.slice(posToSplit, tag.length)}`
        }

        JSX["jsx-runtime"].atom = Object.assign({}, beforeAtom)
        return rendered
    }

    getElement(): IAtomicElement {
        return AtomicReact.getElement(this.id)
    }

    add(atomicClass: AtomicClass, insertPosition?: InsertPosition): IAtomicElement {
        return AtomicReact.add(this.getElement(), atomicClass, insertPosition)
    }

    getNucleus() {
        return AtomicReact.getNucleus(this.getElement())
    }

    getSub(subName: string | number): Element {
        return AtomicReact.getSub(this.getElement(), subName)
    }

    getAtomicSub<T extends AtomicClass>(subName: string | number): T {
        return AtomicReact.getAtomicSub<T>(this.getElement(), subName)
    }

    /* Event fired when this Atom is rendered. */
    onRender() { }
    /* Event fired when another Atom is added inside this Atom */
    onAdded(atomAdded: IAtomicElement) { }
}

export function resolveModuleName(moduleName) {
    return moduleName.replaceAll("\\", "/").replaceAll("../", "").replaceAll("./", "").replaceAll(".tsx", "").replaceAll(".jsx", "").replaceAll(".ts", "").replaceAll(".js", "")
}

export const JSX = {
    ["jsx-runtime"]: {
        atom: null as IAtomic,
        queue: [] as (Array<{ id: string, atomicClass: typeof AtomicClass, props: IProps }>),
        jsxs(source: string | Function, props: IProps) {

            props = props || {}

            let atom: IAtomic = null
            if (typeof source == "function") {
                atom = {
                    key: source.name,
                    id: AtomicReact.makeID()
                }

                if (source["__proto__"]["name"] && source["__proto__"]["name"] === "AtomicClass") {
                    let instance = new (source as typeof AtomicClass)(Object.assign({}, props))
                    instance.id = atom.id
                    JSX["jsx-runtime"].queue.push({
                        id: atom.id,
                        atomicClass: (source as typeof AtomicClass),
                        props
                    })
                    source = instance.struct ? instance.struct : () => ("")
                }

                let beforeAtom = Object.assign({}, JSX["jsx-runtime"].atom)
                JSX["jsx-runtime"].atom = Object.assign({}, atom)
                source = (source as Function).call(this, props, atom) as string
                JSX["jsx-runtime"].atom = Object.assign({}, beforeAtom)
            }

            if(props["children"] === undefined) props["children"] = []
            if (typeof props["children"] == "string") props["children"] = [props["children"]]

            let attributes = Object.keys(props)
                .map(key => {
                    if (key === "children") return null
                    if (key === AtomicReact.AtomicVariables.Nucleus) return `${AtomicReact.ClientVariables.Nucleus}="${JSX["jsx-runtime"].atom.id}"`
                    const value = props[key]
                    if (key === AtomicReact.AtomicVariables.Sub) return `${AtomicReact.ClientVariables.SubOf}="${JSX["jsx-runtime"].atom.id}" ${AtomicReact.ClientVariables.Sub}="${value}"`
                    return (atom) ? null : `${key}="${value}"`
                })
                .filter(i => i != null)

            if (atom) {
                attributes.push(...[`${AtomicReact.ClientVariables.Key}="${atom.key}"`, `${AtomicReact.ClientVariables.Id}="${atom.id}"`])

                /* Nucleus */
                if (props["children"] && props["children"].length > 0) {
                    let regExpNucleusTag = new RegExp('<(.)*' + AtomicReact.ClientVariables.Nucleus + '[^>]*', 'gi')
                    let openEndNucleusTag = -1
                    while (regExpNucleusTag.exec(source)) {
                        openEndNucleusTag = regExpNucleusTag.lastIndex + 1
                    }
                    if (openEndNucleusTag != -1) {
                        source = `${source.slice(0, openEndNucleusTag)}${props["children"].join("")}${source.slice(openEndNucleusTag, source.length)}`
                    }
                }

            }
            const attributesAsString = attributes.join(" ")

            const tag = source.trim()
            if (tag.startsWith("<") && tag.endsWith(">")) {
                const posToSplit = (tag.at(tag.length - 2) == "/") ? tag.length - 2 : tag.indexOf(">")
                source = `${tag.slice(0, posToSplit)} ${attributesAsString}${tag.slice(posToSplit, tag.length)}`
            } else {
                source = `<${source} ${attributesAsString}> ${((props["children"]).join) ? (props["children"]).join("") : (props["children"])}</${source}>`
            }

            return source
        },
        jsx(name: string, props: { [id: string]: any }) {
            return JSX["jsx-runtime"].jsxs(name, props)
        },

    }
}