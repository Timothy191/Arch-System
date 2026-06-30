import { test, expect } from "@playwright/test";

test("light-mode app canvas should be a flat blank background", async ({ page }) => {
  await page.goto("/hub");

  // 1. Flat fallback layer is the active background (no video / grain / tint)
  const bgFallback = page.locator(".route-bg-fallback");
  await expect(bgFallback).toBeAttached();
  await expect(page.locator("#route-bg-video")).toHaveCount(0);
  await expect(page.locator(".route-bg-tint")).toHaveCount(0);
  await expect(page.locator(".route-bg-grain")).toHaveCount(0);

  const fallbackBg = await bgFallback.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(fallbackBg).toBe("rgb(255, 255, 255)");

  // 2. Key token variable (arch0) remains pure white
  const htmlBackground = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--arch0"),
  );
  expect(["#ffffff", "#fff"]).toContain(htmlBackground.trim().toLowerCase());

  // 3. Body uses the primary canvas token
  const bodyBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bodyBg).toBe("rgb(255, 255, 255)");

  // 4. Full-page screenshot for visual comparison
  await expect(page).toHaveScreenshot("light-glass-background.png", {
    fullPage: false,
  });
});
