import { expect, test } from '@playwright/test';
import { AUTH_FILE } from '../helpers/auth';

test.describe('Control Room Operations', () => {
  test.describe('authenticated access', () => {
    test.use({ storageState: AUTH_FILE });

    test('loads unified control room dashboard', async ({ page }) => {
      await page.goto('/control-room');
      await expect(page.getByRole('heading', { name: 'Control Room Operations' })).toBeVisible({
        timeout: 15000,
      });
      await expect(page.getByText('END OF SHIFT PROCEDURES')).toBeVisible();
    });

    test('displays Shift Production & SMR Ledger form', async ({ page }) => {
      await page.goto('/control-room');

      // Verify the new refactored ledger card is visible
      await expect(
        page.getByRole('heading', { name: 'Shift Production & SMR Ledger' })
      ).toBeVisible({
        timeout: 15000,
      });

      // Check if shift options exist
      const shiftSelect = page.locator('select');
      await expect(shiftSelect).toBeVisible();
      await expect(shiftSelect).toContainText('Day Shift');
      await expect(shiftSelect).toContainText('Night Shift');

      // Check if the lock button exists
      const lockButton = page.getByRole('button', {
        name: /Lock Shift & Compile Ledger|Lock Shift \(Local Cache\)/i,
      });
      await expect(lockButton).toBeVisible();
    });
  });
});
