import { expect, test } from '@playwright/test';
import { TEST_EMAIL, TEST_PASSWORD } from '../helpers/credentials';

test.describe('Accessibility Visual Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('/');
  });

  test('skip links should be visible when focused', async ({ page }) => {
    // Focus on skip link
    await page.keyboard.press('Tab');

    // Take screenshot showing skip link
    await expect(page).toHaveScreenshot('skip-link-focused.png', {
      mask: [page.locator("[data-testid='clock']")],
    });
  });

  test('focus indicators should be visible', async ({ page }) => {
    // Tab to a button
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Take screenshot showing focus indicator
    await expect(page).toHaveScreenshot('focus-indicator.png', {
      mask: [page.locator("[data-testid='clock']")],
    });
  });

  test('high contrast mode should maintain readability', async ({ page }) => {
    // Force high contrast media query
    await page.emulateMedia({ forcedColors: 'active' });

    // Take screenshot in high contrast mode
    await expect(page).toHaveScreenshot('high-contrast-mode.png', {
      mask: [page.locator("[data-testid='clock']")],
    });
  });
});
