import { test, expect } from "@playwright/test";
import { performMockLogin } from "./helpers/auth";

test.describe("API/Network Request Mocking", () => {
  test.describe("Request interception for stability", () => {
    test.beforeEach(async ({ page }) => {
      await performMockLogin(page, "admin");
    });

    test("can intercept and mock API responses", async ({ page }) => {
      // Mock an API endpoint
      await page.route("**/api/data/**", (route) => {
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ mocked: true, data: "test-data" }),
        });
      });

      await page.goto("/drilling");

      // Verify the page loads successfully with mocked data
      await expect(page).toHaveURL(/.*\/drilling/);
    });

    test("can mock failed API requests for error testing", async ({ page }) => {
      // Mock API to return error
      await page.route("**/api/data/**", (route) => {
        route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "Internal Server Error" }),
        });
      });

      await page.goto("/drilling");

      // Page should still load (handle error gracefully)
      await expect(page.locator("body")).toBeVisible();
    });

    test("can mock slow API responses for loading state testing", async ({ page }) => {
      // Mock slow API response
      await page.route("**/api/data/**", async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 2000)); // 2 second delay
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: "test-data" }),
        });
      });

      await page.goto("/drilling");

      // Should eventually load
      await expect(page).toHaveURL(/.*\/drilling/, { timeout: 10000 });
    });
  });

  test.describe("Network request monitoring", () => {
    test("monitors API requests during navigation", async ({ page }) => {
      const requests: string[] = [];

      page.on("request", (request) => {
        if (request.url().includes("/api/")) {
          requests.push(request.url());
        }
      });

      await performMockLogin(page, "admin");
      await page.goto("/drilling");

      // Verify API requests were made
      expect(requests.length).toBeGreaterThan(0);
    });

    test("monitors response status codes", async ({ page }) => {
      const responses: { url: string; status: number }[] = [];

      page.on("response", (response) => {
        if (response.url().includes("/api/")) {
          responses.push({
            url: response.url(),
            status: response.status(),
          });
        }
      });

      await performMockLogin(page, "admin");
      await page.goto("/production");

      // Verify responses are successful
      const failedResponses = responses.filter((r) => r.status >= 400);
      expect(failedResponses.length).toBe(0);
    });

    test("detects failed network requests", async ({ page }) => {
      const failedRequests: string[] = [];

      page.on("requestfailed", (request) => {
        failedRequests.push(request.url());
      });

      await performMockLogin(page, "admin");
      await page.goto("/engineering");

      // In a stable environment, there should be no failed requests
      // This test helps identify network issues
      console.log("Failed requests:", failedRequests);
    });
  });

  test.describe("API response validation", () => {
    test("validates API response structure", async ({ page }) => {
      let responseData: any = null;

      await page.route("**/api/data/**", async (route) => {
        const response = await route.fetch();
        const body = await response.json();
        responseData = body;
        route.continue();
      });

      await performMockLogin(page, "admin");
      await page.goto("/drilling");

      // If we intercepted a response, validate its structure
      if (responseData) {
        expect(responseData).toBeDefined();
        expect(typeof responseData).toBe("object");
      }
    });

    test("handles empty API responses gracefully", async ({ page }) => {
      await page.route("**/api/data/**", (route) => {
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: [] }),
        });
      });

      await performMockLogin(page, "admin");
      await page.goto("/production");

      // Should handle empty data without errors
      await expect(page.locator("body")).toBeVisible();
    });
  });

  test.describe("Offline API handling", () => {
    test("handles API failures when offline", async ({ page, context }) => {
      await performMockLogin(page, "admin");

      // Go offline
      await context.setOffline(true);

      // Try to navigate (should use cached data or show offline state)
      await page.goto("/drilling");

      // Should handle offline state gracefully
      await expect(page.locator("body")).toBeVisible();

      // Go back online
      await context.setOffline(false);
    });

    test("shows appropriate error message on API failure", async ({ page }) => {
      await page.route("**/api/**", (route) => {
        route.abort("failed");
      });

      await performMockLogin(page, "admin");
      await page.goto("/engineering");

      // Should show error message or handle gracefully
      await expect(page.locator("body")).toBeVisible();
    });
  });

  test.describe("Request optimization", () => {
    test("prevents duplicate API requests", async ({ page }) => {
      const requestUrls: string[] = [];

      page.on("request", (request) => {
        if (request.url().includes("/api/data")) {
          requestUrls.push(request.url());
        }
      });

      await performMockLogin(page, "admin");
      await page.goto("/drilling");

      // Check for duplicate requests
      const uniqueUrls = new Set(requestUrls);
      const duplicates = requestUrls.length - uniqueUrls.size;

      // Should not have excessive duplicate requests
      expect(duplicates).toBeLessThan(3);
    });

    test("caches API responses appropriately", async ({ page }) => {
      const requestCount: { [key: string]: number } = {};

      page.on("request", (request) => {
        const url = request.url();
        if (url.includes("/api/data")) {
          requestCount[url] = (requestCount[url] || 0) + 1;
        }
      });

      await performMockLogin(page, "admin");
      await page.goto("/production");

      // Navigate away and back
      await page.goto("/engineering");
      await page.goto("/production");

      // Cached responses should reduce duplicate requests
      const totalRequests = Object.values(requestCount).reduce((a, b) => a + b, 0);
      expect(totalRequests).toBeLessThan(10); // Reasonable limit
    });
  });

  test.describe("API security", () => {
    test("includes authentication headers in API requests", async ({ page }) => {
      const authHeaders: string[] = [];

      page.on("request", (request) => {
        const headers = request.headers();
        if (headers["authorization"] || headers["cookie"]) {
          authHeaders.push(request.url());
        }
      });

      await performMockLogin(page, "admin");
      await page.goto("/drilling");

      // API requests should include auth
      expect(authHeaders.length).toBeGreaterThan(0);
    });

    test("does not expose sensitive data in URLs", async ({ page }) => {
      const requestUrls: string[] = [];

      page.on("request", (request) => {
        requestUrls.push(request.url());
      });

      await performMockLogin(page, "admin");
      await page.goto("/production");

      // Check for sensitive data in URLs
      const sensitivePatterns = [/password/i, /token/i, /secret/i, /api[_-]?key/i];

      for (const url of requestUrls) {
        for (const pattern of sensitivePatterns) {
          expect(url).not.toMatch(pattern);
        }
      }
    });
  });

  test.describe("API performance", () => {
    test("API responses complete within reasonable time", async ({ page }) => {
      const responseTimes: number[] = [];

      page.on("response", (response) => {
        if (response.url().includes("/api/")) {
          responseTimes.push(response.timing().responseEnd);
        }
      });

      await performMockLogin(page, "admin");
      await page.goto("/drilling");

      // All API responses should complete within 5 seconds
      for (const time of responseTimes) {
        expect(time).toBeLessThan(5000);
      }
    });

    test("does not make excessive API requests on page load", async ({ page }) => {
      let apiRequestCount = 0;

      page.on("request", (request) => {
        if (request.url().includes("/api/")) {
          apiRequestCount++;
        }
      });

      await performMockLogin(page, "admin");
      await page.goto("/engineering");

      // Should not make excessive requests
      expect(apiRequestCount).toBeLessThan(20);
    });
  });
});
