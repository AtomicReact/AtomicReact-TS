import TS, { TranspileOptions } from "typescript"
import { ATOMICREACT_GLOBAL, LoaderMethods } from "./constants.js"
const { ModuleKind, JsxEmit, ScriptTarget, ModuleResolutionKind, transpileModule: transpileModuleTS } = TS

export const getPathForAtom = (packageName: string, moduleName: string) => {
    return `${packageName}/${moduleName}`
}
export const getPathForModule = (moduleName: string) => {
    return `${moduleName}`
}
export const getPathForStyle = (packageName: string, moduleName: string) => {
    return `${packageName}/${moduleName}`
}

export const transpileAtom = (packageName: string, moduleName: string, input: string) => {
    return transpileModuleTS(input, getTranspileOptions(getPathForAtom(packageName, moduleName))).outputText.replace(LoaderMethods.DEFINE, LoaderMethods.DEFINE_ATOM)
}
export const transpileModule = (moduleName: string, input: string) => {
    return transpileModuleTS(input, getTranspileOptions(getPathForModule(moduleName))).outputText.replace(LoaderMethods.DEFINE, LoaderMethods.DEFINE_MODULE)
}
export const transpileStyle = (packageName: string, moduleName: string, uniqueID: string, tokens: { [key: string]: string }) => {
    return `${LoaderMethods.DEFINE_STYLE}("${getPathForStyle(packageName, moduleName)}","${uniqueID}",${JSON.stringify(Object.getOwnPropertyNames(tokens))});`
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