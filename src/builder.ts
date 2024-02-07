import { dirname, join, resolve } from "path"
import { fileURLToPath } from "url"

import TS from "typescript"
const { transpileModule } = TS
import { minify } from "terser"

import { createDirIfNotExist, readFilesFromDir } from "./tools/file.js"
import { cpSync, readFileSync, statSync, writeFileSync } from "fs"
import { getTranspileOptions } from "./transpile.js"
import { error, log, success, tab } from "./tools/console_io.js"
import { ATOMICREACT_CORE_MIN_JS_FILENAME, ATOMICREACT_GLOBAL } from "./constants.js"
import { exec, execSync, spawn, spawnSync } from "child_process"

const __dirname = dirname(fileURLToPath(import.meta.url))
const __filename = fileURLToPath(import.meta.url)

enum Enviroment {
    Development = "development",
    Production = "production"
}


async function build(coreFileName: string) {

    /* Args */
    const env = (process.argv[2]) ? (process.argv[2].toLowerCase() as Enviroment) : Enviroment.Production
    const toPublish = (process.argv[3] === "publish") ? true : false

    const packageJsonPath = resolve(__dirname, "../package.json")
    const packageJson = JSON.parse(readFileSync(packageJsonPath, { encoding: "utf-8" }))

    /* Upgrade minor version if is to publish */
    if (toPublish) {
        const vSplited = (packageJson.version as string).split(".")
        packageJson.version = `${vSplited.slice(0, vSplited.length - 1).join(".")}.${Number(vSplited[vSplited.length - 1]) + 1}`
        writeFileSync(packageJsonPath, JSON.stringify(packageJson, undefined, tab))
    }

    log(`───  [${env}] Building ${packageJson.name}@v${packageJson.version}`)

    /* Copy package.json to dist dir */
    writeFileSync(resolve(__dirname, "package.json"), JSON.stringify(packageJson, undefined, tab))
    log(`${tab}├── [✔] Copied package.json to dist directory`)

    /* Copy helpers into dist dir */
    const domHelpersPathFrom = resolve(__dirname, "../src/dom_helpers")
    const domHelpersPathTo = join(__dirname, "dom_helpers")
    createDirIfNotExist(__dirname, domHelpersPathTo)

    await readFilesFromDir(domHelpersPathFrom, async (filePath, parsedPath) => {
        cpSync(filePath, join(domHelpersPathTo, parsedPath.base))
    }, [/\.js/])

    /* Build AtomicReact Core Minified */
    const atomicreactMinifiedPath = resolve(__dirname, coreFileName)

    const loaderDOMHelper = readFileSync(resolve(domHelpersPathTo, "loader.js"), { encoding: "utf-8" })
    const lib = transpileModule(readFileSync(resolve(__dirname, `lib.js`), { encoding: "utf-8" }), getTranspileOptions(ATOMICREACT_GLOBAL)).outputText

    let outJS = ""

    if (env === Enviroment.Production) {
        const minifiedJS = await minify({
            "loader.js": loaderDOMHelper,
            "lib.js": lib
        }, {
            toplevel: true,
            keep_classnames: true,
            keep_fnames: false,
            compress: true
        })
        outJS = minifiedJS.code
    }

    if (env === Enviroment.Development) {
        outJS = `${loaderDOMHelper}\n\r${lib}`
    }

    writeFileSync(atomicreactMinifiedPath, outJS, { encoding: "utf-8" })

    let atomicreactMinifiedStatFile = statSync(atomicreactMinifiedPath)

    success(`${tab}└── Built ${atomicreactMinifiedPath} (${atomicreactMinifiedStatFile.size} bytes)`)

    if (toPublish) {
        log(`───  [${env}] Publishing ${packageJson.name}@v${packageJson.version}`)
        const childProc = exec(`cd ${resolve(__dirname, "..")} && npm publish`)
        childProc.stdout.on("data", (d) => (process.stdout.write(d.toString())))
        childProc.stderr.on("data", (d) => (process.stdout.write(d.toString())))
        childProc.on("close", (code) => ((code===0) ? success(`${tab}└── [✔] Published!`) : error(`${tab}└── [X] Not published!`)))
    }
}
build(ATOMICREACT_CORE_MIN_JS_FILENAME)