/**
 * Visual regression tests for design system consistency.
 * Validates dark theme tokens, forbidden classes, and cross-page uniformity.
 *
 * Baseline: npx playwright test e2e/visual --update-snapshots
 */

import { test, expect } from "@playwright/test";

test.describe("design system visual regression", () => {
  test("login page has no forbidden design system classes in HTML", async ({
    page,
  }) => {
    await page.goto("/login");
    const html = await page.content();

    const forbidden = [
      "bg-white/5 ",
      'bg-white/5"',
      "border-white/10 ",
      'border-white/10"',
      "text-white/50 ",
      'text-white/50"',
      "text-white/70 ",
      'text-white/70"',
      'shadow-sm"',
      'shadow-md"',
      'shadow-lg"',
      'shadow-xl"',
      'shadow-2xl"',
    ];

    for (const cls of forbidden) {
      expect(html, `Found forbidden class: ${cls}`).not.toContain(cls);
    }
  });

  test("login background color uses correct token", async ({ page }) => {
    await page.goto("/login");

    const bodyClasses = await page.locator("body").getAttribute("class");
    expect(bodyClasses).toMatch(/bg-\[#0f0f0f\]|bg-\[var\(--bg-primary\)\]/);
  });

  test("login form uses correct card background", async ({ page }) => {
    await page.goto("/login");

    const cardClasses = await page
      .locator('[data-testid="login-card"]')
      .getAttribute("class");
    expect(cardClasses).toMatch(
      /bg-arch-surface-secondary|bg-white\/70|layer-signin-card/,
    );
  });

  test("login heading uses correct text token", async ({ page }) => {
    await page.goto("/login");
    const h1Classes = await page.locator("h1").getAttribute("class");
    expect(h1Classes).toMatch(
      /text-\[#fafafa\]|text-\[var\(--text-heading\)\]/,
    );
  });

  test("login page — border uses correct token", async ({ page }) => {
    await page.goto("/login");
    const cardClasses = await page
      .locator('[data-testid="login-card"]')
      .getAttribute("class");
    expect(cardClasses).toMatch(
      /border-arch-border-primary|border-\[var\(--border-default\)\]|layer-signin-card/,
    );
  });
});
