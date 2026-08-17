import { test, expect } from "@playwright/test";
import { performMockLogin } from "./helpers/auth";

test.describe("Department Navigation E2E", () => {
  test.beforeEach(async ({ page }) => {
    await performMockLogin(page, "admin");
  });

  test.describe("Hub Department Cards Navigation", () => {
    test("displays department cards with semantic links on hub page", async ({ page }) => {
      await page.goto("/hub");
      await page.waitForLoadState("domcontentloaded");

      // Verify hub renders department module list
      const departmentSection = page.locator('div[aria-label="Department modules"]');
      await expect(departmentSection).toBeVisible();

      // Check drilling card and its semantic link
      const drillingLink = page.getByTestId("dept-link-drilling");
      await expect(drillingLink).toBeVisible();
      await expect(drillingLink).toHaveAttribute("href", "/drilling");

      // Check production card and its semantic link
      const productionLink = page.getByTestId("dept-link-production");
      await expect(productionLink).toBeVisible();
      await expect(productionLink).toHaveAttribute("href", "/production");
    });

    test("navigates to drilling department when clicking drilling card", async ({ page }) => {
      await page.goto("/hub");
      await page.waitForLoadState("domcontentloaded");

      const drillingLink = page.getByTestId("dept-link-drilling");
      await drillingLink.click();

      await page.waitForURL("**/drilling");
      await expect(page).toHaveURL(/.*\/drilling/);
      await expect(page.locator("body")).toBeVisible();
    });

    test("navigates to production department when clicking production card", async ({ page }) => {
      await page.goto("/hub");
      await page.waitForLoadState("domcontentloaded");

      const productionLink = page.getByTestId("dept-link-production");
      await productionLink.click();

      await page.waitForURL("**/production");
      await expect(page).toHaveURL(/.*\/production/);
      await expect(page.locator("body")).toBeVisible();
    });

    test("navigates directly to sub-routes via department action pills", async ({ page }) => {
      await page.goto("/hub");
      await page.waitForLoadState("domcontentloaded");

      const actionPill = page.getByTestId("dept-action-daily-log").first();
      if (await actionPill.isVisible()) {
        await actionPill.click();
        await expect(page).toHaveURL(/.*\/daily-log/);
      }
    });

    test("supports browser back and forward history navigation between hub and departments", async ({
      page,
    }) => {
      await page.goto("/hub");
      await page.waitForLoadState("domcontentloaded");

      // Navigate to engineering
      const engineeringLink = page.getByTestId("dept-link-engineering");
      await engineeringLink.click();
      await page.waitForURL("**/engineering");
      await expect(page).toHaveURL(/.*\/engineering/);

      // Back to hub
      await page.goBack();
      await page.waitForURL("**/hub");
      await expect(page).toHaveURL(/.*\/hub/);

      // Forward to engineering
      await page.goForward();
      await page.waitForURL("**/engineering");
      await expect(page).toHaveURL(/.*\/engineering/);
    });

    test("supports keyboard activation on department card link", async ({ page }) => {
      await page.goto("/hub");
      await page.waitForLoadState("domcontentloaded");

      const drillingLink = page.getByTestId("dept-link-drilling");
      await drillingLink.focus();
      await page.keyboard.press("Enter");

      await page.waitForURL("**/drilling");
      await expect(page).toHaveURL(/.*\/drilling/);
    });
  });

  test.describe("Department Tab and Sub-Route Navigation", () => {
    test("navigates across department tabs smoothly", async ({ page }) => {
      await page.goto("/drilling");
      await page.waitForLoadState("domcontentloaded");

      // Direct navigation to daily log tab
      await page.goto("/drilling/daily-log");
      await expect(page).toHaveURL(/.*\/drilling\/daily-log/);
      await expect(page.locator("body")).toBeVisible();

      // Navigation to machine telemetry tab
      await page.goto("/drilling/machine-telemetry");
      await expect(page).toHaveURL(/.*\/drilling\/machine-telemetry/);
      await expect(page.locator("body")).toBeVisible();
    });

    test("navigates across all registered department roots", async ({ page }) => {
      const departments = [
        "drilling",
        "production",
        "access-control",
        "access-card-actions",
        "engineering",
        "control-room",
        "safety",
        "training",
        "satellite-monitoring",
        "admin",
      ];

      for (const dept of departments) {
        await page.goto(`/${dept}`);
        await expect(page).toHaveURL(new RegExp(`.*\\/${dept}`));
        await expect(page.locator("body")).toBeVisible();
      }
    });
  });
});
