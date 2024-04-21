
export function normalizeModuleName(moduleName: string) {
    return moduleName.replaceAll("\\", "/").replaceAll("../", "").replaceAll("./", "").replaceAll(".tsx", "").replaceAll(".jsx", "").replaceAll(".ts", "").replaceAll(".js", "").replaceAll(".mjs", "")
}

export const sumPath = (absolutePath: string, relativePath: string) => {
    let absolute = absolutePath.split("/")
    const backTimes = relativePath.split("../").length - 1
    if (absolute.length <= backTimes) return normalizeModuleName(relativePath)
    absolute.splice(absolute.length - backTimes)
    return normalizeModuleName(`${absolute.join("/")}${absolutePath == "" ? "" : "/"}${relativePath}`)
}