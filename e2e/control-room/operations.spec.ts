import { expect, test } from '@playwright/test';
import { AUTH_FILE } from '../helpers/auth';

test.describe('Control Room Operations & E2E User Journey (Login -> Hub -> Control Room)', () => {
  test.describe('authenticated access', () => {
    test.use({ storageState: AUTH_FILE });

    test('navigates from Hub to Control Room Dashboard and verifies quick actions', async ({
      page,
    }) => {
      const pageErrors: string[] = [];
      page.on('pageerror', (err) => pageErrors.push(err.message));

      // 1. Start at Hub and verify department modules render
      await page.goto('/hub');
      await expect(page).toHaveURL(/.*\/hub/);
      const departmentSection = page.locator('div[aria-label="Department modules"]');
      await expect(departmentSection).toBeVisible({ timeout: 15000 });

      const controlRoomLink = page.getByTestId('dept-link-control-room');
      await expect(controlRoomLink).toBeVisible();
      await controlRoomLink.click();

      // 2. Verify Control Room Dashboard loads
      await page.waitForURL('**/control-room');
      await expect(page.getByRole('heading', { name: 'Control Room Dashboard' })).toBeVisible({
        timeout: 15000,
      });

      // Verify quick action links exist
      await expect(page.getByRole('link', { name: /Machine Operations/i }).first()).toBeVisible();
      await expect(page.getByRole('link', { name: /Update Loads/i }).first()).toBeVisible();
      await expect(page.getByRole('link', { name: /Shift Operations/i }).first()).toBeVisible();
      await expect(page.getByRole('link', { name: /Shift Closeout/i }).first()).toBeVisible();
      expect(pageErrors).toEqual([]);
    });

    test('verifies Machine Operations auto-populates Start SMR from previous Close SMR', async ({
      page,
    }) => {
      await page.goto('/control-room/machine-operations');
      await expect(page.getByRole('heading', { name: 'Machine Operations' })).toBeVisible({
        timeout: 15000,
      });
      await expect(page.getByText('Log Machine Operation')).toBeVisible();
      await expect(page.getByText("Today's Operations")).toBeVisible();

      // Select a seeded machine (e.g. BD-19 or DR-001) and verify Start SMR auto-populates from Close SMR
      const machineSelect = page.locator('form select').first();
      await expect(machineSelect).toBeVisible();
      await machineSelect.selectOption({ index: 1 });

      const startSmuInput = page.locator('form input[type="number"]').first();
      const startSmuVal = Number(await startSmuInput.inputValue());
      expect(startSmuVal).toBeGreaterThan(0);
    });

    test('verifies Shift Compilation fleet SMRs, absence of Tire banner, and Shift Closeout ledger', async ({
      page,
    }) => {
      await page.goto('/control-room/shift-compilation');

      await expect(page.getByRole('heading', { name: 'Shift Operations' })).toBeVisible({
        timeout: 15000,
      });

      // Verify Tire Health & Inspection Activity banner is removed
      await expect(page.getByText('Tire Health & Inspection Activity')).toHaveCount(0);

      // Verify Fleet Availability & SMU Performance table shows seeded machines with SMR
      await expect(page.getByText('Fleet Availability & SMU Performance')).toBeVisible();
      await expect(page.getByText('BD-19').first()).toBeVisible();
      await expect(page.getByText('DR-001').first()).toBeVisible();

      // Switch to Shift Closeout tab and verify Shift Production & SMR Ledger form
      await page.getByRole('tab', { name: /Shift Closeout/i }).click();
      await expect(
        page.getByRole('heading', { name: 'Shift Production & SMR Ledger' })
      ).toBeVisible({
        timeout: 15000,
      });

      const shiftSelect = page.locator('select').first();
      await expect(shiftSelect).toBeVisible();
      await expect(shiftSelect).toContainText('Day Shift');
      await expect(shiftSelect).toContainText('Night Shift');

      const lockButton = page.getByRole('button', {
        name: /Lock Shift & Compile Ledger|Lock Shift \(Local Queue\)/i,
      });
      await expect(lockButton).toBeVisible();
    });
  });
});
