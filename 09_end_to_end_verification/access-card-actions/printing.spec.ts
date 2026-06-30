import { test, expect } from "@playwright/test";
import { AUTH_FILE } from "../helpers/auth";

test.describe("Access Card Actions - Printing Integration", () => {
  test.use({ storageState: AUTH_FILE });

  test("displays employee data and can initiate printing from Card Actions tab", async ({
    page,
  }) => {
    // 1. Navigate to the access card actions dashboard
    await page.goto("/access-card-actions");

    // 2. Expect heading to be visible
    await expect(page.getByRole("heading", { name: "Access Card Actions Dashboard" })).toBeVisible({
      timeout: 15000,
    });

    // 3. Navigate to Card Actions tab
    const cardActionsTab = page.getByRole("tab", { name: "Card Actions" });
    await expect(cardActionsTab).toBeVisible();
    await cardActionsTab.click();

    // 4. Verify Read-Only Display of Employee Data
    await expect(page.getByRole("heading", { name: "Employee Profile" })).toBeVisible();
    await expect(page.getByText("Jane Doe")).toBeVisible();
    await expect(page.getByText("8901234567890")).toBeVisible();
    await expect(page.getByText("Senior Operator")).toBeVisible();
    await expect(page.getByText("Pit A, Control Room")).toBeVisible();

    // 5. Verify UI for Card Actions tab (Inputs, Selectors)
    await expect(page.getByLabel(/Magnetic Stripe Data/i)).toBeVisible();
    await expect(page.getByText(/HoloKote Design/i)).toBeVisible();
    await expect(page.getByText(/Printer Status/i)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Print Preview" })).toBeVisible();

    // 6. Initiate Card Print
    const printButton = page.getByRole("button", {
      name: /Initiate Card Print/i,
    });
    await expect(printButton).toBeEnabled();
    await printButton.click();

    // 7. Verify status change
    await expect(printButton).toBeDisabled();
    await expect(page.getByText(/Printing.../i)).toBeVisible();

    // Wait for the mock job to finish
    await expect(printButton).toBeEnabled({ timeout: 5000 });
  });
});
