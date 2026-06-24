import { test, expect } from "@playwright/test";
import { AUTH_FILE } from "../helpers/auth";

test.describe("unauthenticated access", () => {
  test("redirects to login with correct return path", async ({ page }) => {
    await page.goto("/control-room/machine-operations");
    await expect(page).toHaveURL(/\/login/);
    expect(page.url()).toContain("redirect=%2Fcontrol-room%2Fmachine-operations");
  });
});

test.describe("department access control", () => {
  test.use({ storageState: AUTH_FILE });

  test("rejects non-control-room department with 404", async ({ page }) => {
    await page.goto("/drilling/machine-operations");
    await expect(page.getByRole("heading", { name: "404" })).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText("The page you are looking for does not exist.")).toBeVisible();
  });
});

test.describe("machine operations page", () => {
  test.use({ storageState: AUTH_FILE });

  test("loads with correct heading", async ({ page }) => {
    await page.goto("/control-room/machine-operations");
    await expect(page.getByRole("heading", { name: "Machine Operations" })).toBeVisible({
      timeout: 15000,
    });
  });

  test("displays summary cards", async ({ page }) => {
    await page.goto("/control-room/machine-operations");
    await expect(page.getByText("Today's Hours")).toBeVisible();
    await expect(page.getByText("Active Machines")).toBeVisible();
    await expect(page.getByText("Material Moved")).toBeVisible();
    await expect(page.getByText("BCM/Hour")).toBeVisible();
    await expect(page.getByText("Total Delays")).toBeVisible();
  });

  test("shows Machine Operations section heading", async ({ page }) => {
    await page.goto("/control-room/machine-operations");
    // The MachineOperationsForm has a heading or label
    await expect(page.getByText("Today's Operations")).toBeVisible();
  });

  test("loads shift coverage compliance widget", async ({ page }) => {
    await page.goto("/control-room/machine-operations");
    // The compliance widget shows machine coverage status
    await expect(page.getByText("Checking shift coverage")).toBeVisible({
      timeout: 15000,
    });
  });
});
