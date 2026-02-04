import { spawn } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import process from "node:process"

function getArgValue(flag) {
  const idx = process.argv.indexOf(flag)
  if (idx === -1) return undefined
  return process.argv[idx + 1]
}

function hasFlag(flag) {
  return process.argv.includes(flag)
}

function loadEnvFileIfPresent(filePath) {
  if (!fs.existsSync(filePath)) {
    return
  }

  const content = fs.readFileSync(filePath, "utf8")
  const lines = content.split(/\r?\n/)

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) {
      continue
    }

    const idx = trimmed.indexOf("=")
    if (idx === -1) {
      continue
    }

    const key = trimmed.slice(0, idx).trim()
    if (!key) {
      continue
    }

    if (process.env[key] !== undefined) {
      continue
    }

    let value = trimmed.slice(idx + 1).trim()
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    process.env[key] = value
  }
}

function loadDotEnvFallback() {
  const repoRoot = process.cwd()
  loadEnvFileIfPresent(path.join(repoRoot, ".env"))
  loadEnvFileIfPresent(path.join(repoRoot, ".env.local"))
}

function requireEnv(key) {
  const value = process.env[key]
  if (!value || !value.trim()) {
    throw new Error(`Missing required env var: ${key}`)
  }
  return value.trim()
}

function withDatabaseInUrl(databaseUrl, dbName) {
  const url = new URL(databaseUrl)
  url.pathname = `/${dbName}`
  return url.toString()
}

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const resolvedCmd =
      process.platform === "win32" && (cmd === "npx" || cmd === "npm") ? `${cmd}.cmd` : cmd

    const spawnOpts = { stdio: "inherit", shell: false, ...opts }

    const quoteWindowsArg = (arg) => {
      if (!arg) return "\"\""
      if (!/[ \t"]/g.test(arg)) return arg
      return `"${arg.replace(/"/g, '\\"')}"`
    }

    const child =
      process.platform === "win32" && resolvedCmd.endsWith(".cmd")
        ? spawn(
            "cmd.exe",
            ["/d", "/s", "/c", [resolvedCmd, ...args].map(quoteWindowsArg).join(" ")],
            spawnOpts
          )
        : spawn(resolvedCmd, args, spawnOpts)

    child.on("error", reject)
    child.on("exit", (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${cmd} ${args.join(" ")} failed with exit code ${code}`))
    })
  })
}

function runWithStdin(cmd, args, stdinContent, opts = {}) {
  return new Promise((resolve, reject) => {
    const resolvedCmd =
      process.platform === "win32" && (cmd === "npx" || cmd === "npm") ? `${cmd}.cmd` : cmd

    const spawnOpts = { stdio: ["pipe", "inherit", "inherit"], shell: false, ...opts }

    const quoteWindowsArg = (arg) => {
      if (!arg) return "\"\""
      if (!/[ \t"]/g.test(arg)) return arg
      return `"${arg.replace(/"/g, '\\"')}"`
    }

    const child =
      process.platform === "win32" && resolvedCmd.endsWith(".cmd")
        ? spawn(
            "cmd.exe",
            ["/d", "/s", "/c", [resolvedCmd, ...args].map(quoteWindowsArg).join(" ")],
            spawnOpts
          )
        : spawn(resolvedCmd, args, spawnOpts)

    child.on("error", reject)
    child.stdin.write(stdinContent)
    child.stdin.end()
    child.on("exit", (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${cmd} ${args.join(" ")} failed with exit code ${code}`))
    })
  })
}

async function main() {
  const dbName = getArgValue("--db") || "medusa_clean_migrations"
  const skipDocker = hasFlag("--skip-docker")
  const skipVerify = hasFlag("--skip-verify")

  loadDotEnvFallback()

  const baseDatabaseUrl = requireEnv("DATABASE_URL")
  const cleanDatabaseUrl = withDatabaseInUrl(baseDatabaseUrl, dbName)

  console.log(`[db] target database: ${dbName}`)
  console.log(`[db] DATABASE_URL (overridden for migrate): ${cleanDatabaseUrl}`)

  if (!skipDocker) {
    console.log("[docker] ensuring postgres/redis are up...")
    await run("docker", ["compose", "up", "-d"])
  }

  if (!skipDocker) {
    console.log("[db] dropping database (if exists)...")
    await run("docker", [
      "compose",
      "exec",
      "-T",
      "postgres",
      "psql",
      "-U",
      "medusa",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      `DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE);`,
    ])

    console.log("[db] creating database...")
    await run("docker", [
      "compose",
      "exec",
      "-T",
      "postgres",
      "psql",
      "-U",
      "medusa",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      `CREATE DATABASE "${dbName}";`,
    ])
  } else {
    console.log("[db] skip-docker enabled: database create/drop must be handled manually.")
  }

  console.log("[medusa] running migrations (all-or-nothing, safe links)...")
  await run("npx", ["medusa", "db:migrate", "--execute-safe-links", "--all-or-nothing"], {
    env: { ...process.env, DATABASE_URL: cleanDatabaseUrl },
  })

  if (!skipVerify) {
    if (skipDocker) {
      console.log("[verify] skip-docker enabled: cannot verify via docker/psql. Skipping.")
    } else {
      console.log("[verify] verifying expected schema exists...")
      const verifySql = fs.readFileSync("scripts/db/verify-schema.sql", "utf8")
      await runWithStdin(
        "docker",
        ["compose", "exec", "-T", "postgres", "psql", "-U", "medusa", "-d", dbName, "-v", "ON_ERROR_STOP=1"],
        verifySql
      )
    }
  }

  console.log("[ok] clean migrate complete")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
