import { test, expect } from "@playwright/test";
import { AUTH_FILE } from "../helpers/auth";

test.describe("unauthenticated access", () => {
  test("redirects to login with correct return path", async ({ page }) => {
    await page.goto("/control-room");
    await expect(page).toHaveURL(/\/login/);
    expect(page.url()).toContain("redirect=%2Fcontrol-room");
  });
});

test.describe("alerts panel", () => {
  test.use({ storageState: AUTH_FILE });

  test("loads Control Room Dashboard", async ({ page }) => {
    await page.goto("/control-room");
    await expect(page.getByRole("heading", { name: "Control Room Dashboard" })).toBeVisible({
      timeout: 15000,
    });
  });

  test("shows Alerts section heading", async ({ page }) => {
    await page.goto("/control-room");
    await expect(page.getByRole("heading", { name: "Alerts" })).toBeVisible({
      timeout: 15000,
    });
  });

  test("shows alerts section with content", async ({ page }) => {
    await page.goto("/control-room");
    // The alerts section always renders — either the empty state text
    // or individual alert cards. Check that content is present.
    const emptyState = page.getByText("All systems operational. No active alerts.");
    const anyAlert = page.locator("text=/ is offline/");
    await expect(emptyState.or(anyAlert).first()).toBeVisible({
      timeout: 15000,
    });
  });
});
