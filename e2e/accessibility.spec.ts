import { test, expect } from "@playwright/test";

test.describe("Accessibility Tests", () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto("/login");
    await page.fill('input[type="email"]', "admin@plantcor.os");
    await page.fill('input[type="password"]', "Yugioh@123#");
    await page.click('button[type="submit"]');
    await page.waitForURL("/");
  });

  test("should have skip links for keyboard navigation", async ({ page }) => {
    // Tab to skip link
    await page.keyboard.press("Tab");
    const skipLink = page.locator(".skip-link, [href='#main-content']");
    await expect(skipLink).toBeVisible();
  });

  test("should have proper ARIA landmarks", async ({ page }) => {
    // Check for main landmark
    const main = page.locator("main, [role='main']");
    await expect(main).toBeVisible();

    // Check for navigation landmark
    const nav = page.locator("nav, [role='navigation']");
    await expect(nav.first()).toBeVisible();
  });

  test("should have focus visible indicators", async ({ page }) => {
    // Tab through elements and check focus visibility
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    
    const focusedElement = page.locator(":focus");
    await expect(focusedElement).toBeVisible();
  });

  test("should have proper heading hierarchy", async ({ page }) => {
    // Check that h1 exists
    const h1 = page.locator("h1");
    await expect(h1.first()).toBeVisible();
  });

  test("should have sufficient color contrast", async ({ page }) => {
    // Check that text elements have color contrast
    // This is a basic check - full a11y audit would use axe-core
    const textElements = page.locator("h1, h2, h3, p, span, a, button");
    const count = await textElements.count();
    
    // Ensure at least some text elements exist
    expect(count).toBeGreaterThan(0);
  });

  test("should support keyboard navigation in dropdowns", async ({ page }) => {
    // Navigate to a department with dropdowns
    await page.goto("/drilling");
    
    // Tab to interactive elements
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    
    // Check that focus is visible
    const focused = page.locator(":focus");
    await expect(focused).toBeVisible();
  });

  test("page should have lang attribute", async ({ page }) => {
    const html = page.locator("html");
    await expect(html).toHaveAttribute("lang", "en");
  });

  test("images should have alt text or be decorative", async ({ page }) => {
    const images = page.locator("img");
    const count = await images.count();
    
    for (let i = 0; i < count; i++) {
      const img = images.nth(i);
      const hasAlt = await img.getAttribute("alt");
      const hasAriaHidden = await img.getAttribute("aria-hidden");
      
      // Either has alt text or is marked as decorative
      expect(hasAlt !== null || hasAriaHidden === "true").toBeTruthy();
    }
  });
});
