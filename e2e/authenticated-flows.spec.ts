import { test, expect } from "@playwright/test";
import { performMockLogin } from "./helpers/auth";

test.describe("Authenticated User Flows", () => {
  test.beforeEach(async ({ page }) => {
    await performMockLogin(page, "admin");
  });

  test.describe("Navigation between departments", () => {
    test("can navigate from hub to drilling department", async ({ page }) => {
      await page.goto("/hub");
      await page.goto("/drilling");
      await expect(page).toHaveURL(/.*\/drilling/);
      await expect(page.getByRole("heading", { name: /drilling/i })).toBeVisible();
    });

    test("can navigate from drilling to production", async ({ page }) => {
      await page.goto("/drilling");
      await page.goto("/production");
      await expect(page).toHaveURL(/.*\/production/);
      await expect(page.getByRole("heading", { name: /production/i })).toBeVisible();
    });

    test("can navigate between all departments", async ({ page }) => {
      const departments = [
        "drilling",
        "production",
        "safety",
        "engineering",
        "control-room",
        "training",
        "access-control",
        "satellite-monitoring",
      ];

      for (const dept of departments) {
        await page.goto(`/${dept}`);
        await expect(page).toHaveURL(new RegExp(`.*\\/${dept}`));
        // Verify page loads without errors
        await expect(page.locator("body")).toBeVisible();
      }
    });

    test("can access department sub-pages", async ({ page }) => {
      await page.goto("/drilling/machines");
      await expect(page).toHaveURL(/.*\/drilling\/machines/);

      await page.goto("/production/daily-log");
      await expect(page).toHaveURL(/.*\/production\/daily-log/);

      await page.goto("/engineering/breakdowns");
      await expect(page).toHaveURL(/.*\/engineering\/breakdowns/);
    });
  });

  test.describe("Data entry workflows", () => {
    test("can access daily log form in drilling", async ({ page }) => {
      await page.goto("/drilling/daily-log");
      await expect(page).toHaveURL(/.*\/drilling\/daily-log/);

      // Check for form elements
      const form = page.locator("form").first();
      await expect(form).toBeVisible();
    });

    test("can access daily log form in production", async ({ page }) => {
      await page.goto("/production/daily-log");
      await expect(page).toHaveURL(/.*\/production\/daily-log/);

      const form = page.locator("form").first();
      await expect(form).toBeVisible();
    });

    test("can access breakdown form in engineering", async ({ page }) => {
      await page.goto("/engineering/breakdowns");
      await expect(page).toHaveURL(/.*\/engineering\/breakdowns/);

      // Check for breakdown form elements
      await expect(page.getByText(/breakdown/i)).toBeVisible();
    });

    test("can access machine operations in control-room", async ({ page }) => {
      await page.goto("/control-room/machine-operations");
      await expect(page).toHaveURL(/.*\/control-room\/machine-operations/);

      await expect(page.getByText("Machine Operations")).toBeVisible();
      await expect(page.getByText("Today's Operations")).toBeVisible();
    });
  });

  test.describe("Feature usage after login", () => {
    test("can access tools page", async ({ page }) => {
      await page.goto("/drilling/tools");
      await expect(page).toHaveURL(/.*\/drilling\/tools/);
      await expect(page.getByText(/tools/i)).toBeVisible();
    });

    test("can access reports page", async ({ page }) => {
      await page.goto("/production/reports");
      await expect(page).toHaveURL(/.*\/production\/reports/);
      await expect(page.getByText(/reports/i)).toBeVisible();
    });

    test("can access executive dashboard", async ({ page }) => {
      await page.goto("/hub/executive");
      await expect(page).toHaveURL(/.*\/hub\/executive/);
      await expect(page.getByRole("heading", { name: "Executive Dashboard" })).toBeVisible();
    });

    test("can access admin panel", async ({ page }) => {
      await page.goto("/admin");
      await expect(page).toHaveURL(/.*\/admin/);
      // Admin panel should load (may have additional auth checks)
      await expect(page.locator("body")).toBeVisible();
    });
  });

  test.describe("Department-specific workflows", () => {
    test("drilling department workflow", async ({ page }) => {
      // Navigate to drilling
      await page.goto("/drilling");

      // Access machines
      await page.goto("/drilling/machines");
      await expect(page).toHaveURL(/.*\/drilling\/machines/);

      // Access daily log
      await page.goto("/drilling/daily-log");
      await expect(page).toHaveURL(/.*\/drilling\/daily-log/);

      // Access tools
      await page.goto("/drilling/tools");
      await expect(page).toHaveURL(/.*\/drilling\/tools/);
    });

    test("control-room workflow", async ({ page }) => {
      // Navigate to control-room
      await page.goto("/control-room");

      // Access machine operations
      await page.goto("/control-room/machine-operations");
      await expect(page).toHaveURL(/.*\/control-room\/machine-operations/);

      // Access hourly loads
      await page.goto("/control-room/hourly-loads");
      await expect(page).toHaveURL(/.*\/control-room\/hourly-loads/);

      // Access operational delays
      await page.goto("/control-room/operational-delays");
      await expect(page).toHaveURL(/.*\/control-room\/operational-delays/);
    });

    test("engineering workflow", async ({ page }) => {
      await page.goto("/engineering");

      // Access breakdowns
      await page.goto("/engineering/breakdowns");
      await expect(page).toHaveURL(/.*\/engineering\/breakdowns/);

      // Navigate back to main engineering page
      await page.goto("/engineering");
      await expect(page).toHaveURL(/.*\/engineering/);
    });
  });

  test.describe("UI persistence during navigation", () => {
    test("maintains theme during navigation", async ({ page }) => {
      await page.goto("/drilling");

      // Check for light theme
      const themeScript = await page.evaluate(() => {
        return document.documentElement.getAttribute("data-theme");
      });
      expect(themeScript).toBe("light");

      await page.goto("/production");
      const themeAfterNav = await page.evaluate(() => {
        return document.documentElement.getAttribute("data-theme");
      });
      expect(themeAfterNav).toBe("light");
    });

    test("navigation does not show forbidden shadow classes", async ({ page }) => {
      await page.goto("/drilling");
      let html = await page.content();

      const forbiddenPatterns = [
        'shadow-sm"',
        'shadow-md"',
        'shadow-lg"',
        'shadow-xl"',
        'shadow-2xl"',
      ];

      for (const pattern of forbiddenPatterns) {
        expect(html).not.toContain(pattern);
      }

      await page.goto("/production");
      html = await page.content();

      for (const pattern of forbiddenPatterns) {
        expect(html).not.toContain(pattern);
      }
    });
  });
});
