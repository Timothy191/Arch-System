import { Page } from "@playwright/test";

/** The global RouteBackground's LCP image — proves the background is mounted. */
export const ROUTE_BG_SELECTOR = "#route-bg-light-image";

export interface OpaqueLayer {
  tag: string;
  className: string;
  backgroundColor: string;
}

/**
 * Returns every ancestor of `contentSelector` that paints an effectively opaque
 * background, up to (but excluding) <html>.
 *
 * This exists because the previous guardrail read `document.body`, which is
 * `rgba(0, 0, 0, 0)` — transparent — so it could not see a page-level fill. A
 * fully opaque ancestor is exactly what covers the global RouteBackground: the
 * login page shipped `bg-[#f3f4f6]` on its own <main> and hid the wallpaper
 * while body stayed transparent. Read the ancestors, not body.
 */
export async function findOpaqueBackgroundLayers(
  page: Page,
  contentSelector: string,
): Promise<OpaqueLayer[]> {
  return page.evaluate((sel) => {
    const content = document.querySelector(sel);
    if (!content) {
      throw new Error(`findOpaqueBackgroundLayers: no element matches ${sel}`);
    }

    const alphaOf = (bg: string): number | null => {
      const m = bg.match(/^rgba?\(([^)]+)\)$/);
      if (!m) return null;
      const parts = m[1].split(",").map((s) => s.trim());
      const alpha = parts.length === 4 ? Number(parts[3]) : 1;
      return Number.isFinite(alpha) ? alpha : null;
    };

    const offenders: OpaqueLayer[] = [];
    let el: HTMLElement | null = content.parentElement;
    while (el && el !== document.documentElement) {
      const bg = getComputedStyle(el).backgroundColor;
      const alpha = alphaOf(bg);
      if (alpha !== null && alpha >= 0.95) {
        offenders.push({
          tag: el.tagName.toLowerCase(),
          className: typeof el.className === "string" ? el.className : "",
          backgroundColor: bg,
        });
      }
      el = el.parentElement;
    }
    return offenders;
  }, contentSelector);
}

/** Mean of the rgb channels of a computed color, or null if unparseable. */
export function luminanceOf(color: string): number | null {
  const m = color.match(/^rgba?\(([^)]+)\)$/);
  if (!m) return null;
  const [r, g, b] = m[1]
    .split(",")
    .slice(0, 3)
    .map((s) => Number(s.trim()));
  if (r === undefined || g === undefined || b === undefined) return null;
  return (r + g + b) / 3;
}
