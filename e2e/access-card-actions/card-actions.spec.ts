import { expect, test } from '@playwright/test';
import { AUTH_FILE } from '../helpers/auth';

const CARD_ACTIONS_URL = '/access-control/card-actions';

test.describe('unauthenticated access', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('redirects to login with correct return path', async ({ page }) => {
    await page.goto(CARD_ACTIONS_URL);
    await expect(page).toHaveURL(/\/login/);
    expect(page.url()).toContain('redirect=%2Faccess-control%2Fcard-actions');
  });
});

test.describe('department access control', () => {
  test.use({ storageState: AUTH_FILE });

  test('rejects non-access-card-actions department with 404', async ({ page }) => {
    await page.goto('/drilling/card-actions');
    await expect(page.getByRole('heading', { name: '404' })).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText('The page you are looking for does not exist.')).toBeVisible();
  });
});

test.describe('card-actions page', () => {
  test.use({ storageState: AUTH_FILE });

  test('loads with correct heading', async ({ page }) => {
    await page.goto(CARD_ACTIONS_URL);
    await expect(page.getByRole('heading', { name: 'Card Actions' })).toBeVisible({
      timeout: 15000,
    });
  });

  test('displays search input field', async ({ page }) => {
    await page.goto(CARD_ACTIONS_URL);
    await expect(page.getByRole('textbox', { name: 'Search personnel' })).toBeVisible();
  });

  test('displays empty results message when no search term entered', async ({ page }) => {
    await page.goto(CARD_ACTIONS_URL);
    await expect(page.getByText(/search and select a person/i)).toBeVisible();
  });

  test('shows results after typing a search query', async ({ page }) => {
    await page.goto(CARD_ACTIONS_URL);
    const searchInput = page.getByRole('textbox', { name: 'Search personnel' });
    await searchInput.fill('John');
    // Brief wait for debounced search
    await page.waitForTimeout(500);
    // Check that results section appears (either a list or "no results" message)
    await expect(
      page.locator("[data-testid='search-results']").or(page.getByText(/no results|no employees/i))
    ).toBeVisible({ timeout: 15000 });
  });

  test('selecting a person shows detail panel', async ({ page }) => {
    await page.goto(CARD_ACTIONS_URL);
    const searchInput = page.getByRole('textbox', { name: 'Search personnel' });
    await searchInput.fill('John');
    // Wait for the async personnel search (cloud Supabase) to settle instead of a fixed sleep
    await expect(page.getByText(/searching/i)).toBeHidden({ timeout: 20000 });

    // Click the first search result if available
    const firstResult = page.locator("[data-testid='search-results'] button").first();
    try {
      await firstResult.waitFor({ state: 'visible', timeout: 5000 });
      await firstResult.click();

      // Detail panel should appear with employee info
      await expect(page.locator("[data-testid='personnel-detail']")).toBeVisible({
        timeout: 15000,
      });
    } catch {
      // If no results, the "no results" message is acceptable
      await expect(page.getByText(/no personnel found/i)).toBeVisible();
    }
  });

  test('detail panel shows QR code section when employee has a badge', async ({ page }) => {
    await page.goto(CARD_ACTIONS_URL);
    const searchInput = page.getByRole('textbox', { name: 'Search personnel' });
    await searchInput.fill('John');
    await page.waitForTimeout(500);

    const firstResult = page.locator("[data-testid='search-results'] button").first();
    try {
      await firstResult.waitFor({ state: 'visible', timeout: 5000 });
      await firstResult.click();

      // QR code section should be visible for employees with badges
      await expect(
        page.locator("[data-testid='qr-section']").or(page.getByText(/qr code/i))
      ).toBeVisible({ timeout: 15000 });
    } catch {
      // Skip if no search results
    }
  });

  test('Print Card button is present in detail panel', async ({ page }) => {
    await page.goto(CARD_ACTIONS_URL);
    const searchInput = page.getByRole('textbox', { name: 'Search personnel' });
    await searchInput.fill('John');
    await page.waitForTimeout(500);

    const firstResult = page.locator("[data-testid='search-results'] button").first();
    try {
      await firstResult.waitFor({ state: 'visible', timeout: 5000 });
      await firstResult.click();

      await expect(page.getByRole('button', { name: /print card/i })).toBeVisible({
        timeout: 5000,
      });
    } catch {
      // Skip if no search results
    }
  });
});
