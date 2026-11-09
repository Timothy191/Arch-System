/**
 * Visual regression tests for the Control Room SCADA Dashboard & Shift Closeout workflow.
 * Uses Playwright's built-in snapshot comparison across desktop, mobile, and tablet viewports.
 *
 * Baseline update: npx playwright test e2e/visual/control-room.visual.spec.ts --update-snapshots
 * Verification:    npx playwright test e2e/visual/control-room.visual.spec.ts
 */

import { expect, test } from '@playwright/test';
import { AUTH_FILE } from '../helpers/auth';

const PAGE_LOAD_TIMEOUT_MS = 15000;

test.describe('Control Room Dashboard & Shift Closeout Visual Regression', () => {
  test.use({ storageState: AUTH_FILE });

  test.beforeEach(async ({ page }) => {
    await page.addStyleTag({
      content: `
        canvas { display: none !important; }
        video { display: none !important; }
        .animate-pulse { animation: none !important; }
        .route-bg-video-container { display: none !important; }
        .route-bg-grain { display: none !important; }
      `,
    });
  });

  test('Control Room SCADA Dashboard matches visual baseline and exposes Shift Closeout subtab', async ({
    page,
  }) => {
    await page.goto('/control-room');
    await expect(page.getByRole('heading', { name: 'Control Room Dashboard' })).toBeVisible({
      timeout: PAGE_LOAD_TIMEOUT_MS,
    });

    await expect(page.getByTestId('dashboard-subtab-shift-closeout')).toBeVisible();
    const scadaPanel = page.getByTestId('scada-excavator-machines-panel');
    await expect(scadaPanel).toBeVisible({ timeout: PAGE_LOAD_TIMEOUT_MS });
    await expect(page.getByTestId('scada-connection-status-badge')).toBeVisible();

    await expect(page).toHaveScreenshot('control-room-dashboard.png', {
      fullPage: true,
      threshold: 0.02,
      mask: [
        page.locator('[data-testid="eve-status-bar"]'),
        page.locator('time'),
        page.getByTestId('scada-connection-status-badge'),
      ],
    });
  });

  test('Control Room SCADA Telemetry Panel card matches visual baseline', async ({ page }) => {
    await page.goto('/control-room');
    const scadaPanel = page.getByTestId('scada-excavator-machines-panel');
    await expect(scadaPanel).toBeVisible({ timeout: PAGE_LOAD_TIMEOUT_MS });

    await expect(scadaPanel).toHaveScreenshot('control-room-scada-panel.png', {
      threshold: 0.02,
      mask: [page.getByTestId('scada-connection-status-badge')],
    });
  });

  test('Control Room Shift Closeout page & Pre-Closeout SMR Readiness Gate match visual baseline', async ({
    page,
  }) => {
    await page.goto('/control-room/shift-closeout');
    await expect(page.getByTestId('shift-closeout-readiness-banner')).toBeVisible({
      timeout: PAGE_LOAD_TIMEOUT_MS,
    });

    await expect(page).toHaveScreenshot('control-room-shift-closeout.png', {
      fullPage: true,
      threshold: 0.02,
      mask: [page.locator('[data-testid="eve-status-bar"]'), page.locator('time')],
    });
  });
});
