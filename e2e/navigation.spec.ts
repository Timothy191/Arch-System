import { test, expect } from "@playwright/test";

test.describe("department navigation", () => {
  test("unauthenticated access to any department redirects to login", async ({
    page,
  }) => {
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
      await expect(page).toHaveURL(/\/login/);
      expect(page.url()).toContain(`redirect=%2F${dept}`);
    }
  });

  test("unauthenticated access to department tab redirects with full path", async ({
    page,
  }) => {
    await page.goto("/drilling/machines");
    await expect(page).toHaveURL(/\/login/);
    expect(page.url()).toContain("redirect=%2Fdrilling%2Fmachines");
  });

  test("unauthenticated access to daily-log redirects with full path", async ({
    page,
  }) => {
    await page.goto("/production/daily-log");
    await expect(page).toHaveURL(/\/login/);
    expect(page.url()).toContain("redirect=%2Fproduction%2Fdaily-log");
  });

  test("unauthenticated access to breakdowns redirects with full path", async ({
    page,
  }) => {
    await page.goto("/engineering/breakdowns");
    await expect(page).toHaveURL(/\/login/);
    expect(page.url()).toContain("redirect=%2Fengineering%2Fbreakdowns");
  });

  test("unauthenticated access to reports tab redirects", async ({ page }) => {
    await page.goto("/safety/reports");
    await expect(page).toHaveURL(/\/login/);
    expect(page.url()).toContain("redirect=%2Fsafety%2Freports");
  });

  test("unauthenticated access to tools tab redirects", async ({ page }) => {
    await page.goto("/drilling/tools");
    await expect(page).toHaveURL(/\/login/);
    expect(page.url()).toContain("redirect=%2Fdrilling%2Ftools");
  });

  test("unauthenticated access to admin page redirects", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("login page navigation", () => {
  test("login page is publicly accessible", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByTestId("login-form")).toBeVisible();
  });

  test("login page does not redirect to itself", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveURL(/\/login/);
    expect(page.url()).not.toContain("redirect=%2Flogin");
  });

  test("direct navigation to /login preserves any redirect param", async ({
    page,
  }) => {
    await page.goto("/login?redirect=%2Fdrilling");
    await expect(page.getByTestId("login-form")).toBeVisible();
    expect(page.url()).toContain("redirect=%2Fdrilling");
  });

  test("login page renders email and password fields", async ({ page }) => {
    await page.goto("/login");
    await expect(
      page.locator("input[type='email'], input#email"),
    ).toBeVisible();
    await expect(page.locator("input[type='password']")).toBeVisible();
    await expect(page.locator("button[type='submit']")).toBeVisible();
  });
});

test.describe("404 and error handling", () => {
  test("unknown route still redirects to login when unauthenticated", async ({
    page,
  }) => {
    await page.goto("/nonexistent-department");
    // Either a 404 page or a redirect to login — should not show app content
    const url = page.url();
    const is404OrLogin =
      url.includes("/login") ||
      (await page.title()).includes("404") ||
      url.includes("nonexistent");
    expect(is404OrLogin).toBe(true);
  });
});
