import { test, expect } from "@playwright/test";

test("light-mode liquid glass background should be pure white with rgba tint", async ({ page }) => {
  await page.goto("/hub");

  // 1. Verify the route background tint has the exact color from glass.css
  const bgTint = page.locator(".route-bg-tint");
  await expect(bgTint).toBeAttached();

  const bgColor = await bgTint.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(bgColor).toBe("rgba(255, 255, 255, 0.38)");

  // 2. Check that a key token variable (arch0) is defined and used
  const htmlBackground = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--arch0"),
  );
  expect(["#ffffff", "#fff"]).toContain(htmlBackground.trim().toLowerCase());

  // 3. Verify the canonical wave video is the active background
  const videoLocator = page.locator("#route-bg-video");
  await expect(videoLocator).toBeAttached();

  await page.waitForFunction(
    () => {
      const video = document.querySelector("#route-bg-video") as HTMLVideoElement;
      return video && video.readyState >= 2;
    },
    { timeout: 15000 },
  );

  const videoState = await page.evaluate(() => {
    const video = document.querySelector("#route-bg-video") as HTMLVideoElement;
    return {
      src: video.currentSrc || video.src,
    };
  });

  expect(videoState.src).toContain("white-geometric-waves.3840x2160.mp4");
  await expect(page.locator(".route-bg-canvas")).toHaveCount(0);

  // 4. Full-page screenshot for visual comparison
  await expect(page).toHaveScreenshot("light-glass-background.png", {
    fullPage: false,
  });
});
