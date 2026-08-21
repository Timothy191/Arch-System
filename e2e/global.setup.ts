import { test as setup, expect } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const authFile = path.join(__dirname, ".auth/user.json");

setup("authenticate", async ({ page }) => {
  setup.setTimeout(60000);
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
  await page.locator("input#email").fill("admin@plantcor.os");
  await page.locator("input#password").fill("Yugioh@123#");
  await page.locator("form[data-testid='login-form'] button[type='submit']").click();

  // Wait for the redirect to complete (allow up to 45s for Next.js Dev compilation to /hub)
  await page.waitForURL("**/hub", { timeout: 45000 }).catch(() => {
    console.warn("Global setup: Timed out waiting for redirect, continuing anyway.");
  });

  // End of authentication steps.
  // Ensure storage directory exists
  fs.mkdirSync(path.dirname(authFile), { recursive: true });

  // Save the state to the designated file.
  await page.context().storageState({ path: authFile });
});
