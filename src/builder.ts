import { dirname, join, resolve } from "path"
import { fileURLToPath } from "url"

import TS from "typescript"
const { transpileModule } = TS
import { minify } from "terser"

import { createDirIfNotExist, readFilesFromDir } from "./tools/file.js"
import { cpSync, readFileSync, statSync, writeFileSync } from "fs"
import { ATOMICREACT_CORE_MIN_JS_FILENAME, getTranspileOptions } from "./compile_settings.js"
import { log, success, tab } from "./tools/console_io.js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const __filename = fileURLToPath(import.meta.url)

async function build(coreFileName: string) {

    const packageJson = JSON.parse(readFileSync(resolve(__dirname, "../package.json"), { encoding: "utf-8" }))

    log(`─── Building ${packageJson.name}@v${packageJson.version}`)

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
    const atomicreactMinifiedPath = resolve(__dirname, coreFileName);

    const loaderDOMHelper = readFileSync(resolve(domHelpersPathTo, "loader.js"), { encoding: "utf-8" })
    const lib = transpileModule(readFileSync(resolve(__dirname, `lib.js`), { encoding: "utf-8" }), getTranspileOptions("atomicreact")).outputText

    const minifiedJS = await minify({
        "loader.js": loaderDOMHelper,
        "lib.js": lib
    }, {
        toplevel: true,
        keep_classnames: true,
        keep_fnames: false,
        compress: true
    })

    writeFileSync(atomicreactMinifiedPath, minifiedJS.code, { encoding: "utf-8" })

    const atomicreactMinifiedStatFile = statSync(atomicreactMinifiedPath)

    success(`${tab}└── Built ${atomicreactMinifiedPath} (${atomicreactMinifiedStatFile.size} bytes)`)

}
build(ATOMICREACT_CORE_MIN_JS_FILENAME)