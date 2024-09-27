import { createHash } from "node:crypto"
import TS, { ExportDeclaration, ImportDeclaration, TranspileOptions } from "typescript"
import { ATOMICREACT_GLOBAL, LoaderMethods } from "./constants.js"
const { ModuleKind, JsxEmit, ScriptTarget, ModuleResolutionKind, transpileModule: transpileModuleTS, createSourceFile, createSourceMapSource, SyntaxKind } = TS
// import { parseFromString, resolve } from '@import-maps/resolve'
// import { fileURLToPath, pathToFileURL, URL } from "node:url"
// import { parse } from "node:path"
// import * as PackageResolver from "package-exports-resolver-kernel"
import { resolve } from "resolve.exports"
import { existsSync, readFileSync } from "fs"
import { relative, resolve as resolvePath } from "node:path"
import { parse } from "path"
import { normalizeModuleName, sumPath } from "./tools/path.js"

export const getFullModuleName = (packageName: string, moduleName: string) => {
    if (moduleName.endsWith("/")) moduleName = moduleName.slice(0, -1)
    return `${packageName}${(moduleName !== "") ? `/${moduleName}` : ``}`
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
            experimentalDecorators: true,
            baseUrl: "./src"
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
    /* 5 */ /\.tsx$/,
    /* 6 */ /\.mjs$/,
]
export enum FileType {
    StyleModule,
    NonStyleModule,
    ScriptJS,
    ScriptTS,
    ScriptJSX,
    ScriptTSX,
    ScriptMJS,
    AnyOther,
}

export const identifyFileType = (filePath: string): FileType => {
    const extensionIndex = FileExtensionsPattern.findIndex((regexp) => (regexp.test(filePath.toLowerCase())))
    if (extensionIndex === -1) return FileType.AnyOther
    return extensionIndex
}

export const normalizeFilePath = (filePath: string): { type: FileType, filePathAsTS: string } => {

    let type = identifyFileType(filePath)
    let filePathAsTS = filePath
    if (!existsSync(filePath)) {
        switch (type) {
            case FileType.ScriptJS:
                type = FileType.ScriptTS
                filePathAsTS = filePath.replace(FileExtensionsPattern[FileType.ScriptJS], ".ts")
                break
            case FileType.ScriptJSX:
                type = FileType.ScriptTSX
                filePathAsTS = filePath.replace(FileExtensionsPattern[FileType.ScriptJSX], ".tsx")
                break
        }
    }

    return {
        type,
        filePathAsTS
    }
}

interface IFileDescription {
    hashFilePath: string
    path: string,
    type: FileType,
    packageName: string,
    moduleName: string,
    fullModuleName: string,
    usesCount: number,
    imports: Array<string> /* array of filePathHash */
}

interface IMapImportTree {
    [filePathHash: string]: IFileDescription
}

export const mapImportTree = (filePath: string, packageName: string, moduleName: string, recursive = true, mapAccumulator: IMapImportTree = {}, baseURL?: TSConfig["compilerOptions"]["baseUrl"], parentFilePathHash?: string, packageDirPath: string = process.cwd()): IMapImportTree => {

    const { type: fileType, filePathAsTS } = normalizeFilePath(filePath)

    const filePathHash = createHash("md5").update(filePathAsTS).digest("hex")
    if (mapAccumulator[filePathHash]) {
        /* Redefine File Description to put it on last in map */
        function redefineHashPath(hashToRedefine: string) {
            const _mapAccumulator = { ...mapAccumulator[hashToRedefine] }
            delete mapAccumulator[hashToRedefine]
            mapAccumulator[hashToRedefine] = { ..._mapAccumulator }

            for (const importFilePathHash of mapAccumulator[hashToRedefine].imports) {
                redefineHashPath(importFilePathHash)
            }
        }
        redefineHashPath(filePathHash)

        mapAccumulator[filePathHash].usesCount++
        return mapAccumulator
    }

    mapAccumulator[filePathHash] = {
        hashFilePath: filePathHash,
        path: filePathAsTS,
        type: fileType,
        packageName,
        moduleName,
        fullModuleName: getFullModuleName(packageName, moduleName),
        usesCount: 1,
        imports: []
    }

    if (parentFilePathHash) {
        mapAccumulator[parentFilePathHash].imports.push(filePathHash)
    } else {
        parentFilePathHash = filePathHash
    }

    if (recursive && [FileType.ScriptJS, FileType.ScriptJSX, FileType.ScriptTS, FileType.ScriptTSX, FileType.ScriptMJS].includes(fileType)) {
        const sourceFile = createSourceFile(filePathAsTS, readFileSync(filePathAsTS, { encoding: "utf-8" }), ScriptTarget.ESNext)

        function delintNode(node: TS.Node) {

            if ([SyntaxKind.ImportDeclaration, SyntaxKind.ExportDeclaration].includes(node.kind)) {
                if (!(node as ImportDeclaration).moduleSpecifier || !(node as ImportDeclaration).moduleSpecifier["text"]) return
                const specifier = (node as ImportDeclaration).moduleSpecifier["text"] as string

                if (specifier === "atomicreact-ts") return

                const parsedFilePath = parse(filePathAsTS)

                let _path = resolvePath(parsedFilePath.dir, specifier)
                let _packageName = packageName
                let _moduleName = sumPath(parse(moduleName).dir, specifier)
                let _baseURL = baseURL
                let _packageDirPath = packageDirPath
                if (!specifier.startsWith(".")) { /* May be node module package OR it's using baseURL */

                    if (baseURL) {
                        _path = normalizeFilePath(resolvePath(packageDirPath, baseURL, specifier)).filePathAsTS
                        _moduleName = normalizeModuleName(specifier)
                    }

                    if (!baseURL || (baseURL && !existsSync(_path))) { /* It's is a node module package */
                        const library = resolveLibrary(specifier)
                        _packageName = library.packageName
                        _path = library.path
                        _moduleName = library.moduleName
                        _baseURL = library.baseURL
                        _packageDirPath = library.dirPath
                    }


                }
                mapAccumulator = mapImportTree(_path, _packageName, _moduleName, recursive, mapAccumulator, _baseURL, filePathHash, _packageDirPath)
            }
        }

        TS.forEachChild(sourceFile, delintNode)
    }

    mapAccumulator[filePathHash].packageName = packageName
    mapAccumulator[filePathHash].moduleName = moduleName
    mapAccumulator[filePathHash].fullModuleName = getFullModuleName(packageName, moduleName)

    return mapAccumulator
}


export const listImportTree = (filePath: string, packageName: string, moduleName: string, recursive = true, baseURL?: TSConfig["compilerOptions"]["baseUrl"]): Array<IFileDescription> => {
    return Object.values(mapImportTree(filePath, packageName, moduleName, recursive, {}, baseURL)).reverse()
}

export const resolveLibrary = (importPath: string, isPathSpecifier = true): { packageName: string, path: string, moduleName: string, package: any, dirPath: string, baseURL: string } => {
    const nodeModuleDirPath = resolvePath(process.cwd(), "node_modules")
    if (!isPathSpecifier) importPath = relative(nodeModuleDirPath, importPath)
    const importPathParts = importPath.replaceAll("\\", "/").split("/")
    let moduleDirPath = nodeModuleDirPath
    for (let i = 0; i < importPathParts.length; i++) {
        moduleDirPath = resolvePath(moduleDirPath, importPathParts[i])
        const pkgJsonPath = resolvePath(moduleDirPath, "package.json")
        if (!existsSync(pkgJsonPath)) {
            continue
        } else {
            const pkg = JSON.parse(readFileSync(pkgJsonPath, { encoding: "utf-8" }))
            const packageName = pkg.name
            let path = (pkg.exports) ? resolvePath(moduleDirPath, resolve(pkg, importPath)[0]) : resolvePath(nodeModuleDirPath, importPath, pkg.module)
            let moduleName = normalizeModuleName(importPathParts.slice(i + 1).join("/"))
            if (!isPathSpecifier) {
                path = resolvePath(nodeModuleDirPath, importPath) //c:/guihgo/node_modules/@pack/packn/src/inputs.tsx
                moduleName = normalizeModuleName(relative(`${packageName}/${resolve(pkg, "/")[0]}`, importPath))
            }

            return {
                package: pkg,
                packageName: packageName,
                path,
                moduleName,
                dirPath: moduleDirPath,
                baseURL: getBaseURL(moduleDirPath)
            }
        }
    }
}

export const getBaseURL = (packageDirPath = process.cwd()) => {
    const tsConfig = getTSConfig(packageDirPath)
    const baseURL = (tsConfig && tsConfig.compilerOptions && tsConfig.compilerOptions.baseUrl) ? tsConfig.compilerOptions.baseUrl : null
    return baseURL
}

type CompilerOptions = typeof TS.parseCommandLine extends (...args: any[]) => infer TResult ?
    TResult extends { options: infer TOptions } ? TOptions : never : never;

type TypeAcquisition = typeof TS.parseCommandLine extends (...args: any[]) => infer TResult ?
    TResult extends { typeAcquisition?: infer TTypeAcquisition } ? TTypeAcquisition : never : never;

interface TSConfig {
    compilerOptions: CompilerOptions;
    exclude: string[];
    compileOnSave: boolean;
    extends: string;
    files: string[];
    include: string[];
    typeAcquisition: TypeAcquisition
}


export const getTSConfig = (rootDir: string): TSConfig | null => {
    const tsConfigPath = resolvePath(rootDir, "tsconfig.json")

    if (!existsSync(tsConfigPath)) return null

    try {
        const { config, error } = TS.readConfigFile(tsConfigPath, TS.sys.readFile)
        if (error) throw error
        // const tsConfig = JSON.parse(readFileSync(tsConfigPath, { encoding: "utf-8" })) as TSConfig

        return config
    } catch (e) {
        console.error(e)
        return null
    }
}