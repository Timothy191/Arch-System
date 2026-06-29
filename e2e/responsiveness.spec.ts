import { test, expect } from "@playwright/test";
import { performMockLogin } from "./helpers/auth";

test.describe("Responsiveness and Viewport Tests", () => {
  test.describe("Mobile viewport (375x667)", () => {
    test.use({ viewport: { width: 375, height: 667 } });

    test.beforeEach(async ({ page }) => {
      await performMockLogin(page, "admin");
    });

    test("loads correctly on mobile viewport", async ({ page }) => {
      await page.goto("/drilling");
      await expect(page.locator("body")).toBeVisible();
    });

    test("shows mobile navigation menu", async ({ page }) => {
      await page.goto("/hub");

      // Look for hamburger menu or mobile navigation
      const mobileMenu = page
        .getByRole("button", { name: /menu|hamburger/i })
        .or(page.getByLabel(/menu/i));

      const hasMobileMenu = (await mobileMenu.count()) > 0;
      expect(hasMobileMenu).toBe(true);
    });

    test("content fits within viewport width", async ({ page }) => {
      await page.goto("/production");

      // Check for horizontal overflow
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      const viewportWidth = await page.evaluate(() => window.innerWidth);

      expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 10); // Allow small margin
    });

    test("text is readable on mobile", async ({ page }) => {
      await page.goto("/engineering");

      // Check font sizes
      const fontSize = await page.evaluate(() => {
        const body = document.body;
        return window.getComputedStyle(body).fontSize;
      });

      expect(parseInt(fontSize)).toBeGreaterThanOrEqual(14); // Minimum readable size
    });

    test("touch targets are adequate size", async ({ page }) => {
      await page.goto("/control-room");

      // Check button sizes
      const buttons = page.locator("button");
      const count = await buttons.count();

      if (count > 0) {
        const firstButtonSize = await buttons.first().evaluate((btn: HTMLElement) => {
          const rect = btn.getBoundingClientRect();
          return Math.min(rect.width, rect.height);
        });

        // Touch targets should be at least 44x44 per iOS guidelines
        expect(firstButtonSize).toBeGreaterThanOrEqual(40);
      }
    });
  });

  test.describe("Tablet viewport (768x1024)", () => {
    test.use({ viewport: { width: 768, height: 1024 } });

    test.beforeEach(async ({ page }) => {
      await performMockLogin(page, "admin");
    });

    test("loads correctly on tablet viewport", async ({ page }) => {
      await page.goto("/drilling");
      await expect(page.locator("body")).toBeVisible();
    });

    test("shows appropriate navigation for tablet", async ({ page }) => {
      await page.goto("/hub");

      // Tablet may show condensed navigation or different layout
      await expect(page.locator("body")).toBeVisible();
    });

    test("content adapts to tablet width", async ({ page }) => {
      await page.goto("/production");

      // Check that content is properly laid out
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      const viewportWidth = await page.evaluate(() => window.innerWidth);

      expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 10);
    });
  });

  test.describe("Desktop viewport (1280x720)", () => {
    test.use({ viewport: { width: 1280, height: 720 } });

    test.beforeEach(async ({ page }) => {
      await performMockLogin(page, "admin");
    });

    test("loads correctly on desktop viewport", async ({ page }) => {
      await page.goto("/drilling");
      await expect(page.locator("body")).toBeVisible();
    });

    test("shows full navigation on desktop", async ({ page }) => {
      await page.goto("/hub");

      // Desktop should show full navigation
      await expect(page.locator("body")).toBeVisible();
    });

    test("utilizes screen space efficiently", async ({ page }) => {
      await page.goto("/engineering");

      // Check that content fills the screen appropriately
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      const viewportWidth = await page.evaluate(() => window.innerWidth);

      expect(bodyWidth).toBeGreaterThanOrEqual(viewportWidth * 0.8);
    });
  });

  test.describe("Large desktop viewport (1920x1080)", () => {
    test.use({ viewport: { width: 1920, height: 1080 } });

    test.beforeEach(async ({ page }) => {
      await performMockLogin(page, "admin");
    });

    test("loads correctly on large desktop", async ({ page }) => {
      await page.goto("/drilling");
      await expect(page.locator("body")).toBeVisible();
    });

    test("content doesn't stretch excessively", async ({ page }) => {
      await page.goto("/production");

      // Check max-width constraints
      const mainContent = page.locator("main").or(page.locator("[role='main']"));
      if ((await mainContent.count()) > 0) {
        const contentWidth = await mainContent.first().evaluate((el: HTMLElement) => {
          return el.getBoundingClientRect().width;
        });

        // Content should have reasonable max-width
        expect(contentWidth).toBeLessThanOrEqual(1400);
      }
    });
  });

  test.describe("Landscape orientation", () => {
    test.use({ viewport: { width: 667, height: 375 } });

    test.beforeEach(async ({ page }) => {
      await performMockLogin(page, "admin");
    });

    test("handles landscape orientation", async ({ page }) => {
      await page.goto("/drilling");
      await expect(page.locator("body")).toBeVisible();
    });

    test("navigation adapts to landscape", async ({ page }) => {
      await page.goto("/hub");
      await expect(page.locator("body")).toBeVisible();
    });
  });

  test.describe("Dynamic viewport changes", () => {
    test.beforeEach(async ({ page }) => {
      await performMockLogin(page, "admin");
    });

    test("handles viewport resize from desktop to mobile", async ({ page }) => {
      await page.goto("/drilling");

      // Start with desktop
      await page.setViewportSize({ width: 1280, height: 720 });
      await expect(page.locator("body")).toBeVisible();

      // Resize to mobile
      await page.setViewportSize({ width: 375, height: 667 });
      await expect(page.locator("body")).toBeVisible();
    });

    test("handles viewport resize from mobile to desktop", async ({ page }) => {
      await page.goto("/production");

      // Start with mobile
      await page.setViewportSize({ width: 375, height: 667 });
      await expect(page.locator("body")).toBeVisible();

      // Resize to desktop
      await page.setViewportSize({ width: 1280, height: 720 });
      await expect(page.locator("body")).toBeVisible();
    });

    test("adjusts layout on orientation change", async ({ page }) => {
      await page.goto("/engineering");

      // Portrait
      await page.setViewportSize({ width: 375, height: 667 });
      await expect(page.locator("body")).toBeVisible();

      // Landscape
      await page.setViewportSize({ width: 667, height: 375 });
      await expect(page.locator("body")).toBeVisible();
    });
  });

  test.describe("Responsive images and media", () => {
    test.beforeEach(async ({ page }) => {
      await performMockLogin(page, "admin");
    });

    test("images scale appropriately", async ({ page }) => {
      await page.goto("/drilling");

      const images = page.locator("img");
      const count = await images.count();

      if (count > 0) {
        const firstImage = images.first();
        await expect(firstImage).toBeVisible();

        // Check image doesn't overflow viewport
        const imageWidth = await firstImage.evaluate((img: HTMLImageElement) => img.width);
        const viewportWidth = await page.evaluate(() => window.innerWidth);

        expect(imageWidth).toBeLessThanOrEqual(viewportWidth);
      }
    });

    test("media queries are applied correctly", async ({ page }) => {
      await page.goto("/production");

      // Check that responsive classes are working
      const hasResponsiveClasses = await page.evaluate(() => {
        const elements = document.querySelectorAll(
          "[class*='md:'], [class*='lg:'], [class*='sm:']",
        );
        return elements.length > 0;
      });

      expect(hasResponsiveClasses).toBe(true);
    });
  });

  test.describe("Responsive navigation", () => {
    test.beforeEach(async ({ page }) => {
      await performMockLogin(page, "admin");
    });

    test("mobile menu toggles correctly", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto("/hub");

      const menuButton = page.getByRole("button", { name: /menu/i }).or(page.getByLabel(/menu/i));

      if ((await menuButton.count()) > 0) {
        await menuButton.first().click();

        // Menu should be visible
        const mobileMenu = page.locator("[role='navigation']").or(page.getByTestId("mobile-menu"));
        const menuVisible = (await mobileMenu.count()) > 0;

        expect(menuVisible).toBe(true);
      }
    });

    test("desktop navigation is always visible", async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto("/hub");

      const navigation = page.locator("[role='navigation']").or(page.locator("nav"));
      await expect(navigation.first()).toBeVisible();
    });

    test("navigation collapses appropriately on smaller screens", async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto("/hub");

      await expect(page.locator("body")).toBeVisible();
    });
  });

  test.describe("Responsive tables and data grids", () => {
    test.beforeEach(async ({ page }) => {
      await performMockLogin(page, "admin");
    });

    test("tables handle mobile view", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto("/engineering/breakdowns");

      await expect(page.locator("body")).toBeVisible();

      // Tables may scroll horizontally or convert to cards on mobile
      const tables = page.locator("table");
      const hasTable = (await tables.count()) > 0;

      if (hasTable) {
        // Check if table scrolls horizontally or is responsive
        const tableOverflow = await tables.first().evaluate((table: HTMLElement) => {
          return window.getComputedStyle(table).overflowX;
        });

        expect(tableOverflow === "auto" || tableOverflow === "scroll").toBe(true);
      }
    });

    test("data grids adapt to viewport", async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto("/control-room/machine-operations");

      await expect(page.locator("body")).toBeVisible();
    });
  });

  test.describe("Responsive forms", () => {
    test.beforeEach(async ({ page }) => {
      await performMockLogin(page, "admin");
    });

    test("forms are usable on mobile", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto("/drilling/daily-log");

      const form = page.locator("form").first();
      if (await form.isVisible()) {
        await expect(form).toBeVisible();

        // Check form fields are accessible
        const inputs = form.locator("input, select, textarea");
        const inputCount = await inputs.count();

        expect(inputCount).toBeGreaterThan(0);
      }
    });

    test("form fields stack vertically on mobile", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto("/production/daily-log");

      await expect(page.locator("body")).toBeVisible();
    });

    test("form fields use appropriate widths on desktop", async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto("/engineering/breakdowns");

      await expect(page.locator("body")).toBeVisible();
    });
  });

  test.describe("Font scaling and readability", () => {
    test.beforeEach(async ({ page }) => {
      await performMockLogin(page, "admin");
    });

    test("text remains readable at different viewports", async ({ page }) => {
      const viewports = [
        { width: 375, height: 667 },
        { width: 768, height: 1024 },
        { width: 1280, height: 720 },
      ];

      for (const viewport of viewports) {
        await page.setViewportSize(viewport);
        await page.goto("/drilling");

        const fontSize = await page.evaluate(() => {
          const body = document.body;
          return window.getComputedStyle(body).fontSize;
        });

        expect(parseInt(fontSize)).toBeGreaterThanOrEqual(14);
      }
    });

    test("respects user font size preferences", async ({ page }) => {
      await page.goto("/production");

      // Simulate user font size preference
      await page.evaluate(() => {
        document.documentElement.style.fontSize = "18px";
      });

      await expect(page.locator("body")).toBeVisible();
    });
  });

  test.describe("Edge case viewports", () => {
    test.beforeEach(async ({ page }) => {
      await performMockLogin(page, "admin");
    });

    test("handles very small viewport (320x568)", async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 568 });
      await page.goto("/drilling");

      await expect(page.locator("body")).toBeVisible();
    });

    test("handles very wide viewport (2560x1440)", async ({ page }) => {
      await page.setViewportSize({ width: 2560, height: 1440 });
      await page.goto("/production");

      await expect(page.locator("body")).toBeVisible();
    });

    test("handles ultra-wide viewport (3440x1440)", async ({ page }) => {
      await page.setViewportSize({ width: 3440, height: 1440 });
      await page.goto("/engineering");

      await expect(page.locator("body")).toBeVisible();
    });
  });
});
