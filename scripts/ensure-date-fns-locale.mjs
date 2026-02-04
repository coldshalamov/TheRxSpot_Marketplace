import fs from "node:fs"
import path from "node:path"

function findDateFnsRoot(projectRoot) {
  const candidate = path.join(projectRoot, "node_modules", "date-fns")
  if (!fs.existsSync(candidate)) {
    throw new Error(`date-fns not found at ${candidate}`)
  }
  return candidate
}

function readLocaleExportName(localeFilePath) {
  const content = fs.readFileSync(localeFilePath, "utf8")
  const match = content.match(/export\s+const\s+([A-Za-z0-9_]+)\s*=/)
  return match ? match[1] : null
}

function writeFileIfChanged(filePath, content) {
  const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : null
  if (existing === content) {
    return false
  }
  fs.writeFileSync(filePath, content, "utf8")
  return true
}

function isGeneratedByThisScript(filePath) {
  if (!fs.existsSync(filePath)) {
    return false
  }

  const head = fs.readFileSync(filePath, "utf8").slice(0, 400)
  return head.includes("GENERATED FILE (do not edit manually)")
}

function toIdentifier(maybeIdentifier) {
  if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(maybeIdentifier)) {
    throw new Error(`Invalid JS identifier derived from filename: ${maybeIdentifier}`)
  }
  return maybeIdentifier
}

function ensureLocaleLibMjs(localeDir, banner) {
  const localeDirs = fs
    .readdirSync(localeDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()

  let wrote = 0

  for (const localeName of localeDirs) {
    const libDir = path.join(localeDir, localeName, "_lib")
    if (!fs.existsSync(libDir)) {
      continue
    }

    const jsFiles = fs
      .readdirSync(libDir, { withFileTypes: true })
      .filter((d) => d.isFile())
      .map((d) => d.name)
      .filter((f) => f.endsWith(".js"))
      .sort()

    for (const jsFile of jsFiles) {
      const exportName = toIdentifier(path.basename(jsFile, ".js"))
      const mjsPath = path.join(libDir, `${exportName}.mjs`)

      if (fs.existsSync(mjsPath) && !isGeneratedByThisScript(mjsPath)) {
        continue
      }

      const wrapper =
        banner +
        `import * as mod from \"./${jsFile}\"\n\n` +
        `export const ${exportName} = mod.${exportName}\n`

      if (writeFileIfChanged(mjsPath, wrapper)) {
        wrote += 1
      }
    }
  }

  return wrote
}

function ensureLocaleFileMjs(localeDir, banner) {
  const entries = fs.readdirSync(localeDir, { withFileTypes: true })
  const jsFiles = entries
    .filter((d) => d.isFile())
    .map((d) => d.name)
    .filter((f) => f.endsWith(".js"))
    .sort()

  let wrote = 0

  for (const jsFile of jsFiles) {
    const base = path.basename(jsFile, ".js")
    const mjsPath = path.join(localeDir, `${base}.mjs`)

    if (fs.existsSync(mjsPath) && !isGeneratedByThisScript(mjsPath)) {
      continue
    }

    const jsPath = path.join(localeDir, jsFile)
    const content = fs.readFileSync(jsPath, "utf8")
    const exportNames = extractCjsExports(content).map(toIdentifier)

    if (!exportNames.length) {
      const wrapper = banner + "export {}\n"
      if (writeFileIfChanged(mjsPath, wrapper)) {
        wrote += 1
      }
      continue
    }

    const lines = [banner, `import * as mod from \"./${jsFile}\"\n\n`]

    for (const exportName of exportNames) {
      lines.push(`export const ${exportName} = mod.${exportName}\n`)
    }

    if (writeFileIfChanged(mjsPath, lines.join(""))) {
      wrote += 1
    }
  }

  return wrote
}

function extractCjsExports(fileContent) {
  const names = new Set()
  const regex = /\bexports\.([A-Za-z_$][A-Za-z0-9_$]*)\s*=/g
  let match
  while ((match = regex.exec(fileContent))) {
    const name = match[1]
    if (name === "__esModule") {
      continue
    }
    names.add(name)
  }
  return Array.from(names).sort()
}

function ensureDirectoryMjsWrappers(targetDir, banner) {
  if (!fs.existsSync(targetDir)) {
    return 0
  }

  let wrote = 0
  const entries = fs.readdirSync(targetDir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = path.join(targetDir, entry.name)

    if (entry.isDirectory()) {
      wrote += ensureDirectoryMjsWrappers(fullPath, banner)
      continue
    }

    if (!entry.isFile() || !entry.name.endsWith(".js")) {
      continue
    }

    const base = path.basename(entry.name, ".js")
    const mjsPath = path.join(targetDir, `${base}.mjs`)
    if (fs.existsSync(mjsPath) && !isGeneratedByThisScript(mjsPath)) {
      continue
    }

    const content = fs.readFileSync(fullPath, "utf8")
    const exportNames = extractCjsExports(content).map(toIdentifier)

    if (!exportNames.length) {
      const wrapper = banner + "export {}\n"
      if (writeFileIfChanged(mjsPath, wrapper)) {
        wrote += 1
      }
      continue
    }

    const lines = [banner, `import * as mod from \"./${entry.name}\"\n\n`]

    for (const exportName of exportNames) {
      lines.push(`export const ${exportName} = mod.${exportName}\n`)
    }

    if (writeFileIfChanged(mjsPath, lines.join(""))) {
      wrote += 1
    }
  }

  return wrote
}

function ensureRootMjsWrappers(dateFnsRoot, banner) {
  const entries = fs.readdirSync(dateFnsRoot, { withFileTypes: true })
  const jsFiles = entries
    .filter((d) => d.isFile())
    .map((d) => d.name)
    .filter((f) => f.endsWith(".js"))
    .filter((f) => !f.startsWith("cdn."))
    .filter((f) => !["index.js", "fp.js", "locale.js"].includes(f))
    .sort()

  let wrote = 0

  for (const jsFile of jsFiles) {
    const base = path.basename(jsFile, ".js")
    const mjsPath = path.join(dateFnsRoot, `${base}.mjs`)
    if (fs.existsSync(mjsPath) && !isGeneratedByThisScript(mjsPath)) {
      continue
    }

    const jsPath = path.join(dateFnsRoot, jsFile)
    const content = fs.readFileSync(jsPath, "utf8")
    const exportNames = extractCjsExports(content).map(toIdentifier)

    if (!exportNames.length) {
      const wrapper = banner + "export {}\n"
      if (writeFileIfChanged(mjsPath, wrapper)) {
        wrote += 1
      }
      continue
    }

    const lines = [banner, `import * as mod from \"./${jsFile}\"\n\n`]

    for (const exportName of exportNames) {
      lines.push(`export const ${exportName} = mod.${exportName}\n`)
    }

    if (writeFileIfChanged(mjsPath, lines.join(""))) {
      wrote += 1
    }
  }

  return wrote
}

function main() {
  const projectRoot = process.cwd()
  const dateFnsRoot = findDateFnsRoot(projectRoot)
  const localeDir = path.join(dateFnsRoot, "locale")
  const fpDir = path.join(dateFnsRoot, "fp")
  const rootLibDir = path.join(dateFnsRoot, "_lib")

  if (!fs.existsSync(localeDir)) {
    throw new Error(`date-fns locale directory not found at ${localeDir}`)
  }

  const banner =
    `/**\n` +
    ` * GENERATED FILE (do not edit manually)\n` +
    ` *\n` +
    ` * Some environments end up with an incomplete date-fns install where\n` +
    ` * 'date-fns/locale' resolves to './locale.mjs' via package exports, but\n` +
    ` * the file is missing.\n` +
    ` *\n` +
    ` * This script generates the missing locale entrypoint so Medusa admin\n` +
    ` * bundling can resolve 'date-fns/locale'.\n` +
    ` */\n`

  const wroteLocaleFilesMjs = ensureLocaleFileMjs(localeDir, banner)

  const localeFiles = fs
    .readdirSync(localeDir)
    .filter((f) => f.endsWith(".mjs"))
    .filter((f) => !f.startsWith("cdn."))
    .sort()

  const exportsList = localeFiles
    .map((file) => {
      const filePath = path.join(localeDir, file)
      const exportName = readLocaleExportName(filePath)
      return exportName ? { file, exportName } : null
    })
    .filter(Boolean)

  const localeMjs =
    banner +
    exportsList.map(({ file, exportName }) => `export { ${exportName} } from "./locale/${file}"`).join("\n") +
    "\n"

  const localeDts =
    banner +
    exportsList.map(({ exportName }) => `export const ${exportName}: any`).join("\n") +
    "\n"

  const wroteLocaleMjs = writeFileIfChanged(path.join(dateFnsRoot, "locale.mjs"), localeMjs)
  const wroteLocaleDts = writeFileIfChanged(path.join(dateFnsRoot, "locale.d.ts"), localeDts)
  const wroteLocaleDmts = writeFileIfChanged(path.join(dateFnsRoot, "locale.d.mts"), localeDts)
  const wroteLocaleLibMjs = ensureLocaleLibMjs(localeDir, banner)
  const wroteRootMjs = ensureRootMjsWrappers(dateFnsRoot, banner)
  const wroteRootLibMjs = ensureDirectoryMjsWrappers(rootLibDir, banner)
  const wroteFpDirMjs = ensureDirectoryMjsWrappers(fpDir, banner)

  const rootMjsFiles = fs
    .readdirSync(dateFnsRoot)
    .filter((f) => f.endsWith(".mjs"))
    .filter((f) => !["index.mjs", "fp.mjs", "locale.mjs"].includes(f))
    .filter((f) => !f.startsWith("cdn."))
    .sort()

  const indexMjs =
    banner +
    rootMjsFiles.map((f) => `export * from \"./${f}\"`).join("\n") +
    "\n"

  const wroteIndexMjs = writeFileIfChanged(path.join(dateFnsRoot, "index.mjs"), indexMjs)

  let wroteFpMjs = false
  if (fs.existsSync(fpDir)) {
    const fpMjsFiles = fs
      .readdirSync(fpDir)
      .filter((f) => f.endsWith(".mjs"))
      .sort()

    const fpMjs =
      banner +
      fpMjsFiles.map((f) => `export * from \"./fp/${f}\"`).join("\n") +
      "\n"

    wroteFpMjs = writeFileIfChanged(path.join(dateFnsRoot, "fp.mjs"), fpMjs)
  }

  if (
    wroteLocaleMjs ||
    wroteLocaleDts ||
    wroteLocaleDmts ||
    wroteLocaleFilesMjs ||
    wroteLocaleLibMjs ||
    wroteRootMjs ||
    wroteRootLibMjs ||
    wroteFpDirMjs ||
    wroteIndexMjs ||
    wroteFpMjs
  ) {
    console.log("Patched date-fns locale entrypoints:", {
      localeMjs: wroteLocaleMjs,
      localeDts: wroteLocaleDts,
      localeDmts: wroteLocaleDmts,
      localeFilesMjs: wroteLocaleFilesMjs,
      localeLibMjs: wroteLocaleLibMjs,
      rootMjs: wroteRootMjs,
      rootLibMjs: wroteRootLibMjs,
      fpDirMjs: wroteFpDirMjs,
      indexMjs: wroteIndexMjs,
      fpMjs: wroteFpMjs,
    })
  }
}

main()
