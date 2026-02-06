import fs from "node:fs"
import path from "node:path"
import { createRequire } from "node:module"

const requireFromHere = createRequire(import.meta.url)
const repoRoot = process.cwd()

function readRuntimeConfig() {
  const configPath = path.join(repoRoot, "launcher_assets", "runtime-config.js")
  if (!fs.existsSync(configPath)) return null
  const content = fs.readFileSync(configPath, "utf8")
  const out = {}
  const backend = content.match(/backendPort\s*:\s*(\d+)/)
  const storefront = content.match(/storefrontPort\s*:\s*(\d+)/)
  const adminPath = content.match(/adminPath\s*:\s*"([^"]+)"/)
  if (backend) out.backendPort = Number(backend[1])
  if (storefront) out.storefrontPort = Number(storefront[1])
  if (adminPath) out.adminPath = adminPath[1]
  return out
}

function normalizeAdminPath(value) {
  if (!value) return "/app"
  let pathValue = value.trim()
  if (!pathValue.startsWith("/")) pathValue = `/${pathValue}`
  if (pathValue.length > 1 && pathValue.endsWith("/")) pathValue = pathValue.slice(0, -1)
  return pathValue
}

function extractAssets(html) {
  const scripts = []
  const styles = []
  const scriptRegex = /<script[^>]*src="([^"]+)"[^>]*>/gi
  const styleRegex = /<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/gi
  let m
  while ((m = scriptRegex.exec(html))) {
    scripts.push(m[1])
  }
  while ((m = styleRegex.exec(html))) {
    styles.push(m[1])
  }
  return { scripts, styles }
}

async function fetchWithMeta(url) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)
  try {
    const res = await fetch(url, { signal: controller.signal })
    const text = await res.text()
    return {
      ok: res.ok,
      status: res.status,
      contentType: res.headers.get("content-type") || "",
      text,
      url,
    }
  } catch (err) {
    return {
      ok: false,
      status: 0,
      contentType: "",
      text: "",
      url,
      error: err instanceof Error ? err.message : String(err),
    }
  } finally {
    clearTimeout(timeout)
  }
}

function resolveLocalAssetPath(assetPath) {
  const withoutQuery = assetPath.split("?")[0]
  const marker = "/assets/"
  const idx = withoutQuery.indexOf(marker)
  if (idx === -1) return null
  const rel = withoutQuery.slice(idx + 1) // assets/...
  return path.join(repoRoot, "public", "admin", rel)
}

function isJsMime(contentType) {
  const lower = String(contentType || "").toLowerCase()
  return (
    lower.includes("javascript") ||
    lower.includes("ecmascript") ||
    lower.includes("text/plain")
  )
}

async function loadChromium() {
  // Prefer root if available.
  try {
    const playwright = requireFromHere("playwright")
    if (playwright?.chromium) return playwright.chromium
  } catch {
    // ignore
  }

  // Fallback to storefront workspace dependencies.
  try {
    const storeRequire = createRequire(
      path.join(repoRoot, "TheRxSpot_Marketplace-storefront", "package.json")
    )
    const playwright = storeRequire("playwright")
    if (playwright?.chromium) return playwright.chromium
  } catch {
    // ignore
  }

  try {
    const storeRequire = createRequire(
      path.join(repoRoot, "TheRxSpot_Marketplace-storefront", "package.json")
    )
    const pwTest = storeRequire("@playwright/test")
    if (pwTest?.chromium) return pwTest.chromium
  } catch {
    // ignore
  }

  return null
}

async function runBrowserProbe(adminUrl, expectedOrigin) {
  const chromium = await loadChromium()
  if (!chromium) {
    return {
      ok: false,
      skipped: true,
      detail: "Playwright chromium not available in root or storefront workspace",
      consoleErrors: [],
      requestFailures: [],
      adminApiOrigins: [],
    }
  }

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext()
  const page = await context.newPage()

  const consoleErrors = []
  const requestFailures = []
  const adminApiOrigins = new Set()

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text())
    }
  })
  page.on("requestfailed", (req) => {
    requestFailures.push({
      url: req.url(),
      error: req.failure()?.errorText || "unknown",
    })
  })
  page.on("response", (res) => {
    const url = res.url()
    if (url.includes("/admin/")) {
      try {
        adminApiOrigins.add(new URL(url).origin)
      } catch {
        // ignore
      }
    }
  })

  try {
    const maxAttempts = 3
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await page.goto(adminUrl, { waitUntil: "domcontentloaded", timeout: 15000 })
        await page.waitForTimeout(8000)
        break
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        const isTransientConnRefused = /ERR_CONNECTION_REFUSED/i.test(message)
        if (!isTransientConnRefused || attempt === maxAttempts) {
          throw err
        }
        await page.waitForTimeout(2000)
      }
    }
  } finally {
    await browser.close()
  }

  const criticalConsole = consoleErrors.filter(
    (t) =>
      /failed to load module script|mime type|unexpected token '<'|chunkloaderror/i.test(t)
  )
  const originMismatch = [...adminApiOrigins].some((o) => o !== expectedOrigin)

  return {
    ok: criticalConsole.length === 0 && !originMismatch,
    skipped: false,
    detail: "Browser probe complete",
    consoleErrors,
    criticalConsole,
    requestFailures,
    adminApiOrigins: [...adminApiOrigins],
    originMismatch,
  }
}

async function main() {
  const runtime = readRuntimeConfig() || {}
  const backendPort = Number(process.env.BACKEND_PORT || runtime.backendPort || 9001)
  const adminPath = normalizeAdminPath(process.env.ADMIN_PATH || runtime.adminPath || "/app")
  const adminUrl = process.env.ADMIN_URL || `http://localhost:${backendPort}${adminPath}/login`
  const expectedOrigin = new URL(adminUrl).origin

  const result = {
    timestamp: new Date().toISOString(),
    input: {
      backendPort,
      adminPath,
      adminUrl,
      runtimeConfigDetected: Boolean(runtime.backendPort || runtime.adminPath),
    },
    checks: {
      login_html: { ok: false, status: 0, detail: "" },
      assets_exist_locally: [],
      assets_http: [],
      browser_probe: null,
    },
    ok: false,
  }

  const loginRes = await fetchWithMeta(adminUrl)
  result.checks.login_html = {
    ok: loginRes.ok && loginRes.status === 200,
    status: loginRes.status,
    detail: loginRes.error || `content-type=${loginRes.contentType || "unknown"}`,
  }

  const criticalFailures = []
  if (!result.checks.login_html.ok) {
    criticalFailures.push(`Login HTML unavailable: ${loginRes.error || loginRes.status}`)
  } else {
    const assets = extractAssets(loginRes.text)
    const allAssets = [...assets.scripts, ...assets.styles]
    for (const asset of allAssets) {
      const isDevVirtualAsset =
        asset.startsWith(`${adminPath}/@vite/`) ||
        asset === `${adminPath}/entry.jsx` ||
        asset.startsWith("/@vite/") ||
        asset === "/entry.jsx"

      const localPath = isDevVirtualAsset ? null : resolveLocalAssetPath(asset)
      const exists = isDevVirtualAsset ? true : localPath ? fs.existsSync(localPath) : false
      result.checks.assets_exist_locally.push({
        asset,
        localPath,
        isDevVirtualAsset,
        ok: exists,
      })
      if (!exists) {
        criticalFailures.push(`Missing local asset referenced by login HTML: ${asset}`)
      }

      const absoluteAssetUrl = new URL(asset, expectedOrigin).toString()
      const assetRes = await fetchWithMeta(absoluteAssetUrl)
      const isScript = assets.scripts.includes(asset)
      const mimeOk = isScript ? isJsMime(assetRes.contentType) : true
      const httpOk = assetRes.ok && assetRes.status === 200
      result.checks.assets_http.push({
        asset,
        url: absoluteAssetUrl,
        status: assetRes.status,
        contentType: assetRes.contentType,
        ok: httpOk && mimeOk,
        mimeOk,
        error: assetRes.error || "",
      })

      if (!httpOk) {
        criticalFailures.push(`Asset request failed (${assetRes.status}): ${asset}`)
      }
      if (isScript && !mimeOk) {
        criticalFailures.push(
          `Script asset MIME mismatch (${assetRes.contentType || "unknown"}): ${asset}`
        )
      }
    }
  }

  const browserProbe = await runBrowserProbe(adminUrl, expectedOrigin)
  result.checks.browser_probe = browserProbe
  if (!browserProbe.skipped && !browserProbe.ok) {
    criticalFailures.push("Browser probe failed (critical console error or admin origin mismatch)")
  }

  result.ok = criticalFailures.length === 0
  result.failures = criticalFailures
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
