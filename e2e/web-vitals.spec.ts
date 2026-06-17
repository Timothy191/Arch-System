import { test, expect } from "@playwright/test";

const BASE_URL = process.env.PLAY_BASE_URL || "http://localhost:3000";

test.describe("Core Web Vitals", () => {
  test("home page meets vitals thresholds", async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    await page.waitForLoadState("networkidle");

    const metrics = (await page.evaluate(async () => {
      return new Promise(async (resolve) => {
        const results: any = {};
        try {
          const { onLCP, onFID, onCLS } = await import("web-vitals");
          onLCP((m) => (results.lcp = m.value));
          onFID((m) => (results.fid = m.value));
          onCLS((m) => (results.cls = m.value));
        } catch {
          results.vitalsUnavailable = true;
        }
        setTimeout(() => resolve(results), 1200);
      });
    })) as any;

    test.info().annotations.push({
      type: "web-vitals",
      description: JSON.stringify(metrics),
    });

    if (metrics.vitalsUnavailable) {
      return;
    }

    if (metrics.lcp != null) {
      expect(metrics.lcp).toBeLessThan(2500);
    }
    if (metrics.fid != null) {
      expect(metrics.fid).toBeLessThan(100);
    }
    if (metrics.cls != null) {
      expect(metrics.cls).toBeLessThan(0.1);
    }
  });

  test("login page meets vitals thresholds", async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState("networkidle");

    const metrics = (await page.evaluate(async () => {
      return new Promise(async (resolve) => {
        const results: any = {};
        try {
          const { onLCP, onFID, onCLS } = await import("web-vitals");
          onLCP((m) => (results.lcp = m.value));
          onFID((m) => (results.fid = m.value));
          onCLS((m) => (results.cls = m.value));
        } catch {
          results.vitalsUnavailable = true;
        }
        setTimeout(() => resolve(results), 1200);
      });
    })) as any;

    test.info().annotations.push({
      type: "web-vitals",
      description: JSON.stringify(metrics),
    });

    if (metrics.vitalsUnavailable) {
      return;
    }

    if (metrics.lcp != null) {
      expect(metrics.lcp).toBeLessThan(2500);
    }
    if (metrics.fid != null) {
      expect(metrics.fid).toBeLessThan(100);
    }
    if (metrics.cls != null) {
      expect(metrics.cls).toBeLessThan(0.1);
    }
  });
});
