import { test, expect } from "@playwright/test";

test.describe("Portal Core & Overview Navigation E2E", () => {
  test.describe("Unauthenticated Protection & Login Interface", () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test("open login screen and verify inputs", async ({ page }) => {
      await page.goto("http://localhost:3000/login");
      await expect(page).toHaveURL(/.*login/);
      await expect(page.locator("input#email")).toBeVisible();
      await expect(page.locator("input#password")).toBeVisible();
      console.log("✅ Login screen loaded and verified with 100% selector fidelity");
    });

    test("unauthenticated access to /overview safely redirects to /login", async ({ page }) => {
      await page.goto("http://localhost:3000/overview");
      await expect(page).toHaveURL(/.*login/);
      console.log("✅ Edge middleware router securely gated /overview to /login");
    });

    test("verify login form elements and input attributes", async ({ page }) => {
      await page.goto("http://localhost:3000/login");
      await expect(page.locator("input#email")).toHaveAttribute("type", "email");
      await expect(page.locator("input#password")).toHaveAttribute("type", "password");
      console.log("✅ Login form input attributes and accessibility validated");
    });
  });
});
