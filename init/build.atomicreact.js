const { Atomic } = await import("atomicreact")

const buildConfig = {
    atomicDir: "src/atomicreact",
    bundleDir: "public/libs/atomicreact",
    debug: true,
    packageName: "simple_frontend"
}

function build() {
    new Atomic(buildConfig)
}

build()