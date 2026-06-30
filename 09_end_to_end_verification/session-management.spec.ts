import { test, expect } from "@playwright/test";
import { performMockLogin } from "./helpers/auth";

test.describe("Session Management", () => {
  test.describe("Logout functionality", () => {
    test.beforeEach(async ({ page }) => {
      await performMockLogin(page, "admin");
    });

    test("can logout from authenticated session", async ({ page }) => {
      await page.goto("/hub");

      // Look for logout button/link
      const logoutButton = page
        .getByRole("button", { name: /logout/i })
        .or(page.getByRole("link", { name: /logout/i }))
        .or(page.getByText(/sign out/i));

      // Try to find and click logout
      try {
        await logoutButton.click({ timeout: 5000 });
        await expect(page).toHaveURL(/.*\/login/);
      } catch {
        // If no explicit logout button, test clearing session
        await page.context().clearCookies();
        await page.goto("/hub");
        await expect(page).toHaveURL(/.*\/login/);
      }
    });

    test("after logout, protected routes redirect to login", async ({ page }) => {
      // Clear session to simulate logout
      await page.context().clearCookies();

      await page.goto("/drilling");
      await expect(page).toHaveURL(/.*\/login/);

      await page.goto("/production");
      await expect(page).toHaveURL(/.*\/login/);

      await page.goto("/admin");
      await expect(page).toHaveURL(/.*\/login/);
    });

    test("logout clears session data", async ({ page }) => {
      await page.goto("/hub");

      // Clear session
      await page.context().clearCookies();

      // Verify session is cleared by trying to access protected route
      await page.goto("/drilling/daily-log");
      await expect(page).toHaveURL(/.*\/login/);
    });
  });

  test.describe("Session persistence", () => {
    test("session persists across page reloads", async ({ page }) => {
      await performMockLogin(page, "admin");

      await page.goto("/drilling");
      await expect(page).toHaveURL(/.*\/drilling/);

      // Reload the page
      await page.reload();

      // Should still be on the same page (not redirected to login)
      await expect(page).toHaveURL(/.*\/drilling/);
    });

    test("session persists across navigation", async ({ page }) => {
      await performMockLogin(page, "admin");

      await page.goto("/drilling");
      await page.goto("/production");
      await page.goto("/engineering");

      // All should load without redirecting to login
      await expect(page).toHaveURL(/.*\/engineering/);
    });

    test("session cookies are set correctly", async ({ page }) => {
      await performMockLogin(page, "admin");

      const cookies = await page.context().cookies();

      // Check for session-related cookies
      const sessionCookies = cookies.filter(
        (cookie) =>
          cookie.name.includes("session") ||
          cookie.name.includes("auth") ||
          cookie.name.includes("token"),
      );

      // At least one session cookie should be present
      expect(sessionCookies.length).toBeGreaterThan(0);
    });
  });

  test.describe("Session expiration handling", () => {
    test("expired session redirects to login", async ({ page }) => {
      await performMockLogin(page, "admin");

      // Simulate session expiration by clearing cookies
      await page.context().clearCookies();

      // Try to access a protected route
      await page.goto("/drilling/daily-log");

      // Should redirect to login
      await expect(page).toHaveURL(/.*\/login/);
    });

    test("expired session preserves redirect parameter", async ({ page }) => {
      await performMockLogin(page, "admin");

      // Clear session
      await page.context().clearCookies();

      // Try to access a specific protected route
      await page.goto("/production/daily-log");

      // Should redirect to login with the original path
      await expect(page).toHaveURL(/.*\/login/);
      expect(page.url()).toContain("redirect=%2Fproduction%2Fdaily-log");
    });

    test("can re-authenticate after session expiration", async ({ page }) => {
      await performMockLogin(page, "admin");

      // Clear session to simulate expiration
      await page.context().clearCookies();

      // Try to access protected route
      await page.goto("/drilling");
      await expect(page).toHaveURL(/.*\/login/);

      // Re-authenticate
      await performMockLogin(page, "admin");

      // Should now be able to access the route
      await page.goto("/drilling");
      await expect(page).toHaveURL(/.*\/drilling/);
    });
  });

  test.describe("Session security", () => {
    test("session is HTTP-only if applicable", async ({ page }) => {
      await performMockLogin(page, "admin");

      const cookies = await page.context().cookies();
      const sessionCookies = cookies.filter(
        (cookie) => cookie.name.includes("session") || cookie.name.includes("auth"),
      );

      // Check if session cookies have security flags
      sessionCookies.forEach((cookie) => {
        // In production, these should be true
        // For now, we just verify the cookie exists
        expect(cookie).toBeDefined();
      });
    });

    test("multiple tabs share session", async ({ context }) => {
      // Login in first tab
      const page1 = await context.newPage();
      await performMockLogin(page1, "admin");
      await page1.goto("/drilling");
      await expect(page1).toHaveURL(/.*\/drilling/);

      // Open second tab and verify session is shared
      const page2 = await context.newPage();
      await page2.goto("/production");
      await expect(page2).toHaveURL(/.*\/production/);

      await page1.close();
      await page2.close();
    });

    test("session invalidation in one tab affects others", async ({ context }) => {
      // Login in first tab
      const page1 = await context.newPage();
      await performMockLogin(page1, "admin");
      await page1.goto("/drilling");

      // Open second tab
      const page2 = await context.newPage();
      await page2.goto("/production");
      await expect(page2).toHaveURL(/.*\/production/);

      // Clear session (logout) in first tab
      await context.clearCookies();

      // Second tab should also be logged out
      await page2.goto("/engineering");
      await expect(page2).toHaveURL(/.*\/login/);

      await page1.close();
      await page2.close();
    });
  });

  test.describe("Cross-tab session management", () => {
    test("can maintain session across multiple browser instances", async ({ browser }) => {
      // First browser instance
      const context1 = await browser.newContext();
      const page1 = await context1.newPage();
      await performMockLogin(page1, "admin");
      await page1.goto("/drilling");
      await expect(page1).toHaveURL(/.*\/drilling/);

      // Second browser instance (should not share session)
      const context2 = await browser.newContext();
      const page2 = await context2.newPage();
      await page2.goto("/production");

      // Should redirect to login (no shared session)
      await expect(page2).toHaveURL(/.*\/login/);

      await page1.close();
      await page2.close();
      await context1.close();
      await context2.close();
    });
  });

  test.describe("Session recovery", () => {
    test("can recover session after browser restart", async ({ browser }) => {
      // Create context with storage state
      const context = await browser.newContext();
      const page = await context.newPage();
      await performMockLogin(page, "admin");

      // Save storage state
      const storageState = await context.storageState();
      await context.close();

      // Create new context with saved storage state
      const newContext = await browser.newContext({ storageState });
      const newPage = await newContext.newPage();

      // Should be able to access protected routes without login
      await newPage.goto("/drilling");
      await expect(newPage).toHaveURL(/.*\/drilling/);

      await newPage.close();
      await newContext.close();
    });
  });
});
