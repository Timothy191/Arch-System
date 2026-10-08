import { expect, test } from '@playwright/test';
import { loginWithTestUser } from '../helpers/auth';

/**
 * Production Asset Resolution & CSP Regression Test Suite
 *
 * Prevents regressions across:
 * 1. Hub mount and shell initialization.
 * 2. Cloudinary / local fallback image rendering on Hero carousel.
 * 3. Department cards visual banner rendering.
 * 4. Zero failed image requests (HTTP >= 400).
 * 5. Zero CSP console violations in browser runtime.
 * 6. Open-Meteo weather API connectivity (HTTP 200).
 * 7. Cloudinary video background element and sources on desktop viewports.
 */
test.describe('Asset Integrity & CSP Gating', () => {
  test('Hub loads with all visual assets rendered and zero CSP violations', async ({
    page,
    context,
  }) => {
    const cspViolations: string[] = [];
    const failedImageUrls: string[] = [];
    let openMeteoStatusCode: number | null = null;
    let mediaRequestBlocked = false;

    // Monitor browser console and document events for CSP violations
    await page.addInitScript(() => {
      window.addEventListener('securitypolicyviolation', (e) => {
        console.error(
          `[CSP Violation Event] blockedURI: ${e.blockedURI}, violatedDirective: ${e.violatedDirective}`
        );
      });
    });

    page.on('console', (msg) => {
      const text = msg.text();
      if (
        text.includes('violates the following Content Security Policy directive') ||
        text.includes('Refused to connect') ||
        text.includes('Refused to load') ||
        text.includes('[CSP Violation Event]')
      ) {
        cspViolations.push(text);
        if (text.includes('media-src') || text.includes('res.cloudinary.com/video')) {
          mediaRequestBlocked = true;
        }
      }
    });

    // Monitor network traffic for failed assets and weather API
    page.on('response', (res) => {
      const url = res.url();
      const status = res.status();

      // Check Open-Meteo API response
      if (url.includes('api.open-meteo.com')) {
        openMeteoStatusCode = status;
      }

      // Track failed department images
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

    // 1. Assertion: /hub successfully mounts main shell
    const heroCarousel = page.locator('[role="region"][aria-label="Department Hero Highlights"]');
    await heroCarousel.waitFor({ state: 'visible', timeout: 15000 });
    await heroCarousel.scrollIntoViewIfNeeded();

    // 2. Assertion: Hero image exists, complete === true, naturalWidth > 0
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

    console.log(
      `[RELEASE-GATE EVIDENCE] Hero Image: complete=${heroImageStats.complete}, naturalWidth=${heroImageStats.naturalWidth}px, src=${heroImageStats.src}`
    );

    // 3. Assertion: Department cards every .uiverse-card-banner image is loaded with naturalWidth > 0
    const firstDeptCard = page.locator('.uiverse-card-banner').first();
    await firstDeptCard.waitFor({ state: 'visible', timeout: 10000 });
    await firstDeptCard.scrollIntoViewIfNeeded();

    // Await lazy-loaded card images across viewports
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

    console.log(
      `[RELEASE-GATE EVIDENCE] Department Cards: count=${departmentCardStats.length}, allValid=${departmentCardStats.every((c) => c.hasImg && c.complete && c.naturalWidth > 0)}`
    );
    console.log(
      `[RELEASE-GATE EVIDENCE] Asset Network Health: failedImageUrls=${failedImageUrls.length}`
    );
    console.log(
      `[RELEASE-GATE EVIDENCE] CSP Violations: count=${cspViolations.length}`
    );

    // 4. Assertion: Asset network health (zero failed image requests)
    expect(failedImageUrls).toEqual([]);

    // 5. Assertion: CSP (zero CSP violations during test lifecycle)
    expect(cspViolations).toEqual([]);

    // 6. Assertion: Weather API (confirm HTTP 200 when initialized)
    if (openMeteoStatusCode !== null) {
      expect(openMeteoStatusCode).toBe(200);
    }

    // 7. Assertion: Video background element and sources on desktop viewports
    const isDesktop = (page.viewportSize()?.width ?? 1280) >= 768;
    let videoExists = 0;
    if (isDesktop) {
      // Await deferred background video container if rendered
      await page.waitForSelector('#route-bg-light-video', { timeout: 8000 }).catch(() => {});
      videoExists = await page.locator('#route-bg-light-video').count();
      if (videoExists > 0) {
        const sourceUrls = await page.evaluate(() => {
          const video = document.getElementById('route-bg-light-video') as HTMLVideoElement | null;
          if (!video) return [];
          return Array.from(video.querySelectorAll('source')).map((s) => s.src);
        });
        expect(sourceUrls.some((u) => u.includes('res.cloudinary.com'))).toBe(true);
      }
      expect(mediaRequestBlocked).toBe(false);
    }
    console.log(
      `[RELEASE-GATE EVIDENCE] Video Element: isDesktop=${isDesktop}, videoPresent=${videoExists > 0}, mediaBlocked=${mediaRequestBlocked}`
    );
    console.log(
      `[RELEASE-GATE EVIDENCE] Open-Meteo: status=${openMeteoStatusCode ?? 'NOT_TRIGGERED'}`
    );
  });
});
