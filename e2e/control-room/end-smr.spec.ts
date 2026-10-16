import { expect, test } from '@playwright/test';
import { AUTH_FILE } from '../helpers/auth';

test.describe('End SMR Drilling Integration', () => {
  test.use({ storageState: AUTH_FILE });

  test('should auto-populate Start SMR from previous Close SMR and show drilling section for Drill Rig', async ({
    page,
  }) => {
    // Navigate to Control Room End SMR
    await page.goto('/control-room/end-smr');

    // Wait for the form to load
    await expect(page.locator('text="Record End SMR"')).toBeVisible({ timeout: 15000 });

    // The machine dropdown is the first select
    const machineSelect = page.locator('select').nth(0);
    // Find a Drill Rig option
    const drillRigOption = page.locator('option', { hasText: 'Drill Rig' }).first();
    const drillRigValue = await drillRigOption.getAttribute('value');

    // Select the drill rig
    await machineSelect.selectOption(drillRigValue || '');

    // Verify Start SMR automatically populated from the machine's previous Close SMR
    const startSmrInput = page.locator('input[type="number"]').nth(0);
    const autoStartSmr = Number(await startSmrInput.inputValue());
    expect(autoStartSmr).toBeGreaterThan(0);

    // Now the drilling section should appear
    await expect(page.locator('text="DRILLING PRODUCTION"')).toBeVisible();

    // Select Operator and Site
    await page.locator('select').nth(1).selectOption({ index: 1 });
    await page.locator('select').nth(2).selectOption({ index: 1 });

    // Fill End SMR continuing from the auto-populated Start SMR
    await page
      .locator('input[type="number"]')
      .nth(1)
      .fill(String(autoStartSmr + 0.5));

    // Fill in Drilling Data
    await page.getByPlaceholder('e.g. A12').fill('Pit-A-Bench-04');
    await page.locator('input[type="number"]').nth(2).fill('50.5'); // meters
    await page.locator('input[type="number"]').nth(3).fill('5'); // holes
  });
});
