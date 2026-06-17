import { Page, BrowserContext } from "@playwright/test";
import path from "path";
import fs from "fs";

const AUTH_FILE = path.resolve(process.cwd(), "e2e/.auth/user.json");
const TEST_EMAIL = process.env.TEST_EMAIL || "admin@plantcor.os";
const TEST_PASSWORD = process.env.TEST_PASSWORD || "Yugioh@123#";

/**
 * Attempt to authenticate via form-based login.
 * Returns true if login succeeded.
 */
async function formLogin(page: Page): Promise<boolean> {
  await page.goto("/login");
  await page.waitForSelector('[data-testid="login-form"]', { timeout: 10000 });

  await page.fill("input#email", TEST_EMAIL);
  await page.fill("input#password", TEST_PASSWORD);
  await page.click("button[type='submit']");

  try {
    await page.waitForURL("**/", { timeout: 15000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Authenticate the given context with test credentials.
 * Uses API-based login first, falls back to form-based login.
 * Saves storage state to `.auth/user.json` for reuse.
 *
 * Returns true if login succeeded.
 */
export async function loginWithTestUser(
  context: BrowserContext,
  page: Page,
): Promise<boolean> {
  // Create auth directory if it doesn't exist
  const authDir = path.dirname(AUTH_FILE);
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  // Try API-based login first
  const apiUrl = process.env.BASE_URL
    ? `${process.env.BASE_URL}/api/auth/login`
    : "http://localhost:3000/api/auth/login";

  try {
    const response = await page.request.post(apiUrl, {
      data: { email: TEST_EMAIL, password: TEST_PASSWORD },
    });

    if (response.ok()) {
      // API login succeeded — cookies are set automatically
      await context.storageState({ path: AUTH_FILE });
      return true;
    }
  } catch {
    // API login failed, fall through to form-based
  }

  // Fall back to form-based login
  const success = await formLogin(page);
  if (success) {
    await context.storageState({ path: AUTH_FILE });
  }
  return success;
}

export { AUTH_FILE };
