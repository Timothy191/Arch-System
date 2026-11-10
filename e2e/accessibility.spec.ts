import { expect, test } from '@playwright/test';
import { TEST_EMAIL, TEST_PASSWORD } from './helpers/credentials';

// Project default storageState is authenticated; these specs exercise the logged-out/login flow.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Accessibility Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 20000 });
  });

  test('should have skip links for keyboard navigation', async ({ page }) => {
    // Tab to skip link
    await page.keyboard.press('Tab');
    const skipLink = page.locator(".skip-link, [href='#main-content']");
    await expect(skipLink).toBeVisible();
  });

  test('should have proper ARIA landmarks', async ({ page }) => {
    // Check for main landmark
    const main = page.locator("main, [role='main']");
    await expect(main).toBeVisible();

    // Check for navigation landmark
    const nav = page.locator("nav, [role='navigation']");
    await expect(nav.first()).toBeVisible();
  });

  test('should have focus visible indicators', async ({ page }) => {
    // Tab through elements and check focus visibility
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();
  });

  test('should have proper heading hierarchy', async ({ page }) => {
    // Check that h1 exists
    const h1 = page.locator('h1');
    await expect(h1.first()).toBeVisible();
  });

  test('should have sufficient color contrast', async ({ page }) => {
    const WCAG_AA_NORMAL_CONTRAST = 4.5;
    const textElements = page.locator('h1, h2, h3, p, span, a, button');
    const count = await textElements.count();
    expect(count).toBeGreaterThan(0);

    const contrastRatio = await page.evaluate(() => {
      function parseRgbComponents(cssColor: string): [number, number, number] {
        const match = cssColor.match(/\d+(\.\d+)?/g);
        if (!match || match.length < 3) return [28, 28, 30];
        return [Number(match[0]), Number(match[1]), Number(match[2])];
      }
      function toRelativeLuminance([r, g, b]: [number, number, number]): number {
        const normalize = (channel: number) => {
          const srgb = channel / 255;
          return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
        };
        return 0.2126 * normalize(r) + 0.7152 * normalize(g) + 0.0722 * normalize(b);
      }
      const heading = document.querySelector('h1, h2, main') ?? document.body;
      const fg = parseRgbComponents(window.getComputedStyle(heading).color);
      const bg = parseRgbComponents(window.getComputedStyle(document.body).backgroundColor);
      const l1 = Math.max(toRelativeLuminance(fg), toRelativeLuminance(bg));
      const l2 = Math.min(toRelativeLuminance(fg), toRelativeLuminance(bg));
      return (l1 + 0.05) / (l2 + 0.05);
    });

    expect(contrastRatio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_CONTRAST);
  });

  test('should support keyboard navigation in dropdowns', async ({ page }) => {
    // Navigate to a department with dropdowns
    await page.goto('/drilling');

    // Tab to interactive elements
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Check that focus is visible
    const focused = page.locator(':focus');
    await expect(focused).toBeVisible();
  });

  test('page should have lang attribute', async ({ page }) => {
    const html = page.locator('html');
    await expect(html).toHaveAttribute('lang', 'en');
  });

  test('images should have alt text or be decorative', async ({ page }) => {
    const images = page.locator('img');
    const count = await images.count();

    for (let i = 0; i < count; i++) {
      const img = images.nth(i);
      const hasAlt = await img.getAttribute('alt');
      const hasAriaHidden = await img.getAttribute('aria-hidden');

      // Either has alt text or is marked as decorative
      expect(hasAlt !== null || hasAriaHidden === 'true').toBeTruthy();
    }
  });
});
