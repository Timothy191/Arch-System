import { expect, test } from '@playwright/test';
import { AUTH_FILE } from './helpers/auth';

const PAGE_LOAD_TIMEOUT_MS = 15000;

test.describe('Control Room Alerts & Target Status E2E (TASK-10.7)', () => {
  test.use({ storageState: AUTH_FILE });

  test('renders Control Room alerts and target status panel and filters horizons', async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto('/control-room');
    await expect(page.getByRole('heading', { name: 'Control Room Dashboard' })).toBeVisible({
      timeout: PAGE_LOAD_TIMEOUT_MS,
    });

    // Verify the Alerts / Operational Target & KPI Attainment panel renders
    const alertPanel = page.getByTestId('control-room-targets-visual-panel');
    await expect(alertPanel).toBeVisible({ timeout: PAGE_LOAD_TIMEOUT_MS });
    await expect(
      alertPanel.getByRole('heading', { name: /Operational Target Graphs & KPI Attainment/i })
    ).toBeVisible();

    // Test horizon filtering interaction (Shift -> Daily -> Monthly -> Shift)
    const horizonTablist = alertPanel.getByRole('tablist', { name: /Target Horizon Selector/i });
    await expect(horizonTablist).toBeVisible();

    const shiftTab = horizonTablist.getByRole('tab', { name: /Shift/i });
    const dailyTab = horizonTablist.getByRole('tab', { name: /Daily/i });
    const monthlyTab = horizonTablist.getByRole('tab', { name: /Monthly/i });

    await dailyTab.click();
    await expect(dailyTab).toHaveAttribute('aria-selected', 'true');
    await expect(alertPanel.getByText(/DAILY PLAN INDEX/i)).toBeVisible();

    await monthlyTab.click();
    await expect(monthlyTab).toHaveAttribute('aria-selected', 'true');
    await expect(alertPanel.getByText(/MONTHLY PLAN INDEX/i)).toBeVisible();

    await shiftTab.click();
    await expect(shiftTab).toHaveAttribute('aria-selected', 'true');
    await expect(alertPanel.getByText(/SHIFT PLAN INDEX/i)).toBeVisible();

    // Verify Shift Activity Feed & refresh interaction
    await expect(page.getByRole('heading', { name: 'Shift Activity Feed' })).toBeVisible();
    const refreshFeedButton = page.getByRole('button', { name: /Refresh Shift Activity Feed/i });
    await expect(refreshFeedButton).toBeVisible();
    await refreshFeedButton.click();

    expect(pageErrors).toEqual([]);
  });
});
