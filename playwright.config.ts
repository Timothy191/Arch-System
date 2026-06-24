import { defineConfig, devices } from "@playwright/test";

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: "./e2e",
  snapshotDir: "./e2e/visual/__snapshots__",
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    userAgent: "Playwright/E2E-Tests",
  },
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.02,
    },
  },

  projects: [
    {
      name: "setup",
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        browserName: "chromium",
        launchOptions: { executablePath: "/usr/bin/google-chrome" },
        storageState: "e2e/.auth/user.json",
      },
      dependencies: ["setup"],
    },
    {
      name: "mobile-chrome",
      use: {
        ...devices["Pixel 5"],
        browserName: "chromium",
        launchOptions: { executablePath: "/usr/bin/google-chrome" },
        storageState: "e2e/.auth/user.json",
      },
      dependencies: ["setup"],
    },
    {
      name: "tablet-chrome",
      use: {
        ...devices["Galaxy Tab S4"],
        browserName: "chromium",
        launchOptions: { executablePath: "/usr/bin/google-chrome" },
        storageState: "e2e/.auth/user.json",
      },
      dependencies: ["setup"],
    },
    // We only support chromium locally as per requirements, but defining mobile sizes
  ],
  webServer: {
    command: "pnpm --filter portal start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
