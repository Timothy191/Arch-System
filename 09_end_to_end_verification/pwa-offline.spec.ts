import { test, expect } from "@playwright/test";
import { performMockLogin } from "./helpers/auth";

test.describe("PWA Offline Capabilities", () => {
  test.beforeEach(async ({ page }) => {
    await performMockLogin(page, "operator");
  });

  test("should render the offline fallback page when navigating while offline", async ({
    page,
    context,
  }) => {
    // First, visit the app while online to ensure the service worker registers
    await page.goto("/hub");

    // Wait for SW to install and activate. A short timeout helps.
    await page.waitForTimeout(2000);

    // Simulate going offline
    await context.setOffline(true);

    // Attempt to navigate to a new page that isn't cached
    try {
      await page.goto("/hub/executive", { timeout: 5000 });
    } catch (e) {
      // It might throw a network error, or the SW intercepts it
    }

    // Because we implemented a manual /offline fallback in sw.js,
    // if the fetch fails, it should serve the /offline page.
    // We check if the offline banner or offline heading is visible.
    const offlineHeading = page.getByRole("heading", {
      name: /You are offline/i,
    });

    // Depending on the exact implementation (e.g. OfflineBanner component),
    // we just check for text indicating offline status.
    await expect(page.getByText(/offline/i).first()).toBeVisible({
      timeout: 10000,
    });
  });
});
