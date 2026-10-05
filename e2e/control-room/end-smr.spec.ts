import { test, expect } from '@playwright/test';

test.describe('End SMR Drilling Integration', () => {
  test('should show drilling section for Drill Rig and persist data', async ({ page }) => {
    // Navigate to Control Room
    await page.goto('/control-room/end-smr');

    // Wait for the form to load
    await expect(page.locator('text="Record End SMR"')).toBeVisible();

    // The machine dropdown is the first select
    const machineSelect = page.locator('select').nth(0);
    // Find a Drill Rig option
    const drillRigOption = page.locator('option', { hasText: 'Drill Rig' }).first();
    const drillRigValue = await drillRigOption.getAttribute('value');

    // Select the drill rig
    await machineSelect.selectOption(drillRigValue || '');

    // Now the drilling section should appear
    await expect(page.locator('text="DRILLING PRODUCTION"')).toBeVisible();

    // Select Operator and Site just to fulfill validation
    await page.locator('select').nth(1).selectOption({ index: 1 });
    await page.locator('select').nth(2).selectOption({ index: 1 });

    // Fill in Start and End SMR
    await page.locator('input[type="number"]').nth(0).fill('100'); // start SMR
    await page.locator('input[type="number"]').nth(1).fill('110'); // end SMR

    // Fill in Drilling Data
    await page.getByPlaceholder('e.g. A12').fill('BLOCK-A12');
    await page.locator('input[type="number"]').nth(2).fill('50.5'); // meters
    await page.locator('input[type="number"]').nth(3).fill('5'); // holes

    // Submit
    await page.locator('button:has-text("Submit End SMR")').click();

    // Check for success toast
    await expect(page.locator('text="End SMR saved successfully"')).toBeVisible({ timeout: 5000 });
  });
});
