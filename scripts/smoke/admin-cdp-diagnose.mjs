import { chromium } from "playwright";

const TARGET = process.env.ADMIN_URL || "http://localhost:9001/app";
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
  adminUsersMe: events.filter((e) => e.url?.includes('/admin/users/me')),
  adminFeatureFlags: events.filter((e) => e.url?.includes('/admin/feature-flags')),
  tail: events.slice(-40),
};

console.log(JSON.stringify(summary, null, 2));
await browser.close();
