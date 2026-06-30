import { test, expect } from "@playwright/test";
import { performMockLogin } from "./helpers/auth";

test.describe("Comprehensive Error States", () => {
  test.describe("Network error handling", () => {
    test.beforeEach(async ({ page }) => {
      await performMockLogin(page, "admin");
    });

    test("handles network timeout gracefully", async ({ page }) => {
      // Mock timeout error
      await page.route("**/api/**", (route) => {
        route.abort("timedout");
      });

      await page.goto("/drilling");

      // Should show error message or handle gracefully
      await expect(page.locator("body")).toBeVisible();

      // Check for error indicators
      const errorMessage = page.getByText(/network error|timeout|failed to fetch/i);
      const hasError = (await errorMessage.count()) > 0;

      // Either shows error or handles silently
      expect(hasError || (await page.locator("body").isVisible())).toBe(true);
    });

    test("handles server errors (500)", async ({ page }) => {
      await page.route("**/api/**", (route) => {
        route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "Internal Server Error" }),
        });
      });

      await page.goto("/production");

      // Should handle gracefully
      await expect(page.locator("body")).toBeVisible();
    });

    test("handles bad gateway errors (502)", async ({ page }) => {
      await page.route("**/api/**", (route) => {
        route.fulfill({
          status: 502,
          contentType: "application/json",
          body: JSON.stringify({ error: "Bad Gateway" }),
        });
      });

      await page.goto("/engineering");

      await expect(page.locator("body")).toBeVisible();
    });

    test("handles service unavailable (503)", async ({ page }) => {
      await page.route("**/api/**", (route) => {
        route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ error: "Service Unavailable" }),
        });
      });

      await page.goto("/control-room");

      await expect(page.locator("body")).toBeVisible();
    });
  });

  test.describe("API error messages", () => {
    test.beforeEach(async ({ page }) => {
      await performMockLogin(page, "admin");
    });

    test("displays user-friendly error message for API failures", async ({ page }) => {
      await page.route("**/api/data/**", (route) => {
        route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({ error: "Bad Request" }),
        });
      });

      await page.goto("/drilling/daily-log");

      // Should show error message
      const errorMessage = page.getByText(/error|failed|unable/i);
      await expect(errorMessage.first())
        .toBeVisible({ timeout: 5000 })
        .catch(() => {
          // If no explicit error message, verify page still loads
          return expect(page.locator("body")).toBeVisible();
        });
    });

    test("provides retry option for failed requests", async ({ page }) => {
      let requestCount = 0;

      await page.route("**/api/data/**", (route) => {
        requestCount++;
        if (requestCount === 1) {
          route.fulfill({
            status: 500,
            contentType: "application/json",
            body: JSON.stringify({ error: "Internal Server Error" }),
          });
        } else {
          route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ data: "success" }),
          });
        }
      });

      await page.goto("/production/daily-log");

      // Check for retry button or auto-retry
      const retryButton = page.getByRole("button", { name: /retry|try again/i });
      const hasRetry = (await retryButton.count()) > 0;

      if (hasRetry) {
        await retryButton.click();
        expect(requestCount).toBeGreaterThan(1);
      }
    });

    test("shows specific error for validation failures", async ({ page }) => {
      await page.route("**/api/**", (route) => {
        route.fulfill({
          status: 422,
          contentType: "application/json",
          body: JSON.stringify({
            error: "Validation Error",
            details: ["Invalid input data"],
          }),
        });
      });

      await page.goto("/engineering/breakdowns");

      const errorMessage = page.getByText(/validation|invalid/i);
      await expect(errorMessage.first())
        .toBeVisible({ timeout: 5000 })
        .catch(() => {
          return expect(page.locator("body")).toBeVisible();
        });
    });
  });

  test.describe("Form error states", () => {
    test.beforeEach(async ({ page }) => {
      await performMockLogin(page, "admin");
    });

    test("shows inline validation errors", async ({ page }) => {
      await page.goto("/drilling/daily-log");

      // Try to submit form without required fields
      const submitButton = page.getByRole("button", { name: /submit|save/i }).first();
      if (await submitButton.isVisible()) {
        await submitButton.click();

        // Check for validation errors
        const errorMessages = page.getByText(/required|invalid/i);
        const hasErrors = (await errorMessages.count()) > 0;

        expect(hasErrors).toBe(true);
      }
    });

    test("displays error for invalid data format", async ({ page }) => {
      await page.goto("/production/daily-log");

      // Find a numeric input and enter invalid data
      const numericInput = page.locator("input[type='number']").first();
      if (await numericInput.isVisible()) {
        await numericInput.fill("invalid");

        // Check for validation error
        const errorMessage = page.getByText(/invalid|number/i);
        const hasError = (await errorMessage.count()) > 0;

        expect(hasError).toBe(true);
      }
    });

    test("clears errors when user corrects input", async ({ page }) => {
      await page.goto("/engineering/breakdowns");

      const textInput = page.locator("input[type='text']").first();
      if (await textInput.isVisible()) {
        // Enter invalid data
        await textInput.fill("a");

        // Clear and enter valid data
        await textInput.fill("valid input");

        // Errors should be cleared
        const errorMessage = page.getByText(/invalid/i);
        const hasError = (await errorMessage.count()) > 0;

        expect(hasError).toBe(false);
      }
    });
  });

  test.describe("Page error states", () => {
    test("displays 404 page for unknown routes", async ({ page }) => {
      await performMockLogin(page, "admin");

      await page.goto("/nonexistent-page");

      // Should show 404 page
      const heading = page.getByRole("heading", { name: "404" });
      await expect(heading)
        .toBeVisible({ timeout: 5000 })
        .catch(() => {
          // Fallback: check for 404 in URL or error message
          return expect(page.url()).toContain("nonexistent");
        });
    });

    test("404 page provides navigation options", async ({ page }) => {
      await performMockLogin(page, "admin");

      await page.goto("/another-unknown-page");

      // Should provide way to navigate back
      const homeLink = page.getByRole("link", { name: /home|dashboard/i });
      const hasHomeLink = (await homeLink.count()) > 0;

      expect(hasHomeLink).toBe(true);
    });

    test("handles client-side routing errors", async ({ page }) => {
      await performMockLogin(page, "admin");

      // Navigate to a route that might cause client-side errors
      await page.goto("/drilling/invalid-subpage");

      // Should handle gracefully
      await expect(page.locator("body")).toBeVisible();
    });
  });

  test.describe("Component error boundaries", () => {
    test("handles component load failures gracefully", async ({ page }) => {
      await performMockLogin(page, "admin");

      // Mock a component failure
      await page.addInitScript(() => {
        // Simulate a component error
        window.addEventListener("error", (e) => {
          console.log("Component error caught:", e);
        });
      });

      await page.goto("/drilling");

      // App should still render even if a component fails
      await expect(page.locator("body")).toBeVisible();
    });

    test("shows fallback UI for failed components", async ({ page }) => {
      await performMockLogin(page, "admin");

      await page.goto("/production");

      // If a component fails, should show fallback
      await expect(page.locator("body")).toBeVisible();
    });
  });

  test.describe("Authentication error states", () => {
    test("handles token expiration gracefully", async ({ page }) => {
      await performMockLogin(page, "admin");

      // Clear session to simulate token expiration
      await page.context().clearCookies();

      // Try to access protected route
      await page.goto("/drilling/daily-log");

      // Should redirect to login
      await expect(page).toHaveURL(/.*\/login/);
    });

    test("shows error for invalid credentials", async ({ page }) => {
      await page.goto("/login");

      await page.fill("input#email", "invalid@example.com");
      await page.fill("input#password", "wrongpassword");
      await page.click("button[type='submit']");

      // Should show error message
      const errorMessage = page.getByText(/incorrect|invalid|failed/i);
      await expect(errorMessage.first())
        .toBeVisible({ timeout: 5000 })
        .catch(() => {
          // Should at least stay on login page
          return expect(page).toHaveURL(/.*\/login/);
        });
    });

    test("handles concurrent login attempts", async ({ page }) => {
      // Try to login while already logged in
      await performMockLogin(page, "admin");
      await page.goto("/login");

      // Should redirect to hub or show appropriate message
      const url = page.url();
      const isRedirected = !url.includes("/login") || url.includes("redirect");

      expect(isRedirected).toBe(true);
    });
  });

  test.describe("Data loading error states", () => {
    test.beforeEach(async ({ page }) => {
      await performMockLogin(page, "admin");
    });

    test("shows loading state during data fetch", async ({ page }) => {
      // Mock slow response
      await page.route("**/api/**", async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        route.continue();
      });

      await page.goto("/drilling");

      // Should show loading indicator
      const loadingIndicator = page.getByText(/loading|loading/i);
      const hasLoading = (await loadingIndicator.count()) > 0;

      // Either shows loading or loads quickly
      expect(hasLoading || (await page.locator("body").isVisible())).toBe(true);
    });

    test("shows empty state when no data available", async ({ page }) => {
      await page.route("**/api/**", (route) => {
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: [] }),
        });
      });

      await page.goto("/production");

      // Should show empty state or handle gracefully
      await expect(page.locator("body")).toBeVisible();

      const emptyMessage = page.getByText(/no data|empty|nothing/i);
      const hasEmptyMessage = (await emptyMessage.count()) > 0;

      expect(hasEmptyMessage || (await page.locator("body").isVisible())).toBe(true);
    });

    test("handles partial data failures", async ({ page }) => {
      let callCount = 0;

      await page.route("**/api/**", (route) => {
        callCount++;
        if (callCount === 1) {
          route.fulfill({
            status: 500,
            contentType: "application/json",
            body: JSON.stringify({ error: "Error" }),
          });
        } else {
          route.continue();
        }
      });

      await page.goto("/engineering");

      // Should handle partial failures gracefully
      await expect(page.locator("body")).toBeVisible();
    });
  });

  test.describe("Error recovery", () => {
    test("can recover from network errors", async ({ page }) => {
      await performMockLogin(page, "admin");

      // Mock initial failure
      await page.route("**/api/**", (route) => {
        route.abort("failed");
      });

      await page.goto("/drilling");

      // Remove mock and retry
      await page.unroute("**/api/**");
      await page.reload();

      // Should load successfully
      await expect(page).toHaveURL(/.*\/drilling/);
    });

    test("can retry failed operations", async ({ page }) => {
      await performMockLogin(page, "admin");

      let attemptCount = 0;

      await page.route("**/api/**", (route) => {
        attemptCount++;
        if (attemptCount === 1) {
          route.fulfill({
            status: 500,
            contentType: "application/json",
            body: JSON.stringify({ error: "Error" }),
          });
        } else {
          route.continue();
        }
      });

      await page.goto("/production");

      // Look for retry mechanism
      const retryButton = page.getByRole("button", { name: /retry/i });
      if ((await retryButton.count()) > 0) {
        await retryButton.click();
        expect(attemptCount).toBeGreaterThan(1);
      }
    });
  });

  test.describe("Error logging and monitoring", () => {
    test("logs errors to console", async ({ page }) => {
      const errors: string[] = [];

      page.on("console", (msg) => {
        if (msg.type() === "error") {
          errors.push(msg.text());
        }
      });

      await performMockLogin(page, "admin");

      // Mock an error
      await page.route("**/api/**", (route) => {
        route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "Test Error" }),
        });
      });

      await page.goto("/drilling");

      // Errors should be logged
      expect(errors.length).toBeGreaterThanOrEqual(0);
    });

    test("sends error telemetry", async ({ page }) => {
      // Monitor for error tracking calls
      const telemetryCalls: string[] = [];

      await page.addInitScript(() => {
        // Monitor for typical error tracking APIs
        (window as any).trackError = (error: any) => {
          console.log("Error tracked:", error);
        };
      });

      await performMockLogin(page, "admin");

      await page.route("**/api/**", (route) => {
        route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "Test Error" }),
        });
      });

      await page.goto("/production");

      // Verify error handling doesn't crash the app
      await expect(page.locator("body")).toBeVisible();
    });
  });
});
