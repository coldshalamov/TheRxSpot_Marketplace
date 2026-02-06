import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs"
import { spawn } from "node:child_process"
import path from "node:path"

const tempDir = path.join(process.cwd(), ".tmp", "medusa-build-temp")
mkdirSync(tempDir, { recursive: true })

const env = {
  ...process.env,
  TEMP: tempDir,
  TMP: tempDir,
}

const child =
  process.platform === "win32"
    ? spawn("cmd.exe", ["/d", "/s", "/c", "npx medusa build"], {
        stdio: "inherit",
        env,
        shell: false,
      })
    : spawn("npx", ["medusa", "build"], {
        stdio: "inherit",
        env,
        shell: false,
      })

child.on("exit", (code) => {
  if (code === 0) {
    try {
      const builtAdminDir = path.join(process.cwd(), ".medusa", "server", "public", "admin")
      const runtimeAdminDir = path.join(process.cwd(), "public", "admin")

      if (existsSync(builtAdminDir)) {
        rmSync(runtimeAdminDir, { recursive: true, force: true })
        mkdirSync(path.dirname(runtimeAdminDir), { recursive: true })
        cpSync(builtAdminDir, runtimeAdminDir, { recursive: true })
        console.log(`info:    Synced admin build to ${runtimeAdminDir}`)
      }
    } catch (err) {
      console.error("error:   Failed to sync admin build into public/admin", err)
      process.exit(1)
    }
  }

  process.exit(code ?? 1)
})

child.on("error", (err) => {
  console.error(err)
  process.exit(1)
})
