import { test, expect } from "@playwright/test";

test("open login screen", async ({ page }) => {
  await page.goto("http://localhost:3000");
  // Adjust the selector based on the actual login page content if needed
  await expect(page).toHaveURL(/.*login/);
  console.log("Login screen opened successfully");
});
