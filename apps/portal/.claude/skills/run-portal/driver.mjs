// Portal driver: browse, log in, and screenshot the running portal.
//
// Usage (from any cwd):
//   node driver.mjs [--login] [paths...]
//
//   --login   authenticate first with the smoke-test creds from apps/portal/.env
//   paths...  app paths to visit (default: "/" and "/hub"; with --login: "/hub")
//
// Screenshots land in $PORTAL_SHOT_DIR (default /tmp/portal-shots).
// Console/page errors are captured and printed at the end. Exit 0 on success.
//
// Credentials are read from apps/portal/.env and are NEVER printed.
// Playwright comes from the global mise install - see SKILL.md "Gotchas".

import process from "node:process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SKILL_DIR = dirname(fileURLToPath(import.meta.url));
const PORTAL_DIR = join(SKILL_DIR, "..", "..", "..");
const PW_DIR = "/home/tim/.local/share/mise/installs/npm-playwright/latest";
const { chromium } = await import(pathToFileURL(PW_DIR + "/node_modules/playwright/index.mjs"));

const BASE = process.env.PORTAL_BASE || "http://localhost:3000";
const SHOT_DIR = process.env.PORTAL_SHOT_DIR || "/tmp/portal-shots";
const EXEC = "/usr/bin/chromium";

const args = process.argv.slice(2);
const doLogin = args.includes("--login");
const paths = args.filter(function (a) {
  return a !== "--login";
});

let email = null;
let password = null;
if (doLogin) {
  const envText = readFileSync(join(PORTAL_DIR, ".env"), "utf8");
  const pick = function (k) {
    const m = envText.match(new RegExp("^" + k + "=(.*)$", "m"));
    return m ? m[1].trim() : null;
  };
  email = pick("SMOKE_TEST_EMAIL");
  password = pick("SMOKE_TEST_PASSWORD");
  if (!email || !password) {
    console.error("FATAL: set SMOKE_TEST_EMAIL / SMOKE_TEST_PASSWORD in apps/portal/.env");
    process.exit(2);
  }
}

const browser = await chromium.launch({
  headless: true,
  executablePath: EXEC,
  args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const consoleErrors = [];
page.on("console", function (m) {
  if (m.type() === "error") consoleErrors.push(m.text().slice(0, 300));
});
page.on("pageerror", function (e) {
  consoleErrors.push("PAGEERROR: " + String(e).slice(0, 300));
});

let loginOk = !doLogin;

if (doLogin) {
  await page.goto(BASE + "/login?redirect=%2Fhub", { waitUntil: "load", timeout: 60000 });
  await page.waitForTimeout(1000);

  for (const label of ["Decline Optional", "Accept All"]) {
    const btn = page.getByRole("button", { name: label });
    const visible = await btn
      .first()
      .isVisible()
      .catch(function () {
        return false;
      });
    if (visible) {
      await btn
        .first()
        .click({ force: true })
        .catch(function () {});
      await page.waitForTimeout(400);
      break;
    }
  }

  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click('form[data-testid="login-form"] button[type="submit"]');
  try {
    await page.waitForURL("**/hub**", { timeout: 20000 });
    await page.waitForTimeout(2500);
  } catch (e) {
    // fall through; the URL check below decides the verdict
  }
  const u = page.url();
  loginOk = u.includes("/hub") && !u.includes("/login");
  console.log("login: " + (loginOk ? "SUCCESS" : "FAILED") + " (final url " + u + ")");
}

if (paths.length === 0) {
  paths.push.apply(paths, doLogin ? ["/hub"] : ["/", "/hub"]);
}

for (const t of paths) {
  const url = BASE + t;
  try {
    await page.goto(url, { waitUntil: "load", timeout: 60000 });
    await page.waitForTimeout(1200);
  } catch (e) {
    console.log("!! goto " + t + ": " + e.message.split("\n")[0]);
  }
  const title = await page.title().catch(function () {
    return "?";
  });
  const bodyText = (
    await page.innerText("body").catch(function () {
      return "";
    })
  )
    .trim()
    .slice(0, 220)
    .replace(/\s+/g, " ");
  const name = t === "/" ? "home" : t.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "");
  const shot = SHOT_DIR + "/" + name + ".png";
  await page.screenshot({ path: shot });
  console.log("\n=== " + t + " -> finalUrl=" + page.url());
  console.log("    title=" + JSON.stringify(title));
  console.log("    body=" + JSON.stringify(bodyText));
  console.log("    shot=" + shot);
}

if (consoleErrors.length) {
  console.log("\n=== console errors ===");
  console.log(consoleErrors.join("\n"));
}
await browser.close();
process.exit(loginOk ? 0 : 1);
