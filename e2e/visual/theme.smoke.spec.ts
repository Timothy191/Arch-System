import { test, expect } from "@playwright/test";

test("light-mode liquid glass background should be pure white with rgba tint", async ({
  page,
}) => {
  page.on("request", (req) =>
    console.log("Request:", req.url(), req.resourceType()),
  );
  page.on("requestfailed", (req) =>
    console.log("Request Failed:", req.url(), req.failure()?.errorText),
  );
  page.on("response", (res) => {
    if (res.url().includes("mp4") || res.status() >= 400) {
      console.log("Response:", res.url(), res.status(), res.statusText());
    }
  });

  await page.goto("/hub");

  // 1. Verify the route background tint has the exact color from glass.css
  const bgTint = page.locator(".route-bg-tint");
  await expect(bgTint).toBeAttached();

  const bgColor = await bgTint.evaluate(
    (el) => getComputedStyle(el).backgroundColor,
  );
  expect(bgColor).toBe("rgba(255, 255, 255, 0.5)");

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
      const video = document.querySelector(
        "#route-bg-light-video",
      ) as HTMLVideoElement;
      return video && video.readyState >= 2;
    },
    { timeout: 15000 },
  );

  const videoState = await page.evaluate(() => {
    const video = document.querySelector(
      "#route-bg-light-video",
    ) as HTMLVideoElement;
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
  expect(videoState.src).toContain("light-mode.mp4");

  // 4. (Optional) Full‑page screenshot for visual comparison
  await expect(page).toHaveScreenshot("light-glass-background.png", {
    fullPage: false,
  });
});
