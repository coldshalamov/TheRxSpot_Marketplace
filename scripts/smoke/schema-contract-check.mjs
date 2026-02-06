import fs from "node:fs"
import net from "node:net"
import path from "node:path"
import { Client } from "pg"

const repoRoot = process.cwd()
const envPath = path.join(repoRoot, ".env")

const REQUIRED_COLUMNS = [
  { table: "audit_log", column: "updated_at" },
]

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) {
    return {}
  }

  const raw = fs.readFileSync(filePath, "utf8")
  const parsed = {}
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue
    const idx = line.indexOf("=")
    if (idx <= 0) continue
    const key = line.slice(0, idx).trim()
    let value = line.slice(idx + 1).trim()
    if (!key) continue
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    parsed[key] = value
  }
  return parsed
}

function getEnv(key, fallback) {
  return process.env[key] || fallback[key] || ""
}

function parseRedisTarget(redisUrl) {
  try {
    const url = new URL(redisUrl)
    const host = url.hostname || "127.0.0.1"
    const port = Number(url.port || 6379)
    return { host, port }
  } catch {
    return { host: "127.0.0.1", port: 6379 }
  }
}

async function checkRedisReachable(redisUrl) {
  const { host, port } = parseRedisTarget(redisUrl)
  return await new Promise((resolve) => {
    const socket = new net.Socket()
    let settled = false

    const finish = (ok, detail) => {
      if (settled) return
      settled = true
      try {
        socket.destroy()
      } catch {
        // ignore
      }
      resolve({ ok, detail, host, port })
    }

    socket.setTimeout(1500)
    socket.on("connect", () => finish(true, `Connected to ${host}:${port}`))
    socket.on("timeout", () => finish(false, `Timeout connecting to ${host}:${port}`))
    socket.on("error", (err) => finish(false, err.message))
    socket.connect(port, host)
  })
}

async function main() {
  const envFile = loadDotEnv(envPath)
  const databaseUrl = getEnv("DATABASE_URL", envFile)
  const redisUrl = getEnv("REDIS_URL", envFile)

  const result = {
    timestamp: new Date().toISOString(),
    checks: {
      database_reachable: { ok: false, detail: "" },
      redis_reachable: { ok: false, detail: "" },
      required_columns: [],
    },
    ok: false,
  }

  if (!databaseUrl) {
    result.checks.database_reachable.detail = "DATABASE_URL is missing"
    result.checks.required_columns = REQUIRED_COLUMNS.map((item) => ({
      ...item,
      ok: false,
      detail: "Skipped because DATABASE_URL is missing",
    }))
  }

  let client = null
  try {
    if (databaseUrl) {
      client = new Client({ connectionString: databaseUrl })
      await client.connect()
      result.checks.database_reachable = { ok: true, detail: "Connected to PostgreSQL" }

      const columnChecks = []
      for (const item of REQUIRED_COLUMNS) {
        const sql = `
          select exists (
            select 1
            from information_schema.columns
            where table_schema = 'public'
              and table_name = $1
              and column_name = $2
          ) as present
        `
        const q = await client.query(sql, [item.table, item.column])
        const present = Boolean(q.rows?.[0]?.present)
        columnChecks.push({
          ...item,
          ok: present,
          detail: present
            ? "Column exists"
            : `Missing column public.${item.table}.${item.column}`,
        })
      }
      result.checks.required_columns = columnChecks
    }
  } catch (err) {
    result.checks.database_reachable = {
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    }
    result.checks.required_columns = REQUIRED_COLUMNS.map((item) => ({
      ...item,
      ok: false,
      detail: "Skipped because database check failed",
    }))
  } finally {
    if (client) {
      try {
        await client.end()
      } catch {
        // ignore
      }
    }
  }

  if (!redisUrl) {
    result.checks.redis_reachable = { ok: false, detail: "REDIS_URL is missing" }
  } else {
    result.checks.redis_reachable = await checkRedisReachable(redisUrl)
  }

  const columnsOk = result.checks.required_columns.every((c) => c.ok)
  result.ok =
    result.checks.database_reachable.ok &&
    result.checks.redis_reachable.ok &&
    columnsOk

  console.log(JSON.stringify(result, null, 2))
  process.exit(result.ok ? 0 : 1)
}

main().catch((err) => {
  console.error(
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        ok: false,
        fatal: err instanceof Error ? err.message : String(err),
      },
      null,
      2
    )
  )
  process.exit(1)
})
