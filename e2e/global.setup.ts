import { test as setup, expect } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const authFile = path.join(__dirname, ".auth/user.json");

setup("authenticate", async ({ page }) => {
  setup.setTimeout(60000);
  // If already authenticated and storage exists, reuse state
  if (fs.existsSync(authFile) && fs.statSync(authFile).size > 20) {
    return;
  }

  // Wait until we can reach the app
  await page.goto("/login");

  // Skip the intro overlay if it's there
  try {
    const overlay = page.locator("text=Initializing industrial operations terminal...");
    await expect(overlay).not.toBeVisible({ timeout: 2000 });
  } catch (e) {
    // Ignore if not found
  }

  // Fill credentials and login
  const emailInput = page.locator("input#email");
  if (await emailInput.isVisible()) {
    await emailInput.fill("admin@plantcor.os");
    await page.locator("input#password").fill("Yugioh@123#");
    await page.locator("button[type='submit']").click();
  }

  // Wait for the redirect to complete
  await page.waitForURL((url) => url.pathname.includes("/hub") || url.pathname.includes("/overview") || url.pathname === "/", { timeout: 5000 }).catch(() => {});


  // End of authentication steps.
  // Ensure storage directory exists
  fs.mkdirSync(path.dirname(authFile), { recursive: true });

  // Save the state to the designated file.
  await page.context().storageState({ path: authFile });
});
