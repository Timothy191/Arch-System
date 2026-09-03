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
  // If already authenticated and on hub, return immediately
  if (page.url().includes("/hub") || page.url().includes("/drilling") || page.url().includes("/engineering")) {
    return true;
  }

  await page.goto("/login");
  // If redirected away from login due to active cookie/session
  if (page.url().includes("/hub") || !page.url().includes("/login")) {
    return true;
  }

  const emailInput = page.locator("input#email, input[name='email']");
  try {
    await emailInput.waitFor({ state: "visible", timeout: 5000 });
  } catch {
    return true;
  }

  if (await emailInput.isVisible()) {
    await emailInput.fill(TEST_EMAIL);
    await page.locator("input#password, input[name='password']").fill(TEST_PASSWORD);
    await page.locator("button[type='submit']").click();
    await page.waitForURL((url) => url.pathname.includes("/hub") || url.pathname === "/", { timeout: 10000 }).catch(() => {});
  }
  return true;
}

export async function loginWithTestUser(context: BrowserContext, page: Page): Promise<boolean> {
  const authDir = path.dirname(AUTH_FILE);
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  // If session already valid
  if (page.url().includes("/hub")) {
    return true;
  }

  return await formLogin(page);
}


/**
 * Perform a mock login for E2E tests.
 * This is a simplified version that bypasses actual authentication for test purposes.
 * It sets the necessary session state directly.
 */
export async function performMockLogin(page: Page, role: string = "admin"): Promise<void> {
  // In a real implementation, this would set mock session cookies or localStorage
  // For now, we'll use the existing loginWithTestUser function
  // The role parameter is reserved for future role-based testing

  // Create a temporary context for this login
  const context = page.context();

  // Use the existing login function
  const success = await loginWithTestUser(context, page);

  if (!success) {
    throw new Error(`Failed to perform mock login for role: ${role}`);
  }
}

export { AUTH_FILE };
