import { expect, test } from '@playwright/test';
import { performMockLogin } from './helpers/auth';

test.describe('Hybrid Remote Support System', () => {
  test('operator cannot access /admin/support while admin can open the Support Desk', async ({
    page,
  }) => {
    await performMockLogin(page, 'operator');
    await page.goto('/admin/support');
    await expect(page).not.toHaveURL(/.*\/admin\/support/);

    await performMockLogin(page, 'admin');
    await page.goto('/admin/support');
    await expect(page).toHaveURL(/.*\/admin\/support/);
    await expect(page.getByRole('heading', { name: /Arch Support Desk/i })).toBeVisible();
  });

  test('employee sees Remote Assist entry inside Feedback & Support widget', async ({ page }) => {
    await performMockLogin(page, 'operator');
    await page.goto('/hub');

    const supportTrigger = page.getByTitle('Feedback & Support');
    await expect(supportTrigger).toBeVisible();
    await supportTrigger.click();

    await expect(page.getByRole('button', { name: /Remote Assist/i })).toBeVisible();
  });
});
