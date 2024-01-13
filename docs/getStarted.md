# Get Started 🚀

## Install AtomicReact package via NPM

```bash
  npm install atomicreact
```

## Clone the *simple-frontend* repository 

```bash
git clone https://github.com/AtomicReact/simple-frontend
```

The *simple-frontend* uses the following workspace struct:

```
└── SimpleFrontEnd (root)
    ├── package.json
    ├── tsconfig.json
    ├── public
    |   ├── libs
    |   |    └── atomicreact
    |   └── index.html
    | 
    └── src
        ├── server.ts
        └── atomicreact
            └── App.tsx
```

### tsconfig.json

```json
{
  "compilerOptions": {
    "jsx": "preserve",
    // ...
  }
}
```


## Import AtomicReact in your html


## Create your first Atom


## Build and bundle AtomicReact

Create your own build script

```ts
import { Atomic, IConfig } from "atomicreact"

const buildConfig: IConfig = {
    atomicDir: "src/atomicreact", /* Where your atoms are */
    bundleDir: "public/libs/atomicreact", /* Where bundle files are bundled */
    debug: true,
    packageName: "simple_frontend" /* Your atomic react package name */
}

export function build() {
    new Atomic(buildConfig)
}

build()
```

## Development


1. Serve

```ts
import express, { Express } from "express"
import { resolve } from "path"

import { Atomic, IConfig, HotReload } from "atomicreact"

const app: Express = express()

app.use(express.static(resolve(process.cwd(), 'public'))); //static files to web

app.listen(3000, () => {
    console.log('Server http running');

    const config: IConfig = {
        atomicDir: "src/atomicreact",
        bundleDir: "public/libs/atomicreact",
        debug: true,
        packageName: "simple_frontend"
    }
    const atomic = new Atomic(config, new HotReload(1337, "localhost"));
});
```


Then some files and dirs will be created and now you are already able to [**create your first Atom**](getStarted?id=creating-an-atom)

## Creating an Atom

There are 3 subfolders in `AtomicDir` (_myAtomicReactFolder_ by default):

```text
└── AtomicDir
    ├── html
    ├── js
    └── css
```

The `html` subfolder is the Atom's structure.

The `js` subfolder is the Atom's logic.

The `css` subfolder is the Atom's style.

**To create an Atom** just create any _.html_ file in `html` subfolder. **The file name is the Atom name or the Atom key**. Note if you let the `debug` as _true_ in `AtomicReact_config.js` file you should see the Atom name on console.

For now just put the following html code inside your Atom.

```html
<div>
  <h1>{props.myTitle}</h1>
  <h2>Hi! I'm a Atom</h2>
  <div atomic.nucleus></div>
</div>
```

_Notes:_

- Checkout the [`Atom`](Atom) for know more about Atom structure, logic and style

## Using an Atom

Let's supose you already have a _http server_ serving an _html_ file. Maybe with _Http Server from NodeJS_ , _Wamp Server_, _Apache Server_, whatever.

**To use an Atom** you need just import the bundles files from `BundleDir` in your _html_ file. Like this:

```html
<script src="./AtomicReactBundle/atomicreact.core.js"></script>
<script src="./AtomicReactBundle/atomicreact.bundle.js"></script>
<link rel="stylesheet" href="./AtomicReactBundle/atomicreact.bundle.css" />
```

And **use it tagging Atom key**:

```html
<body>
  <MyAtom props.myTitle="This's my title"> <h4>i'm in nucleus</h4> </MyAtom>
</body>
```

The _html_ file will look like this:

```html
<html>
  <head>
    <title>Hello AtomicReact App</title>

    <script src="./AtomicReactBundle/atomicreact.core.js"></script>
    <script src="./AtomicReactBundle/atomicreact.bundle.js"></script>
    <link rel="stylesheet" href="./AtomicReactBundle/atomicreact.bundle.css" />
  </head>

  <body>
    <MyAtom props.myTitle="This's my title"> <h4>i'm in nucleus</h4> </MyAtom>
  </body>
</html>
```

After AtomicReact renders the page, you will see this:

```html
<html>
  <head>
    <title>Hello AtomicReact App</title>

    <script src="./AtomicReactBundle/atomicreact.core.js"></script>
    <script src="./AtomicReactBundle/atomicreact.bundle.js"></script>
    <link rel="stylesheet" href="./AtomicReactBundle/atomicreact.bundle.css" />
  </head>

  <body>
    <div data-atomic-key="MyAtom" data-atomic-id="MyAtom_0">
      <h1>This's my title</h1>
      <h2>Hi! I'm a Atom</h2>
      <div data-atomic-nucleus><h4>i'm in nucleus</h4></div>
    </div>
  </body>
</html>
```

That's all folks. You can see this on [Playground](https://playground-fre5.onrender.com/18QieJGnQoTn7wUVX6s82IENsPl4S0bjx)

**Next importants steps:**

- Learn more about [`Atom`](Atom)
