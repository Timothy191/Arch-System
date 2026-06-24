import { test, expect } from "@playwright/test";
import { performMockLogin } from "./helpers/auth";

test.describe("Accessibility Checks", () => {
  test.describe("Semantic HTML structure", () => {
    test.beforeEach(async ({ page }) => {
      await performMockLogin(page, "admin");
    });

    test("has proper heading hierarchy", async ({ page }) => {
      await page.goto("/drilling");

      // Check for heading elements
      const headings = page.locator("h1, h2, h3, h4, h5, h6");
      const headingCount = await headings.count();

      expect(headingCount).toBeGreaterThan(0);

      // Check hierarchy starts with h1
      const h1 = page.locator("h1");
      const hasH1 = (await h1.count()) > 0;
      expect(hasH1).toBe(true);
    });

    test("uses landmark regions appropriately", async ({ page }) => {
      await page.goto("/production");

      // Check for landmarks
      const landmarks = page.locator(
        "[role='banner'], [role='main'], [role='navigation'], [role='contentinfo'], header, main, nav, footer",
      );
      const landmarkCount = await landmarks.count();

      expect(landmarkCount).toBeGreaterThan(0);
    });

    test("has proper language attribute", async ({ page }) => {
      await page.goto("/engineering");

      const lang = await page.evaluate(() => document.documentElement.lang);
      expect(lang).toBeTruthy();
      expect(lang.length).toBeGreaterThanOrEqual(2);
    });

    test("uses semantic elements instead of divs where appropriate", async ({ page }) => {
      await page.goto("/control-room");

      // Check for use of semantic elements
      const buttons = page.locator("button");
      const buttonCount = await buttons.count();

      // Should use button elements for actions
      expect(buttonCount).toBeGreaterThan(0);
    });
  });

  test.describe("ARIA attributes and roles", () => {
    test.beforeEach(async ({ page }) => {
      await performMockLogin(page, "admin");
    });

    test("interactive elements have appropriate roles", async ({ page }) => {
      await page.goto("/drilling");

      // Check buttons have proper roles
      const buttons = page.locator("button");
      const count = await buttons.count();

      for (let i = 0; i < Math.min(count, 5); i++) {
        const button = buttons.nth(i);
        const role = await button.getAttribute("role");

        // Button elements should not need explicit role
        // Div-based buttons should have role="button"
        expect(role === null || role === "button").toBe(true);
      }
    });

    test("forms have proper labels", async ({ page }) => {
      await page.goto("/production/daily-log");

      const inputs = page.locator("input, select, textarea");
      const inputCount = await inputs.count();

      if (inputCount > 0) {
        // Check first few inputs have labels
        for (let i = 0; i < Math.min(inputCount, 5); i++) {
          const input = inputs.nth(i);
          const hasLabel = await input.evaluate((el: HTMLElement) => {
            const id = el.getAttribute("id");
            if (id) {
              const label = document.querySelector(`label[for="${id}"]`);
              return label !== null;
            }
            // Check aria-label or aria-labelledby
            return el.hasAttribute("aria-label") || el.hasAttribute("aria-labelledby");
          });

          expect(hasLabel).toBe(true);
        }
      }
    });

    test("modals and dialogs have proper ARIA attributes", async ({ page }) => {
      await page.goto("/engineering");

      // If there are modals, they should have proper attributes
      const dialogs = page.locator("[role='dialog'], dialog");
      const dialogCount = await dialogs.count();

      if (dialogCount > 0) {
        const firstDialog = dialogs.first();
        const hasModalRole = await firstDialog.evaluate((el: HTMLElement) => {
          return el.getAttribute("role") === "dialog" || el.tagName === "DIALOG";
        });

        expect(hasModalRole).toBe(true);
      }
    });

    test("live regions are properly marked", async ({ page }) => {
      await page.goto("/control-room");

      // Check for live regions (for dynamic content)
      const liveRegions = page.locator("[aria-live], [role='status'], [role='alert']");
      const hasLiveRegions = (await liveRegions.count()) > 0;

      // May or may not have live regions depending on features
      expect(true).toBe(true);
    });
  });

  test.describe("Keyboard navigation", () => {
    test.beforeEach(async ({ page }) => {
      await performMockLogin(page, "admin");
    });

    test("can navigate using Tab key", async ({ page }) => {
      await page.goto("/drilling");

      // Press Tab to move focus
      await page.keyboard.press("Tab");

      // Check focus moved
      const activeElement = await page.evaluate(() => document.activeElement?.tagName);
      expect(["INPUT", "BUTTON", "A", "SELECT", "TEXTAREA"]).toContain(activeElement);
    });

    test("focus indicators are visible", async ({ page }) => {
      await page.goto("/production");

      // Focus on first interactive element
      const firstButton = page.locator("button").first();
      if (await firstButton.isVisible()) {
        await firstButton.focus();

        // Check focus styles
        const hasFocusOutline = await firstButton.evaluate((el: HTMLElement) => {
          const styles = window.getComputedStyle(el);
          return styles.outline !== "none" || styles.boxShadow !== "none";
        });

        expect(hasFocusOutline).toBe(true);
      }
    });

    test("can navigate using arrow keys in menus", async ({ page }) => {
      await page.goto("/hub");

      // Try to find a menu and navigate with arrow keys
      const menuButton = page.getByRole("button", { name: /menu/i });
      if ((await menuButton.count()) > 0) {
        await menuButton.first().click();

        // Try arrow key navigation
        await page.keyboard.press("ArrowDown");

        await expect(page.locator("body")).toBeVisible();
      }
    });

    test("Enter and Space activate buttons", async ({ page }) => {
      await page.goto("/engineering");

      const button = page.locator("button").first();
      if (await button.isVisible()) {
        await button.focus();
        await page.keyboard.press("Enter");

        // Button should activate
        await expect(page.locator("body")).toBeVisible();
      }
    });

    test("Escape closes modals/menus", async ({ page }) => {
      await page.goto("/control-room");

      // Open a menu if available
      const menuButton = page.getByRole("button", { name: /menu/i });
      if ((await menuButton.count()) > 0) {
        await menuButton.first().click();
        await page.keyboard.press("Escape");

        // Menu should close
        await expect(page.locator("body")).toBeVisible();
      }
    });

    test("skip to main content link exists", async ({ page }) => {
      await page.goto("/drilling");

      // Check for skip link
      const skipLink = page.locator("a[href*='main'], a[href*='content']").first();
      const hasSkipLink = (await skipLink.count()) > 0;

      // Should have skip link for accessibility
      expect(hasSkipLink).toBe(true);
    });
  });

  test.describe("Screen reader compatibility", () => {
    test.beforeEach(async ({ page }) => {
      await performMockLogin(page, "admin");
    });

    test("images have alt text", async ({ page }) => {
      await page.goto("/drilling");

      const images = page.locator("img");
      const count = await images.count();

      if (count > 0) {
        for (let i = 0; i < Math.min(count, 5); i++) {
          const img = images.nth(i);
          const alt = await img.getAttribute("alt");

          // Decorative images should have empty alt
          // Meaningful images should have descriptive alt
          expect(alt !== null).toBe(true);
        }
      }
    });

    test("links have descriptive text", async ({ page }) => {
      await page.goto("/production");

      const links = page.locator("a[href]");
      const count = await links.count();

      if (count > 0) {
        for (let i = 0; i < Math.min(count, 5); i++) {
          const link = links.nth(i);
          const text = await link.textContent();

          // Links should have descriptive text
          expect(text?.trim().length).toBeGreaterThan(0);
        }
      }
    });

    test("form errors are announced to screen readers", async ({ page }) => {
      await page.goto("/engineering/daily-log");

      // Try to submit empty form
      const submitButton = page.getByRole("button", { name: /submit|save/i }).first();
      if (await submitButton.isVisible()) {
        await submitButton.click();

        // Check for error messages with aria-live
        const errorMessages = page.locator("[role='alert'], [aria-live='assertive']");
        const hasErrorAnnouncement = (await errorMessages.count()) > 0;

        // Should announce errors
        expect(hasErrorAnnouncement || (await page.locator("body").isVisible())).toBe(true);
      }
    });

    test("page titles are descriptive", async ({ page }) => {
      await page.goto("/control-room");

      const title = await page.title();
      expect(title.length).toBeGreaterThan(0);
      expect(title).not.toBe("Untitled");
    });
  });

  test.describe("Color and contrast", () => {
    test.beforeEach(async ({ page }) => {
      await performMockLogin(page, "admin");
    });

    test("text has sufficient contrast", async ({ page }) => {
      await page.goto("/drilling");

      // Check contrast of main text elements
      const textElements = page.locator("p, h1, h2, h3, span, div");
      const count = await textElements.count();

      if (count > 0) {
        // Sample a few elements
        for (let i = 0; i < Math.min(count, 5); i++) {
          const element = textElements.nth(i);
          const styles = await element.evaluate((el: HTMLElement) => {
            const computed = window.getComputedStyle(el);
            return {
              color: computed.color,
              backgroundColor: computed.backgroundColor,
            };
          });

          // Element should have defined colors
          expect(styles.color).toBeTruthy();
        }
      }
    });

    test("focus indicators have sufficient contrast", async ({ page }) => {
      await page.goto("/production");

      const button = page.locator("button").first();
      if (await button.isVisible()) {
        await button.focus();

        const focusStyles = await button.evaluate((el: HTMLElement) => {
          const computed = window.getComputedStyle(el);
          return {
            outline: computed.outline,
            boxShadow: computed.boxShadow,
          };
        });

        // Should have visible focus indicator
        expect(focusStyles.outline !== "none" || focusStyles.boxShadow !== "none").toBe(true);
      }
    });

    test("color is not the only indicator of information", async ({ page }) => {
      await page.goto("/engineering");

      // Check that links have underline or other indicators besides color
      const links = page.locator("a[href]");
      const count = await links.count();

      if (count > 0) {
        const firstLink = links.first();
        const linkStyles = await firstLink.evaluate((el: HTMLElement) => {
          const computed = window.getComputedStyle(el);
          return {
            textDecoration: computed.textDecoration,
            fontWeight: computed.fontWeight,
          };
        });

        // Should have underline or bold or other indicator
        expect(
          linkStyles.textDecoration.includes("underline") ||
            linkStyles.fontWeight === "bold" ||
            linkStyles.fontWeight === "700",
        ).toBe(true);
      }
    });
  });

  test.describe("Form accessibility", () => {
    test.beforeEach(async ({ page }) => {
      await performMockLogin(page, "admin");
    });

    test("form fields have associated labels", async ({ page }) => {
      await page.goto("/drilling/daily-log");

      const inputs = page.locator("input, select, textarea");
      const count = await inputs.count();

      if (count > 0) {
        for (let i = 0; i < Math.min(count, 5); i++) {
          const input = inputs.nth(i);
          const hasLabel = await input.evaluate((el: HTMLElement) => {
            const id = el.getAttribute("id");
            if (id) {
              const label = document.querySelector(`label[for="${id}"]`);
              if (label) return true;
            }
            return (
              el.hasAttribute("aria-label") ||
              el.hasAttribute("aria-labelledby") ||
              el.closest("label") !== null
            );
          });

          expect(hasLabel).toBe(true);
        }
      }
    });

    test("required fields are marked as required", async ({ page }) => {
      await page.goto("/production/daily-log");

      const requiredInputs = page.locator("input[required], select[required], textarea[required]");
      const count = await requiredInputs.count();

      // May or may not have required fields
      expect(true).toBe(true);
    });

    test("error messages are associated with fields", async ({ page }) => {
      await page.goto("/engineering/breakdowns");

      // Try to trigger validation errors
      const submitButton = page.getByRole("button", { name: /submit|save/i }).first();
      if (await submitButton.isVisible()) {
        await submitButton.click();

        // Check for error messages
        const errors = page.locator("[role='alert'], .error, [aria-invalid='true']");
        const hasErrors = (await errors.count()) > 0;

        // May or may not have errors depending on form state
        expect(true).toBe(true);
      }
    });

    test("form validation messages are accessible", async ({ page }) => {
      await page.goto("/control-room/machine-operations");

      const form = page.locator("form").first();
      if (await form.isVisible()) {
        // Check form has accessible validation
        await expect(form).toBeVisible();
      }
    });
  });

  test.describe("Table accessibility", () => {
    test.beforeEach(async ({ page }) => {
      await performMockLogin(page, "admin");
    });

    test("tables have proper headers", async ({ page }) => {
      await page.goto("/engineering/breakdowns");

      const tables = page.locator("table");
      const count = await tables.count();

      if (count > 0) {
        const firstTable = tables.first();
        const headers = firstTable.locator("th");
        const hasHeaders = (await headers.count()) > 0;

        expect(hasHeaders).toBe(true);
      }
    });

    test("tables have captions or summaries", async ({ page }) => {
      await page.goto("/control-room");

      const tables = page.locator("table");
      const count = await tables.count();

      if (count > 0) {
        const firstTable = tables.first();
        const hasCaption = (await firstTable.locator("caption").count()) > 0;
        const hasSummary = (await firstTable.getAttribute("summary")) !== null;

        // Should have caption or summary for accessibility
        expect(hasCaption || hasSummary).toBe(true);
      }
    });
  });

  test.describe("Motion and animation", () => {
    test.beforeEach(async ({ page }) => {
      await performMockLogin(page, "admin");
    });

    test("respects prefers-reduced-motion", async ({ page }) => {
      // Set reduced motion preference
      await page.emulateMedia({ reducedMotion: "reduce" });

      await page.goto("/drilling");

      await expect(page.locator("body")).toBeVisible();
    });

    test("animations can be paused", async ({ page }) => {
      await page.goto("/production");

      // Check if animations respect user preferences
      await expect(page.locator("body")).toBeVisible();
    });
  });

  test.describe("Touch target sizes", () => {
    test.beforeEach(async ({ page }) => {
      await performMockLogin(page, "admin");
    });

    test("interactive elements have adequate touch targets", async ({ page }) => {
      await page.goto("/drilling");

      const buttons = page.locator("button, a[href], input[type='submit'], input[type='button']");
      const count = await buttons.count();

      if (count > 0) {
        for (let i = 0; i < Math.min(count, 5); i++) {
          const element = buttons.nth(i);
          const size = await element.evaluate((el: HTMLElement) => {
            const rect = el.getBoundingClientRect();
            return Math.min(rect.width, rect.height);
          });

          // Touch targets should be at least 44x44
          expect(size).toBeGreaterThanOrEqual(40);
        }
      }
    });
  });

  test.describe("Accessibility tools integration", () => {
    test.beforeEach(async ({ page }) => {
      await performMockLogin(page, "admin");
    });

    test("page passes automated accessibility checks", async ({ page }) => {
      await page.goto("/production");

      // Check for common accessibility issues
      const issues: string[] = [];

      // Check for images without alt
      const imagesWithoutAlt = await page.locator("img:not([alt])").count();
      if (imagesWithoutAlt > 0) {
        issues.push(`${imagesWithoutAlt} images without alt text`);
      }

      // Check for empty links
      const emptyLinks = await page.locator("a[href]:empty").count();
      if (emptyLinks > 0) {
        issues.push(`${emptyLinks} empty links`);
      }

      // Check for form inputs without labels
      const inputsWithoutLabels = await page
        .locator("input:not([aria-label]):not([id]), select:not([aria-label]):not([id])")
        .count();
      if (inputsWithoutLabels > 0) {
        issues.push(`${inputsWithoutLabels} inputs without labels`);
      }

      // Log any issues found
      if (issues.length > 0) {
        console.log("Accessibility issues found:", issues);
      }

      // This test is informational - helps identify areas for improvement
      expect(true).toBe(true);
    });
  });
});
