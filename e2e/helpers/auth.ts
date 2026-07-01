import { Page, BrowserContext } from "@playwright/test";
import path from "path";
import fs from "fs";

const AUTH_FILE = path.resolve(process.cwd(), "e2e/.auth/user.json");
const TEST_EMAIL = process.env.TEST_EMAIL || "admin@plantcor.os";
const TEST_EMPLOYEE_ID = process.env.TEST_EMPLOYEE_ID || "ADMIN-001";
const TEST_PASSWORD = process.env.TEST_PASSWORD || "Yugioh@123#";

export const LOGIN_SELECTORS = {
  email: "#employee-email",
  employeeId: "#employee-id",
  password: "#password",
  form: '[data-testid="login-form"]',
  submit: "form[data-testid='login-form'] button[type='submit']",
} as const;

export async function fillLoginForm(
  page: Page,
  credentials: { email?: string; employeeId?: string; password?: string } = {},
) {
  await page.fill(LOGIN_SELECTORS.email, credentials.email ?? TEST_EMAIL);
  await page.fill(LOGIN_SELECTORS.employeeId, credentials.employeeId ?? TEST_EMPLOYEE_ID);
  await page.fill(LOGIN_SELECTORS.password, credentials.password ?? TEST_PASSWORD);
}

/**
 * Attempt to authenticate via form-based login.
 * Returns true if login succeeded.
 */
async function formLogin(page: Page): Promise<boolean> {
  await page.goto("/login");
  await page.waitForSelector(LOGIN_SELECTORS.form, { timeout: 10000 });

  await fillLoginForm(page);
  await page.click(LOGIN_SELECTORS.submit);

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
export async function loginWithTestUser(context: BrowserContext, page: Page): Promise<boolean> {
  const authDir = path.dirname(AUTH_FILE);
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  const apiUrl = process.env.BASE_URL
    ? `${process.env.BASE_URL}/api/auth/login`
    : "http://localhost:3000/api/auth/login";

  try {
    const response = await page.request.post(apiUrl, {
      data: { email: TEST_EMAIL, employeeId: TEST_EMPLOYEE_ID, password: TEST_PASSWORD },
    });

    if (response.ok()) {
      await context.storageState({ path: AUTH_FILE });
      return true;
    }
  } catch {
    // API login failed, fall through to form-based
  }

  const success = await formLogin(page);
  if (success) {
    await context.storageState({ path: AUTH_FILE });
  }
  return success;
}

/**
 * Perform a mock login for E2E tests.
 */
export async function performMockLogin(page: Page, role: string = "admin"): Promise<void> {
  const context = page.context();
  const success = await loginWithTestUser(context, page);

  if (!success) {
    throw new Error(`Failed to perform mock login for role: ${role}`);
  }
}

export { AUTH_FILE, TEST_EMAIL, TEST_EMPLOYEE_ID, TEST_PASSWORD };
