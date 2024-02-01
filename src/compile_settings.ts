import TS, { TranspileOptions } from "typescript"
const { ModuleKind, JsxEmit, ScriptTarget, ModuleResolutionKind, transpileModule: transpileModuleTS } = TS

export const ATOMICREACT_CORE_MIN_JS_FILENAME = "atomicreact-core.min.js"

export const ATOMICREACT_GLOBAL = "atomicreact"

export enum LoaderMethods {
    DEFINE = "define",
    DEFINE_ATOM = "dA",
    DEFINE_MODULE = "dM",
    DEFINE_STYLE = "dS"
}

export const getPathForAtom = (packageName: string, moduleName: string) => {
    return `${packageName}/${moduleName}`
}
export const transpileAtom = (packageName: string, moduleName: string, input: string) => {
    return transpileModuleTS(input, getTranspileOptions(getPathForAtom(packageName, moduleName))).outputText.replace(LoaderMethods.DEFINE, LoaderMethods.DEFINE_ATOM)
}

export const getPathForModule = (moduleName: string) => {
    return `modules/${moduleName}`
}
export const transpileModule = (moduleName: string, input: string) => {
    return transpileModuleTS(input, getTranspileOptions(getPathForModule(moduleName))).outputText
}

export const getTranspileForStyle = (packageName: string, moduleName: string, uniqueID: string, tokens: { [key: string]: string }) => {
    return `${LoaderMethods.DEFINE_STYLE}("${getPathForAtom(packageName, moduleName)}","${uniqueID}",${JSON.stringify(Object.getOwnPropertyNames(tokens))});`
}

export const getTranspileOptions = (moduleName: string): TranspileOptions => {
    return {
        moduleName: moduleName,
        compilerOptions: {
            jsx: JsxEmit.ReactJSX,
            jsxFactory: "factory",
            jsxFragmentFactory: "fragment",
            jsxImportSource: `${ATOMICREACT_GLOBAL}/lib/JSX`,
            reactNamespace: "JSX",
            isolatedModules: true,
            allowSyntheticDefaultImports: true,
            preserveValueImports: true,
            module: ModuleKind.AMD,
            target: ScriptTarget.ESNext,
            moduleResolution: ModuleResolutionKind.Node10,
            lib: ["es2016", "dom", "es5"],
            strict: true,
            strictNullChecks: true,
            esModuleInterop: false,
            forceConsistentCasingInFileNames: true,
            declaration: false,
            allowJs: true,
            removeComments: true,
            experimentalDecorators: true
            // sourceMap: true
        }
    }
}