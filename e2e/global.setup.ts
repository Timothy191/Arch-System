import { test as setup } from "@playwright/test";
import path from "path";
import { fillLoginForm, LOGIN_SELECTORS } from "./helpers/auth";

const authFile = path.resolve(process.cwd(), "e2e/.auth/user.json");

setup("authenticate", async ({ page }) => {
  await page.goto("/login");

  await page.waitForSelector(LOGIN_SELECTORS.form, { timeout: 10000 });
  await fillLoginForm(page);
  await page.locator(LOGIN_SELECTORS.submit).click();

  await page.waitForURL("**/", { timeout: 15000 }).catch(() => {
    console.warn("Global setup: Timed out waiting for redirect, continuing anyway.");
  });

  await page.context().storageState({ path: authFile });
});
