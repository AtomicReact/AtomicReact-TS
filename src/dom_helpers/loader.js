/*<Loader>*/
/* Define Context Value */
function defCtxVal(paramName, value, ref = this.__proto__, callback, opts = {}) {
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
defCtxVal("ATOMS", "atoms")
defCtxVal("LIB", "lib")
defCtxVal("LOAD", "load")
defCtxVal("PACKAGE_NAME", "PACKAGE_NAME")

defCtxVal(ATOMIC_REACT, {})
defCtxVal(DEFINES, {}, this[ATOMIC_REACT])
defCtxVal(ATOMS, {}, this[ATOMIC_REACT])
defCtxVal(LOAD, () => {
    window.addEventListener(this[ATOMIC_REACT][LIB].AtomicReact.AtomicEvents.LOADED, function (event) {
        window.addEventListener("load", function (event) {
            if (this[ATOMIC_REACT][LIB].AtomicReact.onLoad) { this[ATOMIC_REACT][LIB].AtomicReact.onLoad() }
        });
    });
    if (Object.keys(this[ATOMIC_REACT][DEFINES]).length == 0) {
        window.dispatchEvent(new CustomEvent(this[ATOMIC_REACT].lib.AtomicReact.AtomicEvents.LOADED))
    }
}, this[ATOMIC_REACT])

defCtxVal("switchPackageName", function (newPackageName, onAtoms = true) {

    Object.defineProperty(this[ATOMIC_REACT], PACKAGE_NAME, { value: newPackageName, configurable: true })
    if (onAtoms) Object.defineProperty(this[ATOMIC_REACT][ATOMS], newPackageName, { value: {} })

}, undefined, () => { switchPackageName("default", false) })


defCtxVal("defineCSS", function (moduleName, uniqueID, tokens) {
    define(moduleName, ["require", "exports", ATOMIC_REACT], function (require, exports, atomicreact_1) {

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

defCtxVal("getValueOfPath", function getValueOfPath(context, paths) {
    if (paths.length == 1) {
        return context[paths[0]] || null
    }
    const next = paths[0]
    if (context[next] == undefined) {
        return null
    }
    paths.shift()
    return getValueOfPath(context[next], paths)
})

defCtxVal("resolveModuleName", function (moduleName) {
    return moduleName.replaceAll("../", "").replaceAll("./", "").replaceAll(".tsx", "").replaceAll(".jsx", "").replaceAll(".ts", "").replaceAll(".js", "")
})

defCtxVal("isLocalModule", function (moduleName) {
    return (moduleName.indexOf("./") == 0 && moduleName.indexOf("../") == -1)
})

defCtxVal("sumPath", function (absolutePath, relativePath) {
    let absolute = absolutePath.split("/")
    const backTimes = relativePath.split("../").length - 1
    if (absolute.length <= backTimes) return resolveModuleName(relativePath)
    absolute.splice(absolute.length - backTimes)
    return resolveModuleName(`${absolute.join("/")}${absolutePath == "" ? "" : "/"}${relativePath}`)
})

defCtxVal("require", function (moduleName, contextPath = "") {

    const moduleParts = moduleName.split("/")
    if (ATOMIC_REACT_ALIAS.includes(moduleParts[0])) {
        if (moduleParts.length == 1) return (this[ATOMIC_REACT][LIB] || this[ATOMIC_REACT])
        else return getValueOfPath(this, moduleParts)
    }

    if (moduleName.indexOf("./") >= 0) {

        const path = sumPath(contextPath, moduleName)
        const paths = path.split("/")

        return getValueOfPath(this[ATOMIC_REACT][ATOMS][this[ATOMIC_REACT][PACKAGE_NAME]], paths)
    }

    return (this[ATOMIC_REACT][ATOMS][resolveModuleName(moduleName)] || this[ATOMIC_REACT])
})

defCtxVal("define", function (moduleName, inputs, func) {

    let _exports = { "__esModule": true }

    if (ATOMIC_REACT_ALIAS.includes(moduleName) && !ATOMIC_REACT[moduleName]) {
        func(require, _exports, ...inputs.slice(2).map(i => require(i)))

        defCtxVal("lib", _exports, this[ATOMIC_REACT])
        defCtxVal("AtomicReact", this[ATOMIC_REACT].lib.AtomicReact)
        defCtxVal("JSX", this[ATOMIC_REACT].lib.JSX)
        
        return
    }

    const paths = moduleName.split("/")

    let { context, path, contextPath } = gotoEndOfPath(this[ATOMIC_REACT][ATOMS], this[ATOMIC_REACT][PACKAGE_NAME], paths)

    const imports = [require, _exports, ...inputs.slice(2).map(i => require(i, contextPath))]

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

    try {
        func(...imports)
    } catch (e) {
        importFail = true
    }

    if (importFail) return

    /* Declare this atom */
    Object.defineProperty(context, path, { value: _exports, configurable: true })

    if (this[ATOMIC_REACT][DEFINES][moduleName] != undefined) {
        /* ReDefines atoms that are importing this atom */
        for (let dependent of Object.getOwnPropertyNames(this[ATOMIC_REACT][DEFINES][moduleName])) {
            this[ATOMIC_REACT][DEFINES][moduleName][dependent]()
        }
        /* Remove from defines */
        delete this[ATOMIC_REACT][DEFINES][moduleName]
    }

}, this)
/*</Loader>*/
