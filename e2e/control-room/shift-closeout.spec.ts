import { test, expect } from "@playwright/test";
import { AUTH_FILE } from "../helpers/auth";

test.describe("unauthenticated access", () => {
  test("redirects to login with correct return path", async ({ page }) => {
    await page.goto("/control-room/shift-coverage");
    await expect(page).toHaveURL(/\/login/);
    expect(page.url()).toContain("redirect=%2Fcontrol-room%2Fshift-coverage");
  });
});

test.describe("department access control", () => {
  test.use({ storageState: AUTH_FILE });

  test("rejects non-control-room department with 404", async ({ page }) => {
    await page.goto("/drilling/shift-coverage");
    await expect(page.getByRole("heading", { name: "404" })).toBeVisible({
      timeout: 15000,
    });
    await expect(
      page.getByText("The page you are looking for does not exist."),
    ).toBeVisible();
  });
});

test.describe("shift coverage page", () => {
  test.use({ storageState: AUTH_FILE });

  test("loads with correct heading", async ({ page }) => {
    await page.goto("/control-room/shift-coverage");
    await expect(
      page.getByRole("heading", { name: "Shift Coverage" }),
    ).toBeVisible({ timeout: 15000 });
  });

  test("displays date navigation controls", async ({ page }) => {
    await page.goto("/control-room/shift-coverage");
    await expect(page.getByLabel("Previous day")).toBeVisible();
    await expect(page.getByLabel("Next day")).toBeVisible();
  });

  test("shows Close-out History section", async ({ page }) => {
    await page.goto("/control-room/shift-coverage");
    await expect(
      page.getByRole("heading", { name: "Close-out History" }),
    ).toBeVisible();
  });

  test("shows shift status indicator", async ({ page }) => {
    await page.goto("/control-room/shift-coverage");
    // The shift can be open (showing "Close Shift" button)
    // or closed (showing "Closed" badge). One is always visible.
    const closeButton = page.getByRole("button", { name: "Close Shift" });
    const closedBadge = page.getByText("Closed");
    await expect(closeButton.or(closedBadge).first()).toBeVisible({
      timeout: 15000,
    });
  });

  test("loads Machine Coverage section", async ({ page }) => {
    await page.goto("/control-room/shift-coverage");
    await expect(
      page.getByRole("heading", { name: "Machine Coverage" }),
    ).toBeVisible({ timeout: 15000 });
  });
});
