declare module '*.module.css' {
    const exports: { [exportName: string]: string };
    export = exports;
}

declare module '*.atom.css' {
    const exports: { [exportName: string]: string };
    export = exports;
}

