import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const requireFromHere = createRequire(import.meta.url);
const repoRoot = process.cwd();

function readRuntimeConfig() {
  const configPath = path.join(repoRoot, "launcher_assets", "runtime-config.js");
  if (!fs.existsSync(configPath)) return null;
  const content = fs.readFileSync(configPath, "utf8");
  const backend = content.match(/backendPort\s*:\s*(\d+)/);
  const adminPath = content.match(/adminPath\s*:\s*"([^"]+)"/);
  return {
    backendPort: backend ? Number(backend[1]) : null,
    adminPath: adminPath ? adminPath[1] : "/app",
  };
}

function normalizeAdminPath(value) {
  if (!value) return "/app";
  let out = value.trim();
  if (!out.startsWith("/")) out = `/${out}`;
  if (out.length > 1 && out.endsWith("/")) out = out.slice(0, -1);
  return out;
}

function resolveChromium() {
  try {
    const playwright = requireFromHere("playwright");
    if (playwright?.chromium) return playwright.chromium;
  } catch {
    // ignore
  }
  try {
    const storeRequire = createRequire(path.join(repoRoot, "TheRxSpot_Marketplace-storefront", "package.json"));
    const playwright = storeRequire("playwright");
    if (playwright?.chromium) return playwright.chromium;
  } catch {
    // ignore
  }
  try {
    const storeRequire = createRequire(path.join(repoRoot, "TheRxSpot_Marketplace-storefront", "package.json"));
    const pwTest = storeRequire("@playwright/test");
    if (pwTest?.chromium) return pwTest.chromium;
  } catch {
    // ignore
  }
  return null;
}

const runtime = readRuntimeConfig() || {};
const backendPort = process.env.BACKEND_PORT || runtime.backendPort || 9001;
const adminPath = normalizeAdminPath(process.env.ADMIN_PATH || runtime.adminPath || "/app");
const TARGET = process.env.ADMIN_URL || `http://localhost:${backendPort}${adminPath}/login`;

const chromium = resolveChromium();
if (!chromium) {
  console.error(
    JSON.stringify(
      {
        target: TARGET,
        ok: false,
        fatal: "Playwright chromium is unavailable (checked root + storefront workspace).",
      },
      null,
      2
    )
  );
  process.exit(1);
}

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();

const events = [];
const failed = [];
const consoleErrors = [];

page.on("console", (m) => {
  if (["error", "warning"].includes(m.type())) {
    consoleErrors.push({ type: m.type(), text: m.text() });
  }
});

page.on("request", (r) => {
  if (r.url().includes("/admin/") || r.url().includes("/app")) {
    events.push({ t: Date.now(), kind: "req", method: r.method(), url: r.url(), rt: r.resourceType() });
  }
});

page.on("response", (r) => {
  if (r.url().includes("/admin/") || r.url().includes("/app")) {
    events.push({ t: Date.now(), kind: "res", status: r.status(), method: r.request().method(), url: r.url() });
  }
});

page.on("requestfailed", (r) => {
  failed.push({ method: r.method(), url: r.url(), err: r.failure()?.errorText || "unknown" });
});

await page.goto(TARGET, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(12000);

const state = await page.evaluate(() => {
  const body = (document.body?.innerText || "").replace(/\s+/g, " ").trim().slice(0, 400);
  const spinner = !!document.querySelector('[class*="spinner"], [aria-busy="true"], .animate-spin');
  return {
    href: location.href,
    readyState: document.readyState,
    title: document.title,
    body,
    spinner,
  };
});

const summary = {
  target: TARGET,
  state,
  failed,
  consoleErrors,
  adminUsersMe: events.filter((e) => e.url?.includes("/admin/users/me")),
  adminFeatureFlags: events.filter((e) => e.url?.includes("/admin/feature-flags")),
  tail: events.slice(-40),
};

console.log(JSON.stringify(summary, null, 2));
await browser.close();
