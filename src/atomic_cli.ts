#!/usr/bin/env node

import { existsSync, readdirSync, readFile, readFileSync, writeFile, writeFileSync } from "fs"
import { dirname, extname, join, parse, resolve } from "path"
import { exec } from "child_process"
import { fileURLToPath } from "url"
import { ConsoleFlags } from "./tools/console_flags.js"
import { ConsoleIO } from "./tools/console_io.js"

const __dirname = dirname(fileURLToPath(import.meta.url))

class AtomicCLI {

  constructor() {
    const packageJSON = JSON.parse(readFileSync(resolve(__dirname, "package.json"), { encoding: "utf-8" }))

    // var params = [
    //   { name: "<Command>", value: process.argv[2] },
    //   { name: "<Param>", value: process.argv[3] }
    // ];
    // if (params[0].value == "build") { this.build(); };
    // if (params[0].value == "install") { this.install(); };
    // if (params[0].value == "uninstall") { this.uninstall(); };
    // if (params[0].value == "--version") { console.log(ConsoleFlags.info, `Version ${packageJSON.version}`) };
    // if (params[0].value == undefined || params[0].value == null) { this.initAndRun(); };
  };

  build() {
    /* Copy build default file */
  }

  /* @Deprecated */
  init(replaceOption: boolean) {
    // console.log('Atomic init commanded');
    /* Copy AtomicConfig.js to developer working dir */
    var pathDirInit = resolve(__dirname, "..", 'init');
    var filesOnInit = readdirSync(pathDirInit);

    var mConsoleIO = new ConsoleIO();
    var copyPasteFile = function (index: number) {
      if (index >= filesOnInit.length) {
        mConsoleIO.pause();
        return console.log(ConsoleFlags.info, `Initialized in ${process.cwd()}`);
      }
      // console.log("index: ",index);
      let file = filesOnInit[index];
      let pathFile = join(pathDirInit, file);
      let pathFileOnDevWorkspace = join(process.cwd(), file);

      // console.log(pathFile);
      // console.log(pathFileOnDevWorkspace);
      var copyFile = () => {
        readFile(pathFile, (err, data) => {
          if (err) { return console.log(ConsoleFlags.erro, "Error [0] on creating " + file); }
          writeFile(pathFileOnDevWorkspace, data, (err) => {
            if (err) { return console.log(ConsoleFlags.erro, "Error [1] on creating " + file); }
            return copyPasteFile((index + 1));
          });
        });
      };
      if (existsSync(pathFileOnDevWorkspace)) {
        if (replaceOption == true) {
          console.log(ConsoleFlags.warn, "You already have " + file + " file. Are you sure replace? (Type Y to replace)");
          mConsoleIO.getEventEmiter().once('lineReaded', (line) => {
            // console.log('onlineReaded: ', line);
            if (line.toLowerCase().indexOf("y") == -1) {
              console.log(ConsoleFlags.info, "Using the existing " + file + " file");
              return copyPasteFile((index + 1));
            } else { copyFile(); }
          });
        }
      } else {
        copyFile();
      }
    }
    copyPasteFile(0);

  };
  run(runFileName: string = "run.atomic.ts") {
    let runFilePath = resolve(process.cwd(), runFileName);

    if (!existsSync(runFilePath)) return console.log(ConsoleFlags.erro, `Run file not found.`)

    let scriptToExec = `node --loader ts-node/esm ${runFilePath}`;

    var childProcess = exec(scriptToExec, { maxBuffer: 1000 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        console.error(err);
        return;
      }
      console.log(stdout);
    });
    childProcess.stdout.on('data', (data) => {
      console.log(data);
    });
  };
  initAndRun() {
    this.init(false);
    this.run();
  }
  install() {
    if (process.argv[3] == "" || process.argv[3] == undefined || process.argv[3] == null) { return console.log(ConsoleFlags.erro, "The correct syntax is: Atomic install <packageName>"); }
    console.log(ConsoleFlags.info, "Downloading package " + process.argv[3]);
    // var childProcess = spawn('npm.cmd', ['install', process.argv[3]], {});
    var childProcess = exec('npm install ' + process.argv[3] + " --save", (err, stdout, stderr) => {
      if (err) { return console.log(ConsoleFlags.erro, err); }
      console.log(stdout);

      var packagePath = join(process.cwd(), "node_modules");
      packagePath = join(packagePath, process.argv[3]);
      // console.log(packagePath);

      if (existsSync(packagePath)) {
        //Update package.json
        var packageJsonPath = join(process.cwd(), "package.json");
        var packageJson = JSON.parse(readFileSync(packageJsonPath).toString());
        if (packageJson.atomicReact == undefined) { packageJson.atomicReact = { dependencies: [] }; }
        if (packageJson.atomicReact.dependencies == undefined) { packageJson.atomicReact.dependencies = []; }
        if (packageJson.atomicReact.dependencies.indexOf(process.argv[3]) == -1) { packageJson.atomicReact.dependencies.push(process.argv[3]); }
        writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
        return console.log(ConsoleFlags.info, process.argv[3] + " installed with sucess");

      } else { return console.log(ConsoleFlags.erro, "Package " + process.argv[3] + " not found"); }
    });
  }
  uninstall() {
    if (process.argv[3] == "" || process.argv[3] == undefined || process.argv[3] == null) { return console.log(ConsoleFlags.erro, "The correct syntax is: Atomic uninstall <packageName>"); }
    console.log(ConsoleFlags.info, "Uninstalling package " + process.argv[3]);
    // var childProcess = spawn('npm.cmd', ['install', process.argv[3]], {});
    var childProcess = exec('npm uninstall ' + process.argv[3] + " --save", (err, stdout, stderr) => {
      if (err) { return console.log(ConsoleFlags.erro, err); }
      console.log(stdout);

      //Update package.json
      var packageJsonPath = join(process.cwd(), "package.json");
      var packageJson = JSON.parse(readFileSync(packageJsonPath).toString());
      if (packageJson.atomicReact == undefined) { packageJson.atomicReact = { dependencies: [] }; }
      if (packageJson.atomicReact.dependencies == undefined) { packageJson.atomicReact.dependencies = []; }
      var indexOfThisDp = packageJson.atomicReact.dependencies.indexOf(process.argv[3]);
      if (indexOfThisDp != -1) { packageJson.atomicReact.dependencies.splice(indexOfThisDp, 1) }
      writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
      return console.log(ConsoleFlags.info, process.argv[3] + " uninstalled with sucess");
    });
  };
}

new AtomicCLI();
