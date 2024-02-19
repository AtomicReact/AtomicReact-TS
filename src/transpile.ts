import TS, { ImportDeclaration, TranspileOptions } from "typescript"
import { ATOMICREACT_GLOBAL, LoaderMethods } from "./constants.js"
const { ModuleKind, JsxEmit, ScriptTarget, ModuleResolutionKind, transpileModule: transpileModuleTS, createSourceFile, createSourceMapSource, SyntaxKind } = TS
// import { parseFromString, resolve } from '@import-maps/resolve'
// import { fileURLToPath, pathToFileURL, URL } from "node:url"
// import { parse } from "node:path"
// import * as PackageResolver from "package-exports-resolver-kernel"
import { resolve } from "resolve.exports"
import { existsSync, readFileSync } from "fs"
import { resolve as resolvePath } from "node:path"
import { parse } from "path"
import { normalizeModuleName, sumPath } from "./tools/path.js"

export const getFullModuleName = (packageName: string, moduleName: string) => {
    return `${packageName}/${moduleName}`
}

export const transpileAtom = (fullModuleName: string, input: string) => {
    return transpileModuleTS(input, getTranspileOptions(fullModuleName)).outputText.replace(LoaderMethods.DEFINE, LoaderMethods.DEFINE_ATOM)
}
export const transpileModule = (fullModuleName: string, input: string) => {
    return transpileModuleTS(input, getTranspileOptions(fullModuleName)).outputText.replace(LoaderMethods.DEFINE, LoaderMethods.DEFINE_MODULE)
}
export const transpileStyle = (fullModuleName: string, uniqueID: string, tokens: { [key: string]: string }) => {
    return `${LoaderMethods.DEFINE_STYLE}("${fullModuleName}","${uniqueID}",${JSON.stringify(Object.getOwnPropertyNames(tokens))});`
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

export const FileExtensionsPattern = [
    /* 0 */ /\.(atom|module)\.css$/,
    /* 1 */ /.*(?<!(\.(atom|module)))(\.css)$/,
    /* 2 */ /\.js$/,
    /* 3 */ /.*(?<!(\.(d)))(\.ts)$/,
    /* 4 */ /\.jsx$/,
    /* 5 */ /\.tsx$/
]
export enum FileType {
    StyleModule,
    NonStyleModule,
    ScriptJS,
    ScriptTS,
    ScriptJSX,
    ScriptTSX,
    AnyOther,
}

export const identifyFileType = (filePath: string): FileType => {
    const extensionIndex = FileExtensionsPattern.findIndex((regexp) => (regexp.test(filePath.toLowerCase())))
    if (extensionIndex === -1) return FileType.AnyOther
    return extensionIndex
}
interface FileDescription {
    path: string,
    type: FileType,
    packageName: string,
    moduleName: string,
    fullModuleName: string
}
export const getFileDescription = (filePath: string, packageName: string, moduleName: string, recursive = true): Array<FileDescription> => {

    const fileDependencies: Array<FileDescription> = []

    let fileType = identifyFileType(filePath)

    if (!existsSync(filePath)) {
        switch (fileType) {
            case FileType.ScriptJS:
                fileType = FileType.ScriptTS
                filePath = filePath.replace(FileExtensionsPattern[FileType.ScriptJS], ".ts")
                break
            case FileType.ScriptJSX:
                fileType = FileType.ScriptTSX
                filePath = filePath.replace(FileExtensionsPattern[FileType.ScriptJSX], ".tsx")
                break
        }
    }

    if (recursive && [FileType.ScriptJS, FileType.ScriptJSX, FileType.ScriptTS, FileType.ScriptTSX].includes(fileType)) {
        const sourceFile = createSourceFile(filePath, readFileSync(filePath, { encoding: "utf-8" }), ScriptTarget.ESNext)

        function delintNode(node: TS.Node) {

            if (node.kind === SyntaxKind.ImportDeclaration) {
                const specifier = (node as ImportDeclaration).moduleSpecifier["text"] as string

                if (specifier === "atomicreact-ts") return

                const parsedFilePath = parse(filePath)

                let _path = resolvePath(parsedFilePath.dir, specifier)
                let _packageName = packageName
                let _moduleName = sumPath(parse(moduleName).dir, specifier)
                if (!specifier.startsWith(".")) { /* Is a node module package */
                    const moduleDirPath = resolvePath(process.cwd(), "node_modules", specifier.split("/")[0])
                    const pkgJsonPath = resolvePath(moduleDirPath, "package.json")
                    if (existsSync(pkgJsonPath)) {
                        const pkg = JSON.parse(readFileSync(pkgJsonPath, { encoding: "utf-8" }))
                        _packageName = pkg.name
                        _path = resolvePath(moduleDirPath, resolve(pkg, specifier)[0])
                        _moduleName = normalizeModuleName(specifier.split("/").slice(1).join("/"))
                    }
                }

                fileDependencies.push(...getFileDescription(_path, _packageName, _moduleName))
            }
        }

        TS.forEachChild(sourceFile, delintNode)
    }

    fileDependencies.push({
        path: filePath,
        type: fileType,
        packageName,
        moduleName,
        fullModuleName: getFullModuleName(packageName, moduleName)
    })

    return fileDependencies
}