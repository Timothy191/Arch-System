import { expect, test } from '@playwright/test';
import { AUTH_FILE } from './helpers/auth';

const PAGE_LOAD_TIMEOUT_MS = 15000;

test.describe('Control Room Shift Closeout E2E (TASK-10.6)', () => {
  test.use({ storageState: AUTH_FILE });

  test('switches to Shift Closeout tab, toggles Day/Night Shift, and verifies Lock & Sign Shift action state', async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto('/control-room/shift-compilation');
    await expect(page.getByRole('heading', { name: 'Shift Operations' })).toBeVisible({
      timeout: PAGE_LOAD_TIMEOUT_MS,
    });

    // Switch to Shift Closeout tab
    const closeoutTab = page.getByRole('tab', { name: /Shift Closeout/i });
    await expect(closeoutTab).toBeVisible();
    await closeoutTab.click();
    await expect(closeoutTab).toHaveAttribute('aria-selected', 'true');

    // Verify Shift Production & SMR Ledger renders
    await expect(page.getByRole('heading', { name: 'Shift Production & SMR Ledger' })).toBeVisible({
      timeout: PAGE_LOAD_TIMEOUT_MS,
    });

    // Verify Day Shift / Night Shift selector and toggle between shifts
    const shiftSelect = page.locator('form select').first();
    await expect(shiftSelect).toBeVisible();
    await expect(shiftSelect).toContainText('Day Shift');
    await expect(shiftSelect).toContainText('Night Shift');

    await shiftSelect.selectOption('day');
    await expect(shiftSelect).toHaveValue('day');

    await shiftSelect.selectOption('night');
    await expect(shiftSelect).toHaveValue('night');

    // Verify handover verification checklist & summary notes
    await expect(page.getByText(/Shift Handover Verification & Notes/i)).toBeVisible();
    const notesTextarea = page.getByPlaceholder(/Optional shift handover summary notes/i);
    await expect(notesTextarea).toBeVisible();
    await notesTextarea.fill('All SMR readings reconciled for shift closeout verification.');
    await expect(notesTextarea).toHaveValue(
      'All SMR readings reconciled for shift closeout verification.'
    );

    // Verify Lock & Sign Shift action button state
    const lockButton = page.getByRole('button', {
      name: /Lock Shift & Compile Ledger|Lock Shift \(Local Queue\)|Lock & Sign Shift/i,
    });
    await expect(lockButton).toBeVisible();
    await expect(lockButton).toBeEnabled();
    expect(pageErrors).toEqual([]);
  });
});
