import { test, expect } from "@playwright/test";

test.describe("daily log data entry (unauthenticated)", () => {
  test("accessing daily-log redirects to login with correct return path", async ({
    page,
  }) => {
    await page.goto("/drilling/daily-log");
    await expect(page).toHaveURL(/\/login/);
    expect(page.url()).toContain("redirect=%2Fdrilling%2Fdaily-log");
  });

  test("accessing production daily-log redirects to login", async ({
    page,
  }) => {
    await page.goto("/production/daily-log");
    await expect(page).toHaveURL(/\/login/);
    expect(page.url()).toContain("redirect=%2Fproduction%2Fdaily-log");
  });

  test("accessing safety daily-log redirects to login", async ({ page }) => {
    await page.goto("/safety/daily-log");
    await expect(page).toHaveURL(/\/login/);
    expect(page.url()).toContain("redirect=%2Fsafety%2Fdaily-log");
  });
});

test.describe("breakdown data entry (unauthenticated)", () => {
  test("accessing engineering breakdowns redirects to login", async ({
    page,
  }) => {
    await page.goto("/engineering/breakdowns");
    await expect(page).toHaveURL(/\/login/);
    expect(page.url()).toContain("redirect=%2Fengineering%2Fbreakdowns");
  });
});

test.describe("machine operations data entry (unauthenticated)", () => {
  test("accessing control-room machine-operations redirects to login", async ({
    page,
  }) => {
    await page.goto("/control-room/machine-operations");
    await expect(page).toHaveURL(/\/login/);
    expect(page.url()).toContain(
      "redirect=%2Fcontrol-room%2Fmachine-operations",
    );
  });

  test("accessing control-room hourly-loads redirects to login", async ({
    page,
  }) => {
    await page.goto("/control-room/hourly-loads");
    await expect(page).toHaveURL(/\/login/);
    expect(page.url()).toContain("redirect=%2Fcontrol-room%2Fhourly-loads");
  });

  test("accessing control-room operational-delays redirects to login", async ({
    page,
  }) => {
    await page.goto("/control-room/operational-delays");
    await expect(page).toHaveURL(/\/login/);
    expect(page.url()).toContain(
      "redirect=%2Fcontrol-room%2Foperational-delays",
    );
  });
});

test.describe("login form data entry", () => {
  test("submitting empty credentials does not navigate away", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.locator("button[type='submit']").click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByTestId("login-form")).toBeVisible();
  });

  test("typing in email field updates its value", async ({ page }) => {
    await page.goto("/login");
    const emailInput = page.locator("input[type='email'], input#email").first();
    await emailInput.fill("operator@arch.os");
    await expect(emailInput).toHaveValue("operator@arch.os");
  });

  test("typing in password field updates its value", async ({ page }) => {
    await page.goto("/login");
    const passwordInput = page.locator("input[type='password']").first();
    await passwordInput.fill("testpassword");
    await expect(passwordInput).toHaveValue("testpassword");
  });

  test("password field masks input", async ({ page }) => {
    await page.goto("/login");
    const passwordInput = page.locator("input[type='password']").first();
    await expect(passwordInput).toHaveAttribute("type", "password");
  });

  test("submitting invalid credentials shows error message", async ({
    page,
  }) => {
    await page.goto("/login");

    await page
      .locator("input[type='email'], input#email")
      .first()
      .fill("bad@email.com");
    await page.locator("input[type='password']").first().fill("wrongpassword");
    await page.locator("button[type='submit']").click();

    // Should stay on login page and show an error
    await expect(page).toHaveURL(/\/login/);

    // Error message should appear (generic check for any error text)
    await expect(
      page
        .locator("[role='alert'], .text-red-400, [data-testid='error-message']")
        .first(),
    ).toBeVisible({ timeout: 5000 });
  });
});
