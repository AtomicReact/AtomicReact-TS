import { appendFileSync, cpSync, existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "fs"
import path, { dirname, join, parse, ParsedPath, relative, resolve } from "path"

import postcss from "postcss"
import cssnano from "cssnano"
import { minify } from "terser"

import { error, log, success, tab, warn } from "./tools/console_io.js"
import { HotReload } from "./modules/hot_reload.js"
import { createDirIfNotExist, mapFilesFromDir, readFilesFromDir } from "./tools/file.js"
import { fileURLToPath } from "url"
import TS from "typescript"
const { transpileModule } = TS;
import { resolveModuleName } from "./lib.js"
import { createHash } from "crypto"
import { ATOMICREACT_CORE_MIN_JS_FILENAME, getTranspileOptions } from "./compile_settings.js"

export * from "./lib.js"

export { HotReload } from "./modules/hot_reload.js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const __filename = fileURLToPath(import.meta.url)

export interface IBundlerConfig {
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


export class Atomic {

  static hotReload: HotReload

  constructor(public config: IBundlerConfig, hotReload?: HotReload) {

    this.config.atomicDir = path.join(process.cwd(), this.config.atomicDir);
    this.config.bundleDir = path.join(process.cwd(), this.config.bundleDir || join(this.config.atomicDir, "bundled"))

    if (!existsSync(this.config.atomicDir)) {
      warn(`Directory ${this.config.atomicDir} does not exists. Creating for you...`)
      createDirIfNotExist(process.cwd(), this.config.atomicDir)
    }

    if (this.config.verbose === undefined) this.config.verbose = true
    if (this.config.minify === undefined) this.config.minify = { js: true, css: true }
    if (this.config.JSfileName === undefined) this.config.JSfileName = "atomicreact"
    if (this.config.CSSfileName === undefined) this.config.CSSfileName = this.config.JSfileName
    //Create folder if not exist
    createDirIfNotExist(process.cwd(), this.config.bundleDir)

    /* HotReload */
    Atomic.hotReload = hotReload || null;
    if (Atomic.hotReload != null) {
      // log("Atomic.HotReload.webSocketsClients.length: "+Atomic.HotReload.webSocketsClients.length);
      Atomic.hotReload.watchingFiles = [] //reseta arquivos que ja estavam sendo watcheds
      //inicial watchs (atomicDir)
      Atomic.hotReload.addToWatch(this.config.atomicDir)
      // Atomic.HotReload.addToWatch(process.cwd());

      Atomic.hotReload.getEventEmitter().on('reload', ((msg) => {
        this.bundle()
      }))
    }
  }

  async bundle() {
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
    const bundlePath = join(this.config.bundleDir, `${this.config.JSfileName}${this.config.minify.js ? '.min' : ''}.js`)
    const styleBundlePath = join(this.config.bundleDir, `${this.config.CSSfileName}${this.config.minify.css ? '.min' : ''}.css`)

    cpSync(resolve(__dirname, ATOMICREACT_CORE_MIN_JS_FILENAME), resolve(bundlePath))

    appendFileSync(bundlePath, `switchPackageName("${this.config.packageName}");`)

    /* Bundle User's Package */
    writeFileSync(styleBundlePath, "")

    log(`─── Bundling package [${this.config.packageName}]`)

    const mappedFiles = mapFilesFromDir(this.config.atomicDir, [
      /* 0 */ /\.(atom|module)\.css$/,
      /* 1 */ /.*(?<!(\.(atom|module)))(\.css)$/,
      /* 2 */ /\.js$/,
      /* 3 */ /.*(?<!(\.(d)))(\.ts)$/,
      /* 4 */ /\.tsx$/,
      /* 5 */ /\.jsx$/
    ])

    for (const mappedFile of mappedFiles) {
      const input = readFileSync(mappedFile.filePath, { encoding: "utf-8" })

      let aditionalInfoLog = ""

      try {
        switch (mappedFile.extensionIndex) {
          case 0: {
            const { outCSS, outJS, uniqueID } = await this.bundleModuleCSS(input, mappedFile.filePath)
            appendFileSync(styleBundlePath, outCSS)
            appendFileSync(bundlePath, outJS)
            aditionalInfoLog = `as unique ID #${uniqueID}`
            break
          }

          case 1: {
            const { outCSS } = await this.bundleGlobalCSS(input)
            appendFileSync(styleBundlePath, outCSS)
            break
          }

          case 2:
          case 3:
          case 4:
          case 5: {
            const { outJS } = await this.bundleScript(input, mappedFile.filePath)
            appendFileSync(bundlePath, outJS)
            break
          }
        }
      } catch (e) {
        error(`${tab}├── [X] ${mappedFile.filePath}`, e)
        return
      }

      if (this.config.verbose) log(`${tab}├── [✔] ${mappedFile.filePath}`, aditionalInfoLog);
    }

    /* Pos Build */
    appendFileSync(bundlePath, `atomicreact.load();`)

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

    success(`${tab}└── Bundled ${mappedFiles.length} files`)
  }

  async bundleModuleCSS(input: string, filePath: string): Promise<{ outJS: string, outCSS: string, uniqueID: string }> {
    const uniqueID = `a${createHash("md5")
      .update(filePath)
      .update(input).digest("hex").slice(0, 7)}`

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
    const relativePath = resolveModuleName(relative(this.config.atomicDir, filePath))

    return {
      outCSS: result.css,
      outJS: `defineCSS("${relativePath}","${uniqueID}",${JSON.stringify(Object.getOwnPropertyNames(tokens))});`,
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

  async bundleScript(input: string, filePath: string): Promise<{ outJS: string }> {
    const relativePath = resolveModuleName(relative(this.config.atomicDir, filePath))
    const transpiled = transpileModule(input, getTranspileOptions(relativePath))
    const outJS = (await minify(transpiled.outputText, { toplevel: true, compress: true, keep_classnames: true, keep_fnames: false })).code

    return {
      outJS
    }
  }

}
