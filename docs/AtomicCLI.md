# Atomic CLI

AtomicReact CLI is used by the developer to automate commands.

## Overview
* [`Atomic init`](AtomicCLI?id=atomic-init)
* [`Atomic run`](AtomicCLI?id=atomic-run)
* [`Atomic`](AtomicCLI?id=atomic)
* [`Atomic install`](AtomicCLI?id=atomic-install)
* [`Atomic uninstall`](AtomicCLI?id=atomic-uninstall)

## Commands

### Init

```bash
npx Atomic init
```

* **Description:**
creates the initial files.

### Run

```bash
npx Atomic run [runFileName]
```

* **Description:**
runs Atomic using [`the running file`](Running).

* **Param:**

Param | Description | Default
------------ | ------------- | ---
runFileName | File name to run | `run.atomic.ts`

### Atomic

```bash
npx Atomic
```

* **Description:**
`Atomic` is an alias for **[`Atomic init`](AtomicCLI?id=atomic-init) & [`Atomic run`](AtomicCLI?id=atomic-run)** commands.

### Install AtomicReact packages

```bash
npx Atomic install <packageName>
```

* **Description:**
installs a AtomicReact package published on [NPM](https://www.npmjs.com/).

* **Param:**

Param | Description
------------ | -------------
packageName | Package name to install

* **Note:**
  * This command modifies your `package.json`

### Uninstall AtomicReact packages

```bash
npx Atomic uninstall <packageName>
```

* **Description:**
uninstalls a AtomicReact package installed.

* **Param:**

Param | Description
------------ | -------------
packageName | Package name to uninstall

* **Note:**
  * This command modifies your `package.json`
