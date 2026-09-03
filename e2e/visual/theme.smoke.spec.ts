import { test, expect } from "@playwright/test";

test("light-mode liquid glass background should be pure white with rgba tint", async ({ page }) => {
  page.on("request", (req) => console.log("Request:", req.url(), req.resourceType()));
  page.on("requestfailed", (req) =>
    console.log("Request Failed:", req.url(), req.failure()?.errorText),
  );
  page.on("response", (res) => {
    if (res.url().includes("webm") || res.url().includes("mp4") || res.status() >= 400) {
      console.log("Response:", res.url(), res.status(), res.statusText());
    }
  });

  await page.goto("/hub");

  // 1. Verify the route background tint has the exact color from glass.css
  const bgTint = page.locator(".route-bg-tint");
  await expect(bgTint).toBeAttached();

  const bgColor = await bgTint.evaluate((el) => getComputedStyle(el).backgroundColor);
  const viewportSize = page.viewportSize();
  const isMobileOrTablet = viewportSize && viewportSize.width <= 768;
  const expectedBgColor = isMobileOrTablet
    ? "rgba(255, 255, 255, 0.7)"
    : "rgba(255, 255, 255, 0.5)";
  expect(bgColor).toBe(expectedBgColor);

  // 2. Check that a key token variable (arch0) is defined and used
  const htmlBackground = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--arch0"),
  );
  expect(["#ffffff", "#fff"]).toContain(htmlBackground.trim().toLowerCase());

  // 3. Verify the video element exists and is playing/loaded
  const videoLocator = page.locator("#route-bg-light-video");
  await expect(videoLocator).toBeAttached();

  // Wait for the video metadata to load (readyState >= 2)
  await page.waitForFunction(
    () => {
      const video = document.querySelector("#route-bg-light-video") as HTMLVideoElement;
      return video && video.readyState >= 2;
    },
    { timeout: 15000 },
  );

  const videoState = await page.evaluate(() => {
    const video = document.querySelector("#route-bg-light-video") as HTMLVideoElement;
    return {
      exists: true,
      paused: video.paused,
      currentTime: video.currentTime,
      readyState: video.readyState,
      src: video.currentSrc || video.src,
      networkState: video.networkState,
    };
  });

  console.log("Video State:", videoState);
  expect(videoState.src).toMatch(/edge-of-the-event-horizon|837668e02b8cc6414cd7a78c19d1746c/);

  // 4. SOTA Synthetic Performance & Layout Stability Probe
  const perfMetrics = await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    return {
      domContentLoaded: nav ? nav.domContentLoadedEventEnd - nav.startTime : 0,
      loadTime: nav ? nav.loadEventEnd - nav.startTime : 0,
    };
  });
  console.log("Synthetic Navigation Metrics (ms):", perfMetrics);

  // 5. Visual Theme Screenshot Check
  await expect(page).toHaveScreenshot("light-glass-background.png", {
    fullPage: false,
  });
});
