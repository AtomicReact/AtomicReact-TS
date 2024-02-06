export interface IClientVariables {
    Id: string,
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

export interface IAtomicElement extends HTMLElement {
    Atomic: {
        atom: Atom
    }
}
interface IHotReload {
    addrs: string,
    port: number
}

export class AtomicReact {
    static hotReload: IHotReload

    static onLoads: Array<() => void> = []

    static set onLoad(callback: () => void) {
        AtomicReact.onLoads.push(callback)
    }
    static load() {
        for (let i = 0; i < AtomicReact.onLoads.length; i++) { try { AtomicReact.onLoads[i]() } catch (e) { } }
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

    static global: object /* @TODO: to type global atomicreact: {atoms, modules, ...}  */

    static makeID(length = 6) {
        let id = ''
        for (let i = 0; i < length; i++) {
            id += String.fromCharCode(65 + Math.floor(Math.random() * 25)) /* From A-Z */
        }
        if (AtomicReact.getElement(id)) return AtomicReact.makeID(length)
        return id
    }

    static render(atom: Atom) {
        if (!atom.struct) return ""

        const beforeAtom = Object.assign({}, JSX["jsx-runtime"].atom)
        JSX["jsx-runtime"].atom = {
            atom: atom
        }

        let rendered = atom.struct()

        const tag = rendered.trim()
        if (tag.startsWith("<") && tag.endsWith(">")) {
            const posToSplit = (tag.charAt(tag.length - 2) == "/") ? tag.length - 2 : tag.indexOf(">")
            rendered = `${tag.slice(0, posToSplit)} ${AtomicReact.ClientVariables.Id}="${atom.id}"${tag.slice(posToSplit, tag.length)}`
        }

        JSX["jsx-runtime"].atom = Object.assign({}, beforeAtom)
        return rendered
    }

    static renderElement(atom: Atom, domElement: HTMLElement, insertPosition?: InsertPosition | "replace"): IAtomicElement {

        const renderedAtom = AtomicReact.render(atom)

        if (!insertPosition) {
            domElement.innerHTML = renderedAtom
        } else {
            if (insertPosition !== "replace") {
                domElement.insertAdjacentHTML(insertPosition as InsertPosition, renderedAtom)
            } else {
                domElement.outerHTML = renderedAtom
            }
        }

        const rootAtom = document.querySelector(`[${AtomicReact.ClientVariables.Id}="${atom.id}"]`) as IAtomicElement

        /* Define Atomic on root atom */
        rootAtom.Atomic = {
            atom: atom
        }

        JSX["jsx-runtime"].queue.reverse().forEach((item) => {
            let atom = document.querySelector(`[${AtomicReact.ClientVariables.Id}="${item.atom.id}"]`) as IAtomicElement
            /* Define Atomic on rendered atoms */
            atom.Atomic = {
                atom: item.atom
            }

            /* Fire onRender event on rendered atoms */
            if (atom.Atomic.atom.onRender) atom.Atomic.atom.onRender()
        })
        JSX["jsx-runtime"].queue = []

        /* Fire onRender event on root atom */
        rootAtom.Atomic.atom.onRender()

        return rootAtom
    }


    static getSub(atom: Atom, subName: string | number): HTMLElement {
        return document.querySelector(`[${AtomicReact.ClientVariables.SubOf}="${atom.id}"][${AtomicReact.ClientVariables.Sub}="${subName}"]`)
    }
    static getAtomicSub(atom: Atom, subName: string | number): Atom {
        const el = AtomicReact.getSub(atom, subName) as IAtomicElement
        if (!el || !(el.Atomic) || !(el.Atomic.atom)) {
            return null
        }
        return el.Atomic.atom
    }
    static getNucleus(atom: Atom): HTMLElement {
        return document.querySelector(`[${AtomicReact.ClientVariables.Nucleus}="${atom.id}"]`)
    }
    static getElement(atomId: string): IAtomicElement {
        return document.querySelector(`[${AtomicReact.ClientVariables.Id}="${atomId}"]`) as IAtomicElement
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
interface IAtomProps extends IProps {
    sub?: any,
    nucleus?: boolean
}
interface IAtom {
    prop?: IAtomProps,
    sub?: any
}

export class Atom<GAtom extends IAtom = IAtom> {

    declare __factory: string
    declare __nucleus_children?: string

    public struct: () => string = null

    public sub: GAtom["sub"]

    constructor(public prop?: GAtom["prop"] | IAtom["prop"], public id?: string) {
        if (!this.prop) this.prop = {}
        if (!this.id) this.id = AtomicReact.makeID()
        if (this.prop["children"]) delete this.prop["children"]

        this.sub = new Proxy({}, {
            get: (obj, attrName: string) => {
                return AtomicReact.getAtomicSub(this, attrName) || AtomicReact.getSub(this, attrName) || attrName
            }
        })
        
        // AtomicReact.global[this.id] = this

        // return new Proxy(this, {
        //     get: (obj, attrName: string) => {
        //         return AtomicReact.global[this.id][attrName]
        //     }
        // })
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

    /* Event fired when this Atom is rendered. */
    onRender() { }
    /* Event fired when another Atom is added inside this Atom */
    onAdded(atom: Atom) { }
}

export function resolveModuleName(moduleName) {
    return moduleName.replaceAll("\\", "/").replaceAll("../", "").replaceAll("./", "").replaceAll(".tsx", "").replaceAll(".jsx", "").replaceAll(".ts", "").replaceAll(".js", "")
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
                    JSX["jsx-runtime"].queue.push({
                        atom: instance
                    })
                    atom.atom = instance
                    source = instance.struct ? instance.struct : () => ("")
                }

                let beforeAtom = Object.assign({}, JSX["jsx-runtime"].atom)
                JSX["jsx-runtime"].atom = Object.assign({}, atom)
                source = (source as Function).call(this) as string
                JSX["jsx-runtime"].atom = Object.assign({}, beforeAtom)
            }

            if (props["children"] === undefined) props["children"] = []
            if (typeof props["children"] == "string") props["children"] = [props["children"]]

            let attributes = Object.keys(props)
                .map(key => {
                    if (key === "children") return null
                    if (key === AtomicReact.AtomicVariables.Nucleus) return `${AtomicReact.ClientVariables.Nucleus}="${JSX["jsx-runtime"].atom.atom.id}"`
                    const value = props[key]
                    if (key === AtomicReact.AtomicVariables.Sub) return `${AtomicReact.ClientVariables.SubOf}="${JSX["jsx-runtime"].atom.atom.id}" ${AtomicReact.ClientVariables.Sub}="${value}"`
                    return (atom) ? null : `${key}="${value}"`
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