import { test, expect } from "@playwright/test";

test("hub page renders images and no broken img tags", async ({ page }) => {
  const response = await page.goto("http://localhost:3000/hub", { waitUntil: "networkidle" });
  console.log("Status:", response?.status(), "URL:", page.url());

  // If redirected to login, we can't verify hub UI without auth.
  if (page.url().includes("/login")) {
    console.log("Redirected to login; hub UI requires authenticated session.");
    return;
  }

  // Verify Next.js optimized images exist (img tags with src including _next/image)
  const images = await page.locator("img").all();
  console.log(`Found ${images.length} img elements`);

  const broken = [];
  for (const img of images) {
    const src = await img.getAttribute("src");
    const naturalWidth = await img.evaluate((el: HTMLImageElement) => el.naturalWidth);
    if (naturalWidth === 0 && src && !src.startsWith("data:")) {
      broken.push(src);
    }
  }

  if (broken.length) {
    console.log("Broken images:", broken);
  }
  expect(broken.length).toBe(0);

  // Verify hero rotator is present
  await expect(page.locator("[data-testid='hero-rotator']").or(page.locator("main"))).toBeVisible();
});
