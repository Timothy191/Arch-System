import { test, expect } from "@playwright/test";

test.describe("Visual Regression Smoke Test", () => {
  test("Hub page liquid glass background", async ({ page }) => {
    // Navigate to the hub where the liquid glass background should be visible
    await page.goto("/hub");

    // Wait for network idle to ensure the background video or resources load
    await page.waitForLoadState("networkidle");

    // Optionally, wait for any specific background elements to be visible
    // For example, if there is a specific class like .liquid-glass-bg:
    // await page.waitForSelector('.liquid-glass-bg');

    // Take a screenshot and compare against the baseline
    // The snapshot will be saved to e2e/visual/__snapshots__
    await expect(page).toHaveScreenshot("hub-liquid-glass.png", {
      fullPage: true,
    });
  });
});
