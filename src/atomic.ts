import { appendFileSync, readdirSync, readFileSync, statSync, writeFileSync } from "fs"
import path, { dirname, join, parse, ParsedPath, relative, resolve } from "path"

import postcss from "postcss"

import { error, log, success, warn } from "./tools/console_io.js"
import { HotReload } from "./modules/hot_reload.js"
import { createDirIfNotExist } from "./tools/file.js";
import { fileURLToPath } from "url";
import TS, { TranspileOptions, } from "typescript";
const { ModuleKind, JsxEmit, ScriptTarget, ModuleResolutionKind, transpileModule } = TS;
export * from "./lib.js"
import { resolveModuleName } from "./lib.js";
import { createHash } from "crypto";

export { HotReload } from "./modules/hot_reload.js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const __filename = fileURLToPath(import.meta.url)


import style from "./test.module.css"

export interface IConfig {
  atomicDir: string,
  bundleDir: string,
  verbose: boolean,
  packageName: string
}


export class Atomic {

  config: IConfig

  static hotReload: HotReload

  constructor(config: IConfig, hotReload?: HotReload) {

    this.config = (config != null) ? JSON.parse(JSON.stringify(config)) : {
      atomicDir: "",
      bundleDir: "",
      verbose: true,
      packageName: "PACKAGE_NAME_NOT_DEFINED"
    }

    if (!this.config.atomicDir) { error("You must set an atomic directory (atomicDir)"); return; }
    this.config.atomicDir = path.join(process.cwd(), this.config.atomicDir);
    this.config.bundleDir = path.join(process.cwd(), this.config.bundleDir || "");
    this.config.verbose = (this.config.verbose == undefined) ? true : this.config.verbose;

    //Create folder if not exist
    createDirIfNotExist(process.cwd(), this.config.bundleDir);

    /* HotReload */
    Atomic.hotReload = hotReload || null;
    if (Atomic.hotReload != null) {
      // log("Atomic.HotReload.webSocketsClients.length: "+Atomic.HotReload.webSocketsClients.length);
      Atomic.hotReload.watchingFiles = []; //reseta arquivos que ja estavam sendo watcheds
      //inicial watchs (atomicDir)
      Atomic.hotReload.addToWatch(this.config.atomicDir);
      // Atomic.HotReload.addToWatch(process.cwd());

      Atomic.hotReload.getEventEmitter().on('reload', ((msg) => {
        this.bundle();
      }));
    }

    this.init();
  }

  init() {
    this.bundle();
  }

  static readFilesFromDir(dirPath: string, callback: (filePath: string, parsedPath: ParsedPath) => void, extensions = [/(\.html)/]) {
    readdirSync(dirPath).forEach(((file) => {
      let filePath = path.join(dirPath, file);

      let fileStat = statSync(filePath);
      let parsedPath = parse(filePath);

      if (fileStat.isDirectory()) {
        return Atomic.readFilesFromDir(filePath, callback, extensions)
      }

      if (extensions.find((exp) => (exp.test(filePath.toLowerCase())))) {
        return callback(filePath, parsedPath)
      }
    }));
  }

  static getTranspileOptions(moduleName: string): TranspileOptions {
    return {
      moduleName: moduleName,
      compilerOptions: {
        jsx: JsxEmit.ReactJSX,
        jsxFactory: "factory",
        jsxFragmentFactory: "fragment",
        jsxImportSource: "atomicreact/lib/JSX",
        reactNamespace: "JSX",
        isolatedModules: true,
        allowSyntheticDefaultImports: true,
        preserveValueImports: true,
        module: ModuleKind.AMD,
        target: ScriptTarget.ESNext,
        moduleResolution: ModuleResolutionKind.NodeJs,
        lib: ["es2016", "dom", "es5"],
        strict: true,
        strictNullChecks: true,
        esModuleInterop: false,
        forceConsistentCasingInFileNames: true,
        declaration: false,
        allowJs: true,
        removeComments: true,
        // sourceMap: true
      }
    }
  }

  async bundle() {
    // if (this.config.verbose) { log(ConsoleFlags.info, "===Bundling==="); }

    // Atomic.readAtomsDir(this.config.atomicDir, (atomKey, filePath) => {
    //   this.addAtomo({
    //     key: atomKey,
    //     struct: readFileSync(filePath).toString()
    //   });
    // }, [".html"])

    /* Core JS */
    // let jsCore = "";

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
    const coreBundlePath = join(this.config.bundleDir, 'atomicreact.core.js');
    writeFileSync(coreBundlePath, readFileSync(resolve(join(__dirname, "../helper/loader.js")), { encoding: "utf-8" }), { encoding: "utf-8" })

    const atomicReactModule = "AtomicReact"
    const compilerOptions = Atomic.getTranspileOptions(atomicReactModule.toLowerCase())
    const transpiledCore = transpileModule(readFileSync(resolve(join(__dirname, `lib.js`))).toString(), compilerOptions)
    appendFileSync(coreBundlePath, transpiledCore.outputText)


    /* Bundle User's Package */
    const logicBundlePath = join(this.config.bundleDir, 'atomicreact.bundle.js');
    const styleBundlePath = join(this.config.bundleDir, 'atomicreact.bundle.css');

    const SWITCH_BUNDLE = readFileSync(resolve(join(__dirname, "../helper/switch_bundle.js")), { encoding: "utf-8" })
    const CSS_DEFINER = readFileSync(resolve(join(__dirname, "../helper/css_definer.js")), { encoding: "utf-8" })

    writeFileSync(logicBundlePath, SWITCH_BUNDLE.replaceAll("{{PACKAGE_NAME}}", this.config.packageName))
    writeFileSync(styleBundlePath, "")

    log(`─── Bundling package [${this.config.packageName}]`)
    const t = "   "
    let bundledFilesCount = 0;

    /* Bundle Moduled Styles */
    Atomic.readFilesFromDir(this.config.atomicDir, (filePath, parsedPath) => {
      const input = readFileSync(filePath).toString()

      let aditionalInfoLog = ""
      const uniqueClassID = `a${createHash("md5")
        .update(filePath)
        .update(input).digest("hex").slice(0, 7)}`

      const parsed = postcss.parse(input)

      const selectors = []
      const tokens = {}
      parsed.each(node => {
        selectors.push(node['selector'])
        /* ++ ID to selector */
        node['selector'] = `.${uniqueClassID}${node['selector']}`
      })

      const result = parsed.toResult()
      appendFileSync(styleBundlePath, result.css);

      /* Get all tokens */
      selectors.forEach((s: string) => {
        s.split(/[\s|\.|#]+/).forEach(t => {
          if (t[0] === "[" || t === "*" || t.indexOf(":") > -1 || t === "") return
          tokens[t] = t
        })
      })
      const relativePath = resolveModuleName(relative(this.config.atomicDir, filePath))
      const cssDefiner = CSS_DEFINER
        .replaceAll("{{CSS_MODULE_NAME}}", relativePath)
        .replaceAll("{{ID}}", uniqueClassID)
        .replaceAll("{{TOKENS}}", JSON.stringify(Object.getOwnPropertyNames(tokens)))
      appendFileSync(logicBundlePath, cssDefiner)

      aditionalInfoLog = ` as #${uniqueClassID}`;

      if (this.config.verbose) log(`${t}├── [✔] ${filePath}${aditionalInfoLog}`);
    }, [/\.(atom|module)\.css$/])

    /* Bundle Global Styles */
    Atomic.readFilesFromDir(this.config.atomicDir, async (filePath) => {
      let input = readFileSync(filePath)

      appendFileSync(styleBundlePath, input);

      bundledFilesCount++
      if (this.config.verbose) log(`${t}├── [✔] ${filePath}`);
    }, [/\[^(\.(atom|module)\.)]\.css$/])

    /* Bundle Atoms */
    Atomic.readFilesFromDir(this.config.atomicDir, (filePath, parsedPath) => {
      const relativePath = resolveModuleName(relative(this.config.atomicDir, filePath))

      let input = readFileSync(filePath).toString()

      const transpiled = transpileModule(input, Atomic.getTranspileOptions(relativePath))
      appendFileSync(logicBundlePath, transpiled.outputText)
      bundledFilesCount++

      if (this.config.verbose) log(`${t}├── [✔] ${filePath}`);
    }, [/\.js$/, /([^(\.d)]\.ts)$/, /\.tsx$/, /\.jsx$/])

    /* Pos Build */
    appendFileSync(logicBundlePath, readFileSync(resolve(join(__dirname, "../helper/pos_load.js")), { encoding: "utf-8" }))

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

    success(`${t}└── Bundled ${bundledFilesCount} files`)
  }

}
