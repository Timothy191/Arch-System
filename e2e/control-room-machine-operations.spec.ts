import { expect, test } from '@playwright/test';
import { AUTH_FILE } from './helpers/auth';

const PAGE_LOAD_TIMEOUT_MS = 15000;
const SMR_INCREMENT_HOURS = 1.5;

test.describe('Control Room Machine Operations E2E (TASK-10.5)', () => {
  test.use({ storageState: AUTH_FILE });

  test('navigates to /control-room/machine-operations, auto-populates Start SMR, and updates form state', async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto('/control-room/machine-operations');
    await expect(page.getByRole('heading', { name: 'Machine Operations' })).toBeVisible({
      timeout: PAGE_LOAD_TIMEOUT_MS,
    });
    await expect(page.getByText('Log Machine Operation')).toBeVisible();
    await expect(page.getByText("Today's Operations")).toBeVisible();

    // Select a machine from #machineId (or first form select)
    const machineSelect = page.locator('#machineId, form select').first();
    await expect(machineSelect).toBeVisible();
    await machineSelect.selectOption({ index: 1 });

    // Verify #startSmr (or first number input) auto-populates from machine Close SMR
    const startSmrInput = page.locator('#startSmr, form input[type="number"]').first();
    await expect(startSmrInput).toBeVisible();
    const startSmrValue = Number(await startSmrInput.inputValue());
    expect(startSmrValue).toBeGreaterThan(0);

    // Select Operator and Site
    const operatorSelect = page.locator('form select').nth(1);
    const siteSelect = page.locator('form select').nth(2);
    await expect(operatorSelect).toBeVisible();
    await expect(siteSelect).toBeVisible();

    const operatorOptionsCount = await operatorSelect.locator('option').count();
    if (operatorOptionsCount > 1) {
      await operatorSelect.selectOption({ index: 1 });
    }

    const siteOptionsCount = await siteSelect.locator('option').count();
    if (siteOptionsCount > 1) {
      await siteSelect.selectOption({ index: 1 });
    }

    // Enter Stop SMR and verify calculated Hours Worked state
    const stopSmrInput = page.locator('#stopSmr, form input[type="number"]').nth(1);
    const targetStopSmr = (startSmrValue + SMR_INCREMENT_HOURS).toFixed(1);
    await stopSmrInput.fill(targetStopSmr);

    await expect(page.getByText('Hours Worked:')).toBeVisible();
    await expect(page.getByText(`${SMR_INCREMENT_HOURS.toFixed(2)}h`)).toBeVisible();

    const saveButton = page.getByRole('button', { name: /Save Operation/i });
    await expect(saveButton).toBeVisible();
    await expect(saveButton).toBeEnabled();
    expect(pageErrors).toEqual([]);
  });
});
