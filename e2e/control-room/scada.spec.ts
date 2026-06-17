import { test, expect } from "@playwright/test";
import { AUTH_FILE } from "../helpers/auth";

test.describe("unauthenticated access", () => {
  test("redirects to login with correct return path", async ({ page }) => {
    await page.goto("/control-room");
    await expect(page).toHaveURL(/\/login/);
    expect(page.url()).toContain("redirect=%2Fcontrol-room");
  });
});

test.describe("SCADA overview", () => {
  test.use({ storageState: AUTH_FILE });

  test("loads SCADA Overview section", async ({ page }) => {
    await page.goto("/control-room");
    await expect(
      page.getByRole("heading", { name: "SCADA Overview" }),
    ).toBeVisible({ timeout: 15000 });
  });

  test("displays view mode toggle buttons", async ({ page }) => {
    await page.goto("/control-room");
    await expect(
      page.getByRole("button", { name: "Machine List" }),
    ).toBeVisible({ timeout: 15000 });
    await expect(
      page.getByRole("button", { name: "SCADA Dashboard" }),
    ).toBeVisible();
  });
});

test.describe("FUXA frame", () => {
  test.use({ storageState: AUTH_FILE });

  test("shows SCADA Dashboard with connection status", async ({ page }) => {
    await page.goto("/control-room");

    await page.getByRole("button", { name: "SCADA Dashboard" }).click();

    // The FuxaFrame status indicator transitions from "Connecting" to
    // one of "Connected", "Degraded", or "Offline" after the 15s load timeout.
    // Status indicator text is always visible (z-30, above any overlay).
    await expect(
      page
        .getByText("Connected", { exact: true })
        .or(page.getByText("Degraded", { exact: true }))
        .or(page.getByText("Offline", { exact: true })),
    ).toBeVisible({ timeout: 20000 });
  });
});
