/*<Loader>*/
/* Define Context Value */
function defCtxVal(paramName, value, ref = this, callback, opts = {}) {
    if (this[paramName] == undefined) {
        Object.defineProperty(ref, paramName, {
            value,
            ...opts
        })
    }
    if (callback) callback()
}

defCtxVal("ATOMIC_REACT", "atomicreact")
defCtxVal("ATOMIC_REACT_ALIAS", [ATOMIC_REACT, "atomicreact-ts"])
defCtxVal("DEFINES", "defines")
defCtxVal("BASE_ATOMS", "baseAtoms")
defCtxVal("ATOMS", "atoms")
defCtxVal("MODULES", "modules")
defCtxVal("LIB", "lib")
defCtxVal("LOAD", "load")

defCtxVal(ATOMIC_REACT, {})
defCtxVal(DEFINES, {}, this[ATOMIC_REACT])
defCtxVal(BASE_ATOMS, "the_pkg_here", this[ATOMIC_REACT], null, {writable: true})
defCtxVal(ATOMS, {}, this[ATOMIC_REACT])
defCtxVal(LOAD, () => {
    window.addEventListener(this[ATOMIC_REACT][LIB].AtomicReact.AtomicEvents.LOADED, function (e) {
        window.addEventListener("load", function (e) {
            this[ATOMIC_REACT][LIB].AtomicReact.load()
        })
    })
    if (Object.keys(this[ATOMIC_REACT][DEFINES]).length == 0) {
        window.dispatchEvent(new CustomEvent(this[ATOMIC_REACT][LIB].AtomicReact.AtomicEvents.LOADED))
    }
}, this[ATOMIC_REACT])

defCtxVal("gotoEndOfPath", function (context, next, paths, contextPath = "") {
    if (context[next] == undefined) {
        Object.defineProperty(context, next, { value: {}, configurable: true })
    }

    if (paths.length == 1) {
        return { context: context[next], path: paths[0], contextPath }
    }

    context = context[next]
    next = paths[0]
    paths.shift()
    contextPath += `${contextPath == "" ? "" : "/"}${next}`
    return gotoEndOfPath(context, next, paths, contextPath)
})

defCtxVal("getValueOfPath", function getValueOfPath(context, splitedPaths) {
    if (splitedPaths.length == 1) {
        return context[splitedPaths[0]] || null
    }
    const next = splitedPaths[0]
    if (context[next] == undefined) {
        return null
    }
    splitedPaths.shift()
    return getValueOfPath(context[next], splitedPaths)
})

defCtxVal("normalizeModuleName", function (moduleName) {
    return moduleName.replaceAll("../", "").replaceAll("./", "").replaceAll(".tsx", "").replaceAll(".jsx", "").replaceAll(".ts", "").replaceAll(".js", "").replaceAll(".mjs", "")
})

defCtxVal("isLocalModule", function (moduleName) {
    return (moduleName.indexOf("./") == 0 && moduleName.indexOf("../") == -1)
})

defCtxVal("sumPath", function (absolutePath, relativePath) {
    let absolute = absolutePath.split("/")
    const backTimes = relativePath.split("../").length - 1
    if (absolute.length <= backTimes) return normalizeModuleName(relativePath)
    absolute.splice(absolute.length - backTimes)
    return normalizeModuleName(`${absolute.join("/")}${absolutePath == "" ? "" : "/"}${relativePath}`)
})

defCtxVal("require", function (moduleName, contextPath = "") {

    const moduleParts = moduleName.split("/")
    if (ATOMIC_REACT_ALIAS.includes(moduleParts[0])) {
        if (moduleParts.length == 1) return (this[ATOMIC_REACT][LIB] || this[ATOMIC_REACT])
        else return getValueOfPath(this, moduleParts)
    }

    let path = ""
    if (moduleName.startsWith(".")) {
        path = sumPath(contextPath, moduleName)
    } else {
        path = sumPath(ATOMS, `${this[ATOMIC_REACT][BASE_ATOMS]}/${moduleName}`)
        if(!getValueOfPath(this[ATOMIC_REACT], path.split("/"))) path = sumPath(ATOMS, moduleName)
    }

    return new Proxy({ path }, {
        get: (target, prop) => {
            return getValueOfPath(window[ATOMIC_REACT], target.path.split("/"))[prop]
        }
    })
    // return (this[ATOMIC_REACT])
})

defCtxVal("define", function (moduleName, inputs, func) {

    let _exports = { "__esModule": true }

    if (ATOMIC_REACT_ALIAS.includes(moduleName) && !ATOMIC_REACT[moduleName]) {
        func(require, _exports, ...inputs.slice(2).map(i => require(i)))

        defCtxVal("lib", _exports, this[ATOMIC_REACT])
        defCtxVal("AtomicReact", this[ATOMIC_REACT].lib.AtomicReact)
        defCtxVal("global", this[ATOMIC_REACT], AtomicReact)
        defCtxVal("JSX", this[ATOMIC_REACT].lib.JSX)

        return
    }

    const paths = moduleName.split("/")

    const endOfPath = gotoEndOfPath(this, ATOMIC_REACT, paths)
    let context = endOfPath.context
    let path = endOfPath.path
    let contextPath = endOfPath.contextPath

    const imports = [require, _exports, ...inputs.slice(2).map(i => (require(i, contextPath)))]

    let importFail = false
    for (let i = 0; i < imports.length; i++) {
        if (imports[i] !== null) continue

        importFail = true

        /* let's schedule to define this module when the import was defined */
        let moduleNameFuture = sumPath(contextPath, inputs[i])

        if (this[ATOMIC_REACT][DEFINES][moduleNameFuture] == undefined) {
            Object.defineProperty(this[ATOMIC_REACT][DEFINES], moduleNameFuture, { value: {}, configurable: true })
        }

        /* Define dependency */
        Object.defineProperty(this[ATOMIC_REACT][DEFINES][moduleNameFuture], moduleName, {
            value: () => {
                define(moduleName, inputs, func, true)
            }, configurable: true
        })
    }

    if (importFail) return

    try {
        func(...imports)
    } catch (e) {
        return
    }

    /* Declare this atom */
    Object.defineProperty(context, path, { value: _exports, configurable: true })

    /* Save factory path */
    Object.getOwnPropertyNames(_exports).forEach(key => {
        if ([this[ATOMIC_REACT][LIB].Atom.name].includes(Object.getPrototypeOf(_exports[key])["name"])) {
            Object.defineProperty(_exports[key].prototype, "__factory", { value: `${moduleName}`, configurable: true })
        }
    })

    if (this[ATOMIC_REACT][DEFINES][moduleName] != undefined) {
        /* ReDefines atoms that are importing this atom */
        let deps = Object.getOwnPropertyNames(this[ATOMIC_REACT][DEFINES][moduleName])
        for (let i = 0; i < deps.length; i++) {
            let dependent = deps[i]
            this[ATOMIC_REACT][DEFINES][moduleName][dependent]()
        }

        // for (let dependent of Object.getOwnPropertyNames(this[ATOMIC_REACT][DEFINES][moduleName])) {
        //     this[ATOMIC_REACT][DEFINES][moduleName][dependent]()
        // }
        /* Remove from defines */
        delete this[ATOMIC_REACT][DEFINES][moduleName]
    }

}, this)
/* Define Atom */
defCtxVal("dA", function (moduleName, inputs, func) {
    return define(`${ATOMS}/${moduleName}`, inputs, func)
})
/* Define Module */
defCtxVal("dM", function (moduleName, inputs, func) {
    return define(`${MODULES}/${moduleName}`, inputs, func)
})
/* Define Style  Module CSS */
defCtxVal("dS", function (moduleName, uniqueID, tokens) {
    dA(moduleName, ["require", "exports", ATOMIC_REACT], function (require, exports, atomicreact_1) {

        Object.defineProperties(exports, { "__esModule": { value: true }, "default": { value: {} } });
        tokens
            .forEach(token => {
                exports.default[token] = `${uniqueID}_${token}`;
                Object.defineProperty(exports, token, {
                    get: function () {
                        return exports.default[token]
                    }
                })
            })
    })
})
/*</Loader>*/
