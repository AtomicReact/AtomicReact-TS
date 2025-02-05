export interface IClientVariables {
    Id: "a-i",
    Nucleus: "a-n",
    Sub: "a-s",
    SubOf: "a-sof"
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

export interface IAtomicElement extends HTMLElement {
    Atomic: {
        atom: Atom
    }
}

export type IAtomicOnLoad = (packageName: string) => void
export class AtomicReact {

    static onLoads: Array<IAtomicOnLoad> = []

    static set onLoad(callback: IAtomicOnLoad) {
        AtomicReact.onLoads.push(callback)
    }
    static load(packageName: string) {
        for (let i = 0; i < AtomicReact.onLoads.length; i++) { try { AtomicReact.onLoads[i](packageName) } catch (e) { } }
    }

    static ClientVariables: IClientVariables = {
        Id: "a-i",
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

    static global: {
        atoms: object,
        modules: {
            [moduleName: string]: {
                lib: {
                    __config: any
                }
            }
        }
    }

    static env: Record<string, string | object> = {}
    static setEnv(_env: string | Record<string, string | object>) {
        if (typeof _env === "string") this.env = JSON.parse(_env)
        else this.env = _env
    }

    static makeID(length = 6) {
        let id = ''
        for (let i = 0; i < length; i++) {
            id += String.fromCharCode(65 + Math.floor(Math.random() * 25)) /* From A-Z */
        }
        if (AtomicReact.getElement(id)) return AtomicReact.makeID(length)
        return id
    }

    static render(atom: Atom, attrs: { [key: string]: string } = { [AtomicReact.ClientVariables.Id]: atom.id }) {
        if (atom.preRender) {
            try { atom.preRender() } catch (e) { console.error(e) }
        }

        if (!atom.struct) return ""

        const beforeAtom = Object.assign({}, JSX["jsx-runtime"].atom)
        JSX["jsx-runtime"].atom = {
            atom: atom
        }

        let rendered = atom.struct()

        let attributes = ""
        Object.getOwnPropertyNames(attrs).forEach((attrName) => {
            attributes += " " + `${attrName}="${attrs[attrName]}"`
        })

        const tag = rendered.trim()
        if (tag.startsWith("<") && tag.endsWith(">")) {
            const posToSplit = (tag.charAt(tag.length - 2) == "/") ? tag.length - 2 : tag.indexOf(">")
            // rendered = `${tag.slice(0, posToSplit)} ${AtomicReact.ClientVariables.Id}="${atom.id}"${tag.slice(posToSplit, tag.length)}`
            rendered = `${tag.slice(0, posToSplit)}${attributes}${tag.slice(posToSplit, tag.length)}`
        }

        JSX["jsx-runtime"].atom = Object.assign({}, beforeAtom)
        return rendered
    }

    static renderElement(atom: Atom, domElement: HTMLElement, insertPosition?: InsertPosition | "replace", attrs?: { [key: string]: string }): IAtomicElement {

        if (!insertPosition) {
            domElement.innerHTML = AtomicReact.render(atom, attrs)
        } else {
            if (insertPosition === "replace") {
                if (!domElement.parentNode) throw new Error(`Can't replace element. Element don't have parent node`)
                domElement.innerHTML = ""
                const parentElement = document.createElement("div")
                parentElement.innerHTML = AtomicReact.render(atom, attrs)
                domElement.parentElement.replaceChild(parentElement.firstChild, domElement)
            } else {
                domElement.insertAdjacentHTML(insertPosition as InsertPosition, AtomicReact.render(atom, attrs))
            }
        }

        const rootAtom = document.querySelector(`[${AtomicReact.ClientVariables.Id}="${atom.id}"]`) as IAtomicElement

        /* Define Atomic on root atom */
        rootAtom.Atomic = {
            atom: atom
        }

        function processQueue() {
            if (JSX["jsx-runtime"].queue.length === 0) return

            const firstAtom = JSX["jsx-runtime"].queue[0]

            let atom = document.querySelector(`[${AtomicReact.ClientVariables.Id}="${firstAtom.atom.id}"]`) as IAtomicElement
            if (!atom) return

            /* Define Atomic on rendered atoms */
            atom.Atomic = {
                atom: firstAtom.atom
            }

            JSX["jsx-runtime"].queue.shift()

            /* Fire onRender event on rendered atoms */
            if (atom.Atomic.atom.onRender) {
                try {
                    atom.Atomic.atom.onRender()
                } catch (e) {
                    console.error(e)
                }
            }

            processQueue()
        }
        processQueue()

        /* Fire onRender event on root atom */
        if (rootAtom.Atomic.atom.onRender) {
            try {
                rootAtom.Atomic.atom.onRender()
            } catch (e) {
                console.error(e)
            }
        }

        return rootAtom
    }

    static reRender(atom: Atom) {
        const AtomClass = getValueOfPath(AtomicReact.global, atom.__factory.split("/"))[atom.constructor.name]
        
        const newAtom = new AtomClass(atom.prop, atom.id)
        if (atom.__nucleus_children) Object.defineProperty(newAtom, "__nucleus_children", { value: atom.__nucleus_children })

        let attrs = {}

        Object.values(AtomicReact.ClientVariables).forEach((attrName) => {
            const attrValue = atom.getElement().attributes.getNamedItem(attrName)
            if (attrValue) { attrs[attrName] = attrValue.value }
        })

        AtomicReact.renderElement(newAtom, atom.getElement(), "replace", attrs)

        if (atom.__nucleus_children) newAtom.nucleus.innerHTML = newAtom.__nucleus_children
    }


    static getSub(atom: Atom, subName: string | number): HTMLElement {
        return document.querySelector(`[${AtomicReact.ClientVariables.SubOf}="${atom.id}"][${AtomicReact.ClientVariables.Sub}="${subName}"]`)
    }
    static getAtomicSub(atom: Atom, subName: string | number): Atom {
        return AtomicReact.getAtom(AtomicReact.getSub(atom, subName) as IAtomicElement)
    }
    static getNucleus(atom: Atom): HTMLElement {
        return document.querySelector(`[${AtomicReact.ClientVariables.Nucleus}="${atom.id}"]`)
    }
    static getElement(atomId: string): IAtomicElement {
        return document.querySelector(`[${AtomicReact.ClientVariables.Id}="${atomId}"]`) as IAtomicElement
    }
    static getAtom(element: IAtomicElement) {
        if (!element || !(element.Atomic) || !(element.Atomic.atom)) {
            return null
        }
        return element.Atomic.atom
    }
    static add(atom: Atom, atomToInsert: Atom, insertPosition: InsertPosition) {
        insertPosition = insertPosition || "beforeend"

        AtomicReact.renderElement(atomToInsert, atom.nucleus, insertPosition)

        /* Fire onAdded event */
        if (atom.onAdded) {
            atom.onAdded(atomToInsert)
        }
    }
}
export interface IAtomProps extends IProps {
    sub?: any,
    nucleus?: boolean
}
export interface IAtom {
    prop?: IAtomProps,
    sub?: any
}

export class Atom<GAtom extends IAtom = IAtom> {

    declare __factory: string
    declare __nucleus_children?: string

    public struct: () => string = null

    /* Event fired before this Atom is rendered. */
    public preRender: () => void

    public sub: GAtom["sub"]

    constructor(public prop?: GAtom["prop"] & IAtom["prop"], public id?: string) {
        if (!this.prop) this.prop = {}
        if (!this.id) this.id = AtomicReact.makeID()
        if (this.prop["children"]) delete this.prop["children"]

        this.sub = new Proxy({}, {
            get: (obj, attrName: string) => {
                return AtomicReact.getAtomicSub(this, attrName) || AtomicReact.getSub(this, attrName) || attrName
            }
        })

    }

    public getElement(): IAtomicElement {
        return AtomicReact.getElement(this.id)
    }

    add(atom: Atom, insertPosition?: InsertPosition) {
        AtomicReact.add(this, atom, insertPosition)
    }

    get nucleus(): HTMLElement {
        return AtomicReact.getNucleus(this)
    }

    reRender() {
        return AtomicReact.reRender(this)
    }

    /* Event fired when this Atom is rendered. */
    onRender() { }
    /* Event fired when another Atom is added inside this Atom */
    onAdded(atom: Atom) { }
}

export const JSX = {
    ["jsx-runtime"]: {
        atom: null as IAtomicElement["Atomic"],
        queue: [] as (Array<{ atom: Atom }>),
        jsxs(source: string | Function, props: IProps) {

            props = props || {}

            let atom: IAtomicElement["Atomic"] = null
            if (typeof source == "function") {
                atom = {
                    atom: null
                }

                if (Object.getPrototypeOf(source)["name"] && Object.getPrototypeOf(source)["name"] === Atom.name) {
                    let instance = new (source as typeof Atom)(Object.assign({}, props))

                    atom.atom = instance
                    if (instance.preRender) {
                        try { instance.preRender() } catch (e) { console.error(e) }
                    }
                    source = instance.struct ? instance.struct : () => ("")
                }

                let beforeAtom = Object.assign({}, JSX["jsx-runtime"].atom)
                JSX["jsx-runtime"].atom = Object.assign({}, atom)
                try {
                    source = (source as Function).call(this) as string
                } catch (e) {
                    console.error(`[AtomicReact] Error rendering`, { cause: e })
                    return
                }
                JSX["jsx-runtime"].atom = Object.assign({}, beforeAtom)

                if (atom.atom) {
                    JSX["jsx-runtime"].queue.push({
                        atom: atom.atom
                    })
                }

            }

            if (props["children"] === undefined) props["children"] = []
            if (!Array.isArray(props["children"])) props["children"] = [props["children"]]

            let attributes = Object.keys(props)
                .map(key => {
                    if (key === "children") return null
                    if (key === AtomicReact.AtomicVariables.Nucleus) return `${AtomicReact.ClientVariables.Nucleus}="${JSX["jsx-runtime"].atom.atom.id}"`
                    const value = props[key]
                    if (key === AtomicReact.AtomicVariables.Sub) return `${AtomicReact.ClientVariables.SubOf}="${JSX["jsx-runtime"].atom.atom.id}" ${AtomicReact.ClientVariables.Sub}="${value}"`
                    return (atom || value === undefined) ? null : `${key}="${(Array.isArray(value)) ? value.join(" ") : value}"`
                })
                .filter(i => i != null)

            if (atom) {
                attributes.push(...[`${AtomicReact.ClientVariables.Id}="${atom.atom.id}"`])

                /* Nucleus */
                if (props["children"] && props["children"].length > 0) {
                    Object.defineProperty(atom.atom, "__nucleus_children", { value: props["children"].join("") })
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
                const posToSplit = (tag.charAt(tag.length - 2) == "/") ? tag.length - 2 : tag.indexOf(">")
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