import { appendFileSync, closeSync, cpSync, createWriteStream, existsSync, openSync, readFileSync, statSync, writeFileSync, writeSync } from "node:fs"
import { dirname, join, parse, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { createHash, Hash } from "node:crypto"

import postcss from "postcss"
import cssnano from "cssnano"
import { minify } from "terser"

import { error, log, success, tab, warn } from "./tools/console_io.js"
import { createDirIfNotExist } from "./tools/file.js"
import { normalizeModuleName } from "./tools/path.js"
import { transpileAtom, transpileStyle, transpileModule, FileType, listImportTree, getTSConfig, resolveLibrary } from "./transpile.js"
import { ATOMICREACT_CORE_MIN_JS_FILENAME, ATOMICREACT_GLOBAL, LoaderMethods } from "./constants.js"

export * from "./lib.js"
export * from "./modules/index.js"
export * from "./transpile.js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const __filename = fileURLToPath(import.meta.url)

export type IAtomicEnv = Record<string, string | number | boolean>
export interface IAtomicConfig {
  indexScriptFilePath: string,

  outScriptFilePath?: string,
  outStyleFilePath?: string,

  packageName?: string, /* Custom PackageName */
  verbose?: boolean, /* Verbose Logs */
  minify?: { /* Minifies output */
    js: boolean,
    css: boolean
  },
  includeCore?: boolean /* Include core in output */

  env?: IAtomicEnv
}

export const ENVIROMENT_VARIABLE_PREFIX = "ATOMIC_REACT_APP_"

type BeforeBundleCallback = () => Promise<void>

export class Atomic {

  public indexScriptDirPath: string

  private todoBeforeBundle: Array<BeforeBundleCallback> = []

  constructor(public config: IAtomicConfig) {

    this.config.indexScriptFilePath = resolve(process.cwd(), this.config.indexScriptFilePath || "index.tsx")
    this.indexScriptDirPath = parse(this.config.indexScriptFilePath).dir

    if (!existsSync(this.config.indexScriptFilePath)) {
      warn(`File ${this.config.indexScriptFilePath} does not exists. Creating one for you...`)
      createDirIfNotExist(process.cwd(), this.indexScriptDirPath)
      writeFileSync(this.config.indexScriptFilePath, readFileSync(resolve(__dirname, "../init/index.tsx")))
    }

    this.config.outScriptFilePath = resolve(process.cwd(), this.config.outScriptFilePath || `${ATOMICREACT_GLOBAL}.js`)
    createDirIfNotExist(process.cwd(), parse(this.config.outScriptFilePath).dir)

    this.config.outStyleFilePath = resolve(process.cwd(), this.config.outStyleFilePath || `${ATOMICREACT_GLOBAL}.css`)
    createDirIfNotExist(process.cwd(), parse(this.config.outStyleFilePath).dir)


    if (!this.config.packageName) {
      const packageJsonPath = resolve(process.cwd(), "package.json")
      try {
        if (!existsSync(packageJsonPath)) {
          throw new Error("No package.json found")
        }
        const packageJson = JSON.parse(readFileSync(packageJsonPath, { encoding: "utf8" }))
        if (!packageJson.name) throw new Error("No package.json's name found")
        this.config.packageName = packageJson.name
      } catch (e) {
        this.config.packageName = `pkg_${createHash("md5").update(this.config.indexScriptFilePath).digest("hex").slice(0, 7)}`
      }
    }


    if (this.config.verbose === undefined) this.config.verbose = true
    if (this.config.minify === undefined) this.config.minify = { js: true, css: true }
    if (this.config.includeCore === undefined) this.config.includeCore = true
  }

  getModuleName(filePath: string) {
    return normalizeModuleName(relative(this.indexScriptDirPath, filePath))
  }

  resolve(filePath: string) : {packageName: string,moduleName: string } {
    let packageName = this.config.packageName
    let moduleName = this.getModuleName(filePath)
    if (moduleName.indexOf("node_modules") === 0) {
      const library = resolveLibrary(filePath, false)
      packageName = library.packageName
      moduleName = library.moduleName
    }
    return {
      packageName,
      moduleName
    }
  }

  async bundle(): Promise<{ version: string }> {

    /* Bundle Core */

    if (this.config.includeCore) {
      cpSync(resolve(__dirname, ATOMICREACT_CORE_MIN_JS_FILENAME), this.config.outScriptFilePath)
    } else {
      writeFileSync(this.config.outScriptFilePath, "")
    }

    writeFileSync(this.config.outStyleFilePath, "")

    const tsConfig = getTSConfig(process.cwd())
    const baseURL = (tsConfig && tsConfig.compilerOptions && tsConfig.compilerOptions.baseUrl) ? tsConfig.compilerOptions.baseUrl : null
    const filesDescription = listImportTree(this.config.indexScriptFilePath, this.config.packageName, this.getModuleName(this.config.indexScriptFilePath), true, baseURL)

    await this.doBeforeBundle()

    /* Bundle User's Package */

    log(`─── Bundling package [${this.config.packageName}]`)

    /* Pre Bundle */
    appendFileSync(this.config.outScriptFilePath, `${ATOMICREACT_GLOBAL}.${LoaderMethods.BASE_ATOMS}="${this.config.packageName}";`)

    let version: Hash | string = createHash("md5")

    for (const fileDescription of filesDescription) {
      const input = readFileSync(fileDescription.path, { encoding: "utf-8" })

      version.update(input)
      let aditionalInfoLog = ""


      try {
        switch (fileDescription.type) {
          case FileType.StyleModule: {
            const { outCSS, outJS, uniqueID } = await this.bundleModuleCSS(input, fileDescription.fullModuleName, fileDescription.path)

            appendFileSync(this.config.outStyleFilePath, outCSS)
            appendFileSync(this.config.outScriptFilePath, outJS)
            aditionalInfoLog = `as unique ID #${uniqueID}`
            break
          }

          case FileType.NonStyleModule: {
            const { outCSS } = await this.bundleGlobalCSS(input)
            appendFileSync(this.config.outStyleFilePath, outCSS)
            break
          }

          case FileType.ScriptJS:
          case FileType.ScriptTS:
          case FileType.ScriptJSX:
          case FileType.ScriptTSX:
          case FileType.ScriptMJS: {
            const { outJS } = await this.bundleScript(input, fileDescription.fullModuleName)
            appendFileSync(this.config.outScriptFilePath, outJS)
            break
          }
        }
      } catch (e) {
        error(`${tab}├── [X] ${fileDescription.path}`, e)
        return
      }

      if (this.config.verbose) log(`${tab}├── [✔] ${fileDescription.path}`, aditionalInfoLog)
    }

    /* Pos Bundle */
    this.appendLoadScript(this.config.outScriptFilePath)
    this.appendEnviromentVariables(this.config.outScriptFilePath, this.config.env)


    version = version.digest("hex").slice(0, 7)
    success(`${tab}└── Bundled ${filesDescription.length} files. Version: #${version}`)


    return { version }
  }

  async bundleModuleCSS(input: string, fullModuleName: string, filePath: string): Promise<{ outJS: string, outCSS: string, uniqueID: string }> {

    const uniqueID = `a${createHash("md5")
      .update(filePath).digest("hex").slice(0, 7)}`

    const parsed = postcss.parse(input)

    const selectors = []
    const tokens = {}

    function processSelectors(parser: postcss.Root | postcss.AtRule) {
      parser.each((node, i) => {
        if (node.type === 'atrule') return processSelectors(node)
        if (node['selector'] === undefined) return

        selectors.push(node['selector'])
        /* ++ Unique ID to selector */
        let selector = node['selector'] as string

        [".", "#"].forEach((key) => {
          selector = selector.split(key).join(`${key}${uniqueID}_`)
        })

        node['selector'] = selector.trim();
      });
    }
    processSelectors(parsed)

    const result = parsed.toResult()

    if (this.config.minify.css) {
      result.css = (await (postcss([cssnano({ preset: "default" })])).process(result.css, { from: undefined })).css
    }

    /* Get all tokens */
    selectors.forEach((s: string) => {
      let matchedAll = s.matchAll(/[\#|\.][^\s|\.|\#|\,|\>|\+|\~|\:]*/g)
      let token = null
      while (token = matchedAll.next().value) {
        token = token[0].slice(1)
        tokens[token] = token
      }
    })

    return {
      outCSS: result.css,
      outJS: transpileStyle(fullModuleName, uniqueID, tokens),
      uniqueID
    }
  }

  async bundleGlobalCSS(input: string): Promise<{ outCSS: string }> {
    let outCSS = input

    if (this.config.minify.css) {
      outCSS = (await (postcss([cssnano({ preset: "default" })])).process(input, { from: undefined })).css
    }

    return {
      outCSS
    }
  }

  async bundleScript(input: string, fullModuleName: string): Promise<{ outJS: string }> {

    const transpiled = transpileAtom(fullModuleName, input)
    const outJS = (this.config.minify.js) ? (await minify(transpiled, { toplevel: true, compress: true, keep_classnames: true, keep_fnames: false })).code : transpiled

    return {
      outJS
    }
  }

  async bundleModule(input: string, filePath: string, rootPath: string, moduleName: string): Promise<{ outJS: string, moduleName: string }> {
    moduleName = `${moduleName}/${normalizeModuleName(relative(rootPath, filePath))}`
    const transpiled = transpileModule(moduleName, input)
    const outJS = (this.config.minify.js) ? (await minify(transpiled, { toplevel: true, compress: true, keep_classnames: true, keep_fnames: false })).code : transpiled

    return {
      outJS,
      moduleName
    }
  }

  registerModule(moduleName: string, rootModulePath: string, modules: Array<{ relativePath: string, config?: object }>) {
    this.beforeBundle(async () => {
      for (const module of modules) {
        const modulePath = resolve(rootModulePath, module.relativePath)
        let input = readFileSync(modulePath, { encoding: "utf-8" })

        if (module.config !== undefined) {
          input += `\n\rexport const __config = Object.assign((__config) ? __config : {}, ${JSON.stringify(module.config)});`
        }
        const { outJS } = await this.bundleModule(input, modulePath, rootModulePath, moduleName)
        appendFileSync(this.config.outScriptFilePath, outJS)
      }

      if (this.config.verbose) log(`─── [Module/${moduleName}] Registered and bundled`)

    })
  }

  beforeBundle(todoBeforeLoad: BeforeBundleCallback) {
    this.todoBeforeBundle.push(todoBeforeLoad)
  }

  private async doBeforeBundle() {
    for (let f of this.todoBeforeBundle) {
      await f()
    }
  }

  appendLoadScript(outScriptFilePath: string) {
    appendFileSync(outScriptFilePath, `${ATOMICREACT_GLOBAL}.load();`)
  }

  appendEnviromentVariables(outScriptFilePath: string, env?: IAtomicConfig["env"]) {
    if (!env) env = {}

    let envToAppend: IAtomicConfig["env"] = {}

    for (const enviroment of [{ needPrefix: true, env: process.env }, { needPrefix: false, env }]) {

      for (const key of Object.keys(enviroment.env)) {

        if ((enviroment.needPrefix && key.indexOf(ENVIROMENT_VARIABLE_PREFIX) !== 0)) continue
        
        envToAppend[key] = enviroment.env[key]
      }

    }

    appendFileSync(outScriptFilePath, `${ATOMICREACT_GLOBAL}.lib.AtomicReact.setEnv(\`${JSON.stringify(envToAppend)}\`);`)
  }

}