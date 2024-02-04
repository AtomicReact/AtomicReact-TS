import { appendFileSync, cpSync, existsSync, readFileSync, writeFileSync } from "node:fs"
import path, { dirname, join, relative, resolve } from "node:path"

import postcss from "postcss"
import cssnano from "cssnano"
import { minify } from "terser"

import { error, log, success, tab, warn } from "./tools/console_io.js"
import { createDirIfNotExist, mapFilesFromDir } from "./tools/file.js"
import { fileURLToPath } from "url"
import { resolveModuleName } from "./lib.js"
import { createHash, Hash } from "crypto"
import { transpileAtom, transpileStyle, transpileModule } from "./transpile.js"
import { ATOMICREACT_CORE_MIN_JS_FILENAME, ATOMICREACT_GLOBAL } from "./constants.js"

export * from "./lib.js"
export * from "./modules/index.js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const __filename = fileURLToPath(import.meta.url)

export interface IAtomicConfig {
  packageName: string,
  atomicDir: string,
  bundleDir?: string,
  verbose?: boolean,
  minify?: {
    js: boolean,
    css: boolean
  },
  JSfileName?: string,
  CSSfileName?: string
}

export const extensions = [
  /* 0 */ /\.(atom|module)\.css$/,
  /* 1 */ /.*(?<!(\.(atom|module)))(\.css)$/,
  /* 2 */ /\.js$/,
  /* 3 */ /.*(?<!(\.(d)))(\.ts)$/,
  /* 4 */ /\.tsx$/,
  /* 5 */ /\.jsx$/
]

type BeforeBundleCallback = () => Promise<void>

export class Atomic {

  public bundleScriptPath: string
  public bundleStylePath: string

  private todoBeforeBundle: Array<BeforeBundleCallback> = []

  constructor(public config: IAtomicConfig) {

    this.config.atomicDir = path.join(process.cwd(), this.config.atomicDir);
    this.config.bundleDir = path.join(process.cwd(), this.config.bundleDir || join(this.config.atomicDir, "bundled"))

    if (!existsSync(this.config.atomicDir)) {
      warn(`Directory ${this.config.atomicDir} does not exists. Creating for you...`)
      createDirIfNotExist(process.cwd(), this.config.atomicDir)
    }

    if (this.config.verbose === undefined) this.config.verbose = true
    if (this.config.minify === undefined) this.config.minify = { js: true, css: true }
    if (this.config.JSfileName === undefined) this.config.JSfileName = ATOMICREACT_GLOBAL
    if (this.config.CSSfileName === undefined) this.config.CSSfileName = this.config.JSfileName
    //Create folder if not exist
    createDirIfNotExist(process.cwd(), this.config.bundleDir)

    this.bundleScriptPath = join(this.config.bundleDir, `${this.config.JSfileName}.js`)
    this.bundleStylePath = join(this.config.bundleDir, `${this.config.CSSfileName}.css`)
  }

  async bundle(): Promise<{ version: string }> {
    /* Core JS */
    // let exportCoreToClient = {
    //   global: JSON.parse(JSON.stringify(Atomic.global)) as IGlobal, //gambi para clonar objeto
    //   atoms: [] as Array<IAtom>,
    //   ClientVariables: ClientVariables as IClientVariables,
    //   AtomicVariables: AtomicVariables as IAtomicVariables,
    //   hotReload: null
    // };
    // if (Atomic.hotReload != null) {
    //   exportCoreToClient.hotReload = {
    //     port: Atomic.hotReload.port,
    //     addrs: Atomic.hotReload.addrs
    //   };
    // }

    //Turn On HotReload
    /*   if (Atomic.hotReload != null) {
        jsCore += ClientVariables.Atomic + "." + Atomic.enableHotReloadOnClient.name + "();";
      } */
    /*  jsCore += "Atomic.renderPageOnLoad();"; */

    /* Save core */
    /*     let jsCorePath = path.join(Atomic.config.bundleDir, 'atomicreact.core.js');
        writeFileSync(jsCorePath, jsCore); */

    /* Bundle Core */
    cpSync(resolve(__dirname, ATOMICREACT_CORE_MIN_JS_FILENAME), resolve(this.bundleScriptPath))

    /* Bundle User's Package */
    writeFileSync(this.bundleStylePath, "")

    await this.doBeforeBundle()

    log(`─── Bundling package [${this.config.packageName}]`)

    const mappedFiles = mapFilesFromDir(this.config.atomicDir, extensions)

    let version: Hash | string = createHash("md5")

    for (const mappedFile of mappedFiles) {
      const input = readFileSync(mappedFile.filePath, { encoding: "utf-8" })

      version.update(input)
      let aditionalInfoLog = ""

      try {
        switch (mappedFile.extensionIndex) {
          case 0: {
            const { outCSS, outJS, uniqueID } = await this.bundleModuleCSS(input, mappedFile.filePath)
            appendFileSync(this.bundleStylePath, outCSS)
            appendFileSync(this.bundleScriptPath, outJS)
            aditionalInfoLog = `as unique ID #${uniqueID}`
            break
          }

          case 1: {
            const { outCSS } = await this.bundleGlobalCSS(input)
            appendFileSync(this.bundleStylePath, outCSS)
            break
          }

          case 2:
          case 3:
          case 4:
          case 5: {
            const { outJS } = await this.bundleScript(input, mappedFile.filePath)
            appendFileSync(this.bundleScriptPath, outJS)
            break
          }
        }
      } catch (e) {
        error(`${tab}├── [X] ${mappedFile.filePath}`, e)
        return
      }

      if (this.config.verbose) log(`${tab}├── [✔] ${mappedFile.filePath}`, aditionalInfoLog)
    }

    /* Pos Build */
    appendFileSync(this.bundleScriptPath, `${ATOMICREACT_GLOBAL}.load();`)



    //Bundle dependencies
    // let packageJson = JSON.parse(readFileSync(path.join(process.cwd(), "package.json")).toString());
    // let nodeModulesPath = path.join(process.cwd(), "node_modules");
    // try {
    //   if (Atomic.config.debug && packageJson.atomicReact.dependencies.length > 0) { log(ConsoleFlags.info, "Dependencies Loaded"); }
    //   packageJson.atomicReact.dependencies.forEach(((dp) => { //dp = dependencie name
    //     let dpPath = path.join(nodeModulesPath, dp);

    //     let dpConfig = require(path.join(dpPath, "AtomicReact_config.ts"));

    //     let dpBundleJsPath = path.join(dpPath, dpConfig.bundleDir);
    //     let dpBundleCssPath = path.join(dpBundleJsPath, "atomicreact.bundle.css");
    //     dpBundleJsPath = path.join(dpBundleJsPath, "atomicreact.bundle.js");

    //     /* if (existsSync(dpBundleJsPath)) { jsBundle += readFileSync(dpBundleJsPath).toString(); }
    //     if (existsSync(dpBundleCssPath)) { cssBundle += readFileSync(dpBundleCssPath).toString(); } */

    //     if (Atomic.config.debug) { log(ConsoleFlags.info, "\t[+] " + dp); }
    //   }));
    // } catch (e) {/*log(e);*/ };

    // //Save de bundle
    // let jsBundlePath = path.join(Atomic.config.bundleDir, 'atomicreact.bundle.js');
    // writeFileSync(jsBundlePath, jsBundle);


    // writeFileSync(styleBundlePath, cssBundle);
    version = version.digest("hex").slice(0, 7)

    success(`${tab}└── Bundled ${mappedFiles.length} files. Version: #${version}`)

    return { version }
  }

  async bundleModuleCSS(input: string, filePath: string): Promise<{ outJS: string, outCSS: string, uniqueID: string }> {
    const uniqueID = `a${createHash("md5")
      .update(filePath)
      /* .update(input) */.digest("hex").slice(0, 7)}`

    const parsed = postcss.parse(input)

    const selectors = []
    const tokens = {}
    parsed.each(node => {
      selectors.push(node['selector'])
      /* ++ ID to selector */
      node['selector'] = `${(node['selector'] as string)[0]}${uniqueID}_${(node['selector'] as string).slice(1)}`
    })

    const result = parsed.toResult()

    if (this.config.minify.css) {
      result.css = (await (postcss([cssnano({ preset: "default" })])).process(result.css, { from: undefined })).css
    }

    /* Get all tokens */
    selectors.forEach((s: string) => {
      s.split(/[\s|\.|#]+/).forEach(t => {
        if (t[0] === "[" || t === "*" || t.indexOf(":") > -1 || t === "") return
        tokens[t] = t
      })
    })
    const moduleName = resolveModuleName(relative(this.config.atomicDir, filePath))

    return {
      outCSS: result.css,
      outJS: transpileStyle(this.config.packageName, moduleName, uniqueID, tokens),
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

  async bundleScript(input: string, filePath: string): Promise<{ outJS: string, moduleName: string }> {
    const moduleName = resolveModuleName(relative(this.config.atomicDir, filePath))
    const transpiled = transpileAtom(this.config.packageName, moduleName, input)
    const outJS = (this.config.minify.js) ? (await minify(transpiled, { toplevel: true, compress: true, keep_classnames: true, keep_fnames: false })).code : transpiled

    return {
      outJS,
      moduleName
    }
  }

  async bundleModule(input: string, filePath: string, rootPath: string, moduleName: string): Promise<{ outJS: string, moduleName: string }> {
    moduleName = `${moduleName}/${resolveModuleName(relative(rootPath, filePath))}`
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
        appendFileSync(this.bundleScriptPath, outJS)
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

}