import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  snapshotDir: "./e2e/visual/__snapshots__",
  projects: [
    {
      name: "chromium",
      use: {
        browserName: "chromium",
        launchOptions: { executablePath: "/usr/bin/google-chrome" },
      },
    },
  ],
  use: {
    baseURL: "http://localhost:3000",
    screenshot: "only-on-failure",
    userAgent: "Playwright/E2E-Tests",
  },
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.02,
    },
  },
});
