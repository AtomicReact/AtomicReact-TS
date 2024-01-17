import { existsSync, mkdirSync, readdirSync, readFile, statSync, writeFile } from "fs";
import { relative, sep, join, ParsedPath, parse } from "path";


export const createDirIfNotExist = function (refDirPath: string, goalDirPath: string) {
  if (existsSync(goalDirPath)) return
  var relativePath = relative(refDirPath, goalDirPath)

  relativePath.split(sep).forEach((dir) => {
    const dirPath = join(refDirPath, dir)
    if (!existsSync(dirPath)) {
      mkdirSync(dirPath)
    }
  })
}

export const copyFile = function (pathFile: string, pastPathFile: string, callback: Function) {
  readFile(pathFile, (err, data) => {
    if (err) { return callback(err); }
    writeFile(pastPathFile, data, (err) => {
      return callback(err);
    })
  })
}

interface IMapFilesFromDir {
  filePath: string,
  fileParsed: ParsedPath,
  extensionIndex: number
}

export const mapFilesFromDir = function (dirPath: string, extensions = [/.*\..*$/]): IMapFilesFromDir[] {
  const filesOrDirs = readdirSync(dirPath)
  const mapResult: Array<IMapFilesFromDir> = []

  for (let file of filesOrDirs) {
    const fileOrDirPath = join(dirPath, file)
    const fileOrDirStat = statSync(fileOrDirPath)

    if (fileOrDirStat.isDirectory()) {
      mapResult.push(...mapFilesFromDir(fileOrDirPath, extensions))
      continue
    }

    const extensionIndex = extensions.findIndex((regexp) => (regexp.test(fileOrDirPath.toLowerCase())))
    if (extensionIndex === -1) {
      continue
    }

    const fileParsed = parse(fileOrDirPath)
    mapResult.push({
      filePath: fileOrDirPath,
      fileParsed,
      extensionIndex
    })
  }

  return mapResult
}

export const readFilesFromDir = async function (dirPath: string, callback: (filePath: string, parsedPath: ParsedPath) => void, extensions = [/(\.html)/]) {
  const files = readdirSync(dirPath)
  for (let file of files) {
    let filePath = join(dirPath, file)

    let fileStat = statSync(filePath)
    let parsedPath = parse(filePath)

    if (fileStat.isDirectory()) {
      await readFilesFromDir(filePath, callback, extensions)
      continue
    }

    if (extensions.find((exp) => (exp.test(filePath.toLowerCase())))) {
      callback(filePath, parsedPath)
      continue
    }
  }
}

