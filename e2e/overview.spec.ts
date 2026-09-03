import { test, expect } from "@playwright/test";

test.describe("Overview & Interactive React Flow Topology E2E", () => {
  test("navigates to /overview, switches all 8 tabs, and validates React Flow canvas with zero console errors", async ({
    page,
  }) => {
    // 1. Setup Console Error & Exception Listeners
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        const text = msg.text();
        // Ignore browser network resource status errors (e.g. 503/404 on offline services)
        if (
          !text.includes("favicon") &&
          !text.includes("Failed to load resource") &&
          !text.includes("net::ERR_CONNECTION_REFUSED") &&
          !text.includes("AuthRetryableFetchError")
        ) {
          consoleErrors.push(text);
        }
      }
    });

    page.on("pageerror", (error) => {
      pageErrors.push(error.message);
    });

    // 2. Navigate to /overview
    await page.goto("/overview");
    await page.waitForLoadState("domcontentloaded");

    // If redirected to login, perform authentication and navigate to overview
    if (page.url().includes("/login")) {
      const emailInput = page.locator("input#email");
      if (await emailInput.isVisible()) {
        await emailInput.fill("admin@plantcor.os");
        await page.locator("input#password").fill("Yugioh@123#");
        await page.locator("button[type='submit']").click();
        await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 10000 }).catch(() => {});
        await page.goto("/overview");
        await page.waitForLoadState("domcontentloaded");
      }
    }

    // 3. Assert Overview Page Shell and Branding
    await expect(page).toHaveURL(/.*overview/);
    await expect(page.locator("h1")).toContainText("Arch Systems");
    await expect(page.locator("text=System Architecture & Operations Topology")).toBeVisible();

    // 4. Tab 1: System Architecture (React Flow Canvas)
    const tabArch = page.getByRole("tab", { name: /System Architecture/i });
    await expect(tabArch).toBeVisible();
    await tabArch.click();
    await expect(page.locator(".react-flow").first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator(".react-flow__node").first()).toBeVisible();

    // 5. Tab 2: Backend Topology (React Flow Canvas)
    const tabBackend = page.getByRole("tab", { name: /Backend Topology/i });
    await expect(tabBackend).toBeVisible();
    await tabBackend.click();
    await expect(page.locator(".react-flow").first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator(".react-flow__node").first()).toBeVisible();

    // 6. Tab 3: Departments
    const tabDepts = page.getByRole("tab", { name: /Departments/i });
    await expect(tabDepts).toBeVisible();
    await tabDepts.click();
    await expect(page.locator("text=Drilling").first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=Engineering").first()).toBeVisible();

    // 7. Tab 4: Tech Stack
    const tabTech = page.getByRole("tab", { name: /Tech Stack/i });
    await expect(tabTech).toBeVisible();
    await tabTech.click();
    await expect(page.locator("text=Next.js 16").first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=Framer Motion").first()).toBeVisible();

    // 8. Tab 5: Database Schema
    const tabDb = page.getByRole("tab", { name: /Database Schema/i });
    await expect(tabDb).toBeVisible();
    await tabDb.click();
    await expect(page.locator("h2:has-text('Database Schema')").first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=Row Level Security (RLS) policies").first()).toBeVisible();

    // 9. Tab 6: Docs & Maps
    const tabDocs = page.getByRole("tab", { name: /Docs & Maps/i });
    await expect(tabDocs).toBeVisible();
    await tabDocs.click();
    await expect(page.locator("text=Automated Codebase Maps & Topology Catalog").first()).toBeVisible({ timeout: 10000 });

    // 10. Tab 7: Audit & Compliance
    const tabAudit = page.getByRole("tab", { name: /Audit & Compliance/i });
    await expect(tabAudit).toBeVisible();
    await tabAudit.click();
    await expect(page.locator("text=Automated Audit & Compliance System").first()).toBeVisible({ timeout: 10000 });

    // 11. Tab 8: Agentic Monitor
    const tabAgentic = page.getByRole("tab", { name: /Agentic Monitor/i });
    await expect(tabAgentic).toBeVisible();
    await tabAgentic.click();
    await expect(page.locator("text=Multi-Agent Coding System Distribution & Token Share").first()).toBeVisible({ timeout: 10000 });

    // 12. Assert Zero Console and Page Errors
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
    console.log("✅ All 8 Overview tabs validated successfully with 0 console errors in React Flow");
  });
});
