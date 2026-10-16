import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test as setup } from '@playwright/test';
import { TEST_EMAIL, TEST_PASSWORD } from './helpers/credentials';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const authFile = path.join(__dirname, '.auth/user.json');

setup('authenticate', async ({ page }) => {
  setup.setTimeout(90000);
  // Reuse state only if modified within the last 30 minutes and contains an sb- auth cookie
  if (
    fs.existsSync(authFile) &&
    fs.statSync(authFile).size > 100 &&
    Date.now() - fs.statSync(authFile).mtimeMs < 30 * 60 * 1000
  ) {
    try {
      const existing = JSON.parse(fs.readFileSync(authFile, 'utf8'));
      if (existing.cookies?.some((c: { name?: string }) => c.name?.startsWith('sb-'))) {
        return;
      }
    } catch {
      // Proceed to fresh login
    }
  }

  // Authenticate via /api/auth/login so Set-Cookie headers populate context cookies directly
  const loginRes = await page.request.post('/api/auth/login', {
    data: { email: TEST_EMAIL, password: TEST_PASSWORD },
    headers: { 'Content-Type': 'application/json' },
  });

  if (!loginRes.ok()) {
    // Fallback to UI form login if API endpoint wasn't used
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    const emailInput = page.locator('input#email');
    await emailInput.waitFor({ state: 'visible', timeout: 15000 });
    await emailInput.fill(TEST_EMAIL);
    await page.locator('input#password').fill(TEST_PASSWORD);
    await page.locator("button[type='submit']").click();
    await page
      .waitForURL((url) => url.pathname.includes('/hub') || url.pathname === '/', {
        timeout: 20000,
      })
      .catch(() => {});
  }

  // Ensure storage directory exists
  fs.mkdirSync(path.dirname(authFile), { recursive: true });

  // Save the state to the designated file.
  await page.context().storageState({ path: authFile });
});
