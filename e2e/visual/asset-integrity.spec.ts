import { expect, test } from '@playwright/test';
import { loginWithTestUser } from '../helpers/auth';

/**
 * Production Asset Resolution & CSP Regression Test Suite
 *
 * Prevents regressions across:
 * 1. Cloudinary / local fallback image rendering on Hero carousel and Department cards.
 * 2. CSP connect-src allowlisting of https://api.open-meteo.com.
 * 3. CSP media-src allowlisting of https://res.cloudinary.com.
 * 4. Zero CSP console violations in browser runtime.
 */
test.describe('Asset Integrity & CSP Gating', () => {
  test('Hub loads with all visual assets rendered and zero CSP violations', async ({
    page,
    context,
  }) => {
    const cspViolations: string[] = [];
    const failedImageUrls: string[] = [];

    // Monitor browser console for CSP violations
    page.on('console', (msg) => {
      const text = msg.text();
      if (
        text.includes('violates the following Content Security Policy directive') ||
        text.includes('Refused to connect') ||
        text.includes('Refused to load')
      ) {
        cspViolations.push(text);
      }
    });

    // Monitor network traffic for failed department images
    page.on('response', (res) => {
      const url = res.url();
      const status = res.status();

      if (
        (url.includes('/images/departments/') ||
          url.includes('res.cloudinary.com/zwevvryv/image/')) &&
        status >= 400
      ) {
        failedImageUrls.push(`${url} [${status}]`);
      }
    });

    // 1. Authenticate and navigate to /hub
    await loginWithTestUser(context, page);
    await page.goto('/hub', { waitUntil: 'domcontentloaded' });

    // Wait for the main shell and cards to mount
    const heroCarousel = page.locator('[role="region"][aria-label="Department Hero Highlights"]');
    await heroCarousel.waitFor({ state: 'visible', timeout: 15000 });
    await heroCarousel.scrollIntoViewIfNeeded();

    // 2. Verify Hero carousel image rendered with natural dimensions
    const heroImg = heroCarousel.locator('img').first();
    await heroImg.waitFor({ state: 'visible', timeout: 10000 });
    await page.waitForFunction(
      (el) => (el as HTMLImageElement).complete && (el as HTMLImageElement).naturalWidth > 0,
      await heroImg.elementHandle()
    );

    const heroImageStats = await heroImg.evaluate((img: HTMLImageElement) => ({
      src: img.src,
      complete: img.complete,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
    }));

    expect(heroImageStats.complete).toBe(true);
    expect(heroImageStats.naturalWidth).toBeGreaterThan(0);

    // 3. Scroll to Department Modules to trigger lazy-loaded card banners
    const firstDeptCard = page.locator('.uiverse-card-banner').first();
    await firstDeptCard.waitFor({ state: 'visible', timeout: 10000 });
    await firstDeptCard.scrollIntoViewIfNeeded();

    // Wait for department card images to finish loading across viewports
    await page.evaluate(async () => {
      const images = Array.from(
        document.querySelectorAll('.uiverse-card-banner img')
      ) as HTMLImageElement[];
      await Promise.all(
        images.map(
          (img) =>
            new Promise<void>((resolve) => {
              if (img.complete && img.naturalWidth > 0) return resolve();
              img.onload = () => resolve();
              img.onerror = () => resolve();
              setTimeout(resolve, 5000);
            })
        )
      );
    });

    const departmentCardStats = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.uiverse-card-banner'));
      return cards.map((card) => {
        const img = card.querySelector('img') as HTMLImageElement | null;
        return {
          hasImg: !!img,
          src: img?.src || '',
          complete: img?.complete ?? false,
          naturalWidth: img?.naturalWidth ?? 0,
        };
      });
    });

    expect(departmentCardStats.length).toBeGreaterThan(0);
    for (const card of departmentCardStats) {
      expect(card.hasImg).toBe(true);
      expect(card.complete).toBe(true);
      expect(card.naturalWidth).toBeGreaterThan(0);
    }

    // 4. Verify no department image requests failed with HTTP errors
    expect(failedImageUrls).toEqual([]);

    // 5. Verify zero CSP console violations occurred
    expect(cspViolations).toEqual([]);
  });
});
