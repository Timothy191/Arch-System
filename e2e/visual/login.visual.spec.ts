/**
 * Visual regression tests for the login page.
 * Uses Playwright's built-in snapshot comparison.
 *
 * First run (baseline): npx playwright test e2e/visual --update-snapshots
 * Subsequent runs:       npx playwright test e2e/visual
 */

import { expect, test } from '@playwright/test';
import { findOpaqueBackgroundLayers, luminanceOf, ROUTE_BG_SELECTOR } from '../helpers/background';

// AGENT-TRACE: Override the project-level authenticated storageState (e2e/.auth/user.json)
// so this spec runs UNauthenticated. The (auth) middleware redirects authenticated
// users from /login -> /, which previously caused this spec to screenshot the
// dashboard (~3023px) instead of the login page (~1036px) and fail against the
// login baseline. Mirrors the pattern in e2e/login.spec.ts.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('login page visual regression', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('load');
    await page.addStyleTag({
      content: `
        canvas { display: none !important; }
        video { display: none !important; }
        .animate-pulse { animation: none !important; }
        /* Ambient video + film grain rasterize nondeterministically into
           full-page shots (frame timing) and re-encoded every baseline
           (login-full grew 170KB -> 562KB). The deterministic WebP poster
           (route-bg-image-container) remains visible for pixel comparison.
           NOTE: login-full stays ~550KB — that is the photographic poster
           itself, which is real page content and compresses poorly as PNG.
           The video/grain hiding removes the NONDETERMINISM, not the bytes. */
        .route-bg-video-container { display: none !important; }
        .route-bg-grain { display: none !important; }
      `,
    });
  });

  test('full login page matches snapshot', async ({ page }) => {
    await expect(page).toHaveScreenshot('login-full.png', {
      fullPage: true,
      threshold: 0.02, // 2% pixel difference tolerance
      mask: [
        // eve status bar contains a pulsing status dot — mask for determinism
        page.locator('[data-testid="eve-status-bar"]'),
      ],
    });
  });

  test('login form card matches snapshot', async ({ page }) => {
    const form = page.getByTestId('login-form');
    await expect(form).toHaveScreenshot('login-form-card.png', {
      threshold: 0.02,
    });
  });

  test('login page with filled email field', async ({ page }) => {
    await page.locator("input[type='email'], input#email").first().fill('operator@arch.os');

    await expect(page.getByTestId('login-form')).toHaveScreenshot('login-form-filled.png', {
      threshold: 0.02,
    });
  });

  test('route background shows through and the card is a light surface', async ({ page }) => {
    // The global wallpaper must be mounted rather than covered...
    await expect(page.locator(ROUTE_BG_SELECTOR)).toBeVisible();

    // ...and the login card must remain a light-mode surface on top of it.
    const cardBg = await page
      .locator('[data-testid="login-card"]')
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    const luminance = luminanceOf(cardBg);
    expect(luminance, `login card background was ${cardBg}`).not.toBeNull();
    expect(luminance!).toBeGreaterThan(200);

    const opaque = await findOpaqueBackgroundLayers(page, '[data-testid="login-card"]');
    expect(
      opaque,
      `opaque layer(s) covering the route background: ${JSON.stringify(opaque)}`
    ).toEqual([]);
  });
});
