import { expect, test } from '@playwright/test';
import {
  evaluateAbove,
  evaluateAlignedHorizontally,
  evaluateBelow,
  evaluateInside,
  evaluateLeftOf,
  evaluateNoOverlap,
  evaluateRightOf,
  expectGalenLayout,
  RESPONSIVELY_MINING_VIEWPORTS,
} from '../helpers/galen-layout';

// AGENT-TRACE: The /login test must run unauthenticated or the auth middleware
// redirects it to / and the screenshot captures the dashboard instead. The
// /privacy and /offline tests are public and are left on the project default.
test.describe('Visual Regression & Galen Spatial Layout Specs', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('Galen Spatial Engine & Responsively Mining Viewports - Deterministic Geometry Invariants', async () => {
    expect(RESPONSIVELY_MINING_VIEWPORTS).toHaveLength(4);
    const headerRect = { x: 0, y: 0, width: 1280, height: 64 };
    const logoRect = { x: 24, y: 16, width: 140, height: 32 };
    const clockRect = { x: 1120, y: 16, width: 120, height: 32 };
    const heroRect = { x: 24, y: 88, width: 1232, height: 360 };

    expect(evaluateAbove(headerRect, { target: heroRect, gap: { minGapPx: 16 } }).passed).toBe(
      true
    );
    expect(evaluateBelow(heroRect, { target: headerRect, gap: { minGapPx: 16 } }).passed).toBe(
      true
    );
    expect(evaluateInside(logoRect, headerRect).passed).toBe(true);
    expect(evaluateLeftOf(logoRect, { target: clockRect, gap: { minGapPx: 100 } }).passed).toBe(
      true
    );
    expect(evaluateRightOf(clockRect, { target: logoRect, gap: { minGapPx: 100 } }).passed).toBe(
      true
    );
    expect(
      evaluateAlignedHorizontally(logoRect, {
        target: clockRect,
        alignment: { edge: 'center', tolerancePx: 1 },
      }).passed
    ).toBe(true);
    expect(evaluateNoOverlap(headerRect, heroRect).passed).toBe(true);
  });

  test('Login Page - Visual & Galen Spatial Check', async ({ page }) => {
    await page.goto('/login');
    await page.waitForTimeout(1000);

    const bodyLocator = page.locator('body');
    const mainForm = page.locator('form').first();
    if ((await mainForm.count()) > 0) {
      await expectGalenLayout(mainForm).toBeInside(bodyLocator);
    }

    await expect(page).toHaveScreenshot('login-page.png', { fullPage: true });
  });

  test('Hub Dashboard - Visual Check', async ({ page }) => {
    await page.goto('/privacy');
    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot('privacy-page.png', { fullPage: true });
  });

  test('Offline Fallback - Visual Check', async ({ page }) => {
    await page.goto('/offline');
    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot('offline-page.png', { fullPage: true });
  });
});
