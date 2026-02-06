import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { chromium } from "playwright";

const baseUrl = process.env.ADMIN_URL || "http://localhost:9001";
const loginUrl = `${baseUrl.replace(/\/$/, "")}/app/login`;
const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;
const headless = (process.env.HEADLESS || "true").toLowerCase() !== "false";
const browserChannel = process.env.BROWSER_CHANNEL || undefined;
const recordTrace = (process.env.RECORD_TRACE || "true").toLowerCase() !== "false";
const recordHar = (process.env.RECORD_HAR || "true").toLowerCase() !== "false";
const recordVideo = (process.env.RECORD_VIDEO || "true").toLowerCase() !== "false";
const runStamp = new Date().toISOString().replace(/[:.]/g, "-");
const outDir = path.join(os.tmpdir(), "therxspot-admin-login-diagnose", runStamp);

if (!email || !password) {
  console.error("Missing ADMIN_EMAIL or ADMIN_PASSWORD environment variables.");
  process.exit(2);
}

await fs.mkdir(outDir, { recursive: true });

const browser = await chromium.launch({
  headless,
  channel: browserChannel,
});
const context = await browser.newContext({
  ...(recordVideo
    ? {
        recordVideo: {
          dir: outDir,
          size: { width: 1600, height: 900 },
        },
      }
    : {}),
  ...(recordHar
    ? {
        recordHar: {
          path: path.join(outDir, "network.har"),
          mode: "full",
        },
      }
    : {}),
});
const page = await context.newPage();

const events = [];
const failedRequests = [];
const consoleMessages = [];
const pageErrors = [];

page.on("request", (req) => {
  const url = req.url();
  if (url.includes("/admin/") || url.includes("/auth/") || url.includes("/app")) {
    events.push({
      type: "request",
      method: req.method(),
      resourceType: req.resourceType(),
      url,
    });
  }
});

page.on("response", (res) => {
  const url = res.url();
  if (url.includes("/admin/") || url.includes("/auth/") || url.includes("/app")) {
    events.push({
      type: "response",
      status: res.status(),
      method: res.request().method(),
      url,
    });
  }
});

page.on("requestfailed", (req) => {
  failedRequests.push({
    method: req.method(),
    url: req.url(),
    errorText: req.failure()?.errorText || "unknown",
  });
});

page.on("console", (message) => {
  consoleMessages.push({
    type: message.type(),
    text: message.text(),
  });
});

page.on("pageerror", (error) => {
  pageErrors.push(String(error?.stack || error?.message || error));
});

const snapshot = async (label) => {
  const safeLabel = label.replace(/\s+/g, "-").toLowerCase();
  const screenshotPath = path.join(outDir, `${safeLabel}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  const domState = await page.evaluate(() => {
    const text = (document.body?.innerText || "").replace(/\s+/g, " ").trim().slice(0, 500);
    const hasSpinner = Boolean(
      document.querySelector('[class*="spinner"], [aria-busy="true"], .animate-spin')
    );
    return {
      href: window.location.href,
      readyState: document.readyState,
      title: document.title,
      hasSpinner,
      text,
    };
  });
  return {
    label,
    screenshotPath,
    domState,
  };
};

const result = {
  loginUrl,
  outDir,
  steps: [],
  startedAt: new Date().toISOString(),
};

try {
  if (recordTrace) {
    await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  }

  await page.goto(loginUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  result.steps.push(await snapshot("01-login-loaded"));

  const continueWithEmailButton = page
    .locator('button:has-text("Continue with Email"), button:has-text("Continue")')
    .first();

  if (await continueWithEmailButton.isVisible().catch(() => false)) {
    await continueWithEmailButton.click();
    await page.waitForTimeout(500);
    result.steps.push(await snapshot("02-email-mode-opened"));
  }

  const emailInput = page
    .locator('input[type="email"], input[name="email"], input[autocomplete="email"]')
    .first();
  const passwordInput = page
    .locator('input[type="password"], input[name="password"], input[autocomplete="current-password"]')
    .first();

  await emailInput.fill(email);
  await passwordInput.fill(password);
  result.steps.push(await snapshot("03-credentials-filled"));

  const loginButton = page
    .locator('button[type="submit"], button:has-text("Sign in"), button:has-text("Log in"), button:has-text("Login")')
    .first();

  await loginButton.click();
  await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => null);

  await page.waitForTimeout(8000);
  result.steps.push(await snapshot("04-post-login"));

  const reachedAuthenticatedRoute = await page
    .waitForFunction(
      () => !window.location.pathname.includes("/app/login"),
      undefined,
      { timeout: 20000 }
    )
    .then(() => true)
    .catch(() => false);

  result.reachedAuthenticatedRoute = reachedAuthenticatedRoute;
} catch (error) {
  result.error = String(error?.stack || error?.message || error);
}

const pageContentPath = path.join(outDir, "final-page.html");
await fs.writeFile(pageContentPath, await page.content(), "utf8");

result.finalUrl = page.url();
result.pageContentPath = pageContentPath;
result.failedRequests = failedRequests;
result.consoleMessages = consoleMessages;
result.pageErrors = pageErrors;
result.relevantEvents = events.slice(-120);
result.endedAt = new Date().toISOString();

if (recordTrace) {
  await context.tracing.stop({ path: path.join(outDir, "trace.zip") });
}

await fs.writeFile(path.join(outDir, "result.json"), JSON.stringify(result, null, 2), "utf8");
console.log(JSON.stringify(result, null, 2));

await context.close();
await browser.close();
