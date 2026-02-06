import { mkdirSync } from "node:fs"
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
  process.exit(code ?? 1)
})

child.on("error", (err) => {
  console.error(err)
  process.exit(1)
})
