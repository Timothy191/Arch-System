# Arch-System UI/UX Audit — Branding, Visual Identity & Assets Inventory

**Date:** 2026-10-01  
**Auditor:** UI/UX & Frontend Architecture Auditor  
**Scope:** Static assets, brand logos, imagery, typography assets, and visual design identity across `apps/portal/public` and `@repo/ui`.

---

## 1. Executive Branding Summary: Actual vs Documented Identity

A major forensic finding of this audit is that **the Arch-System codebase embodies three distinct, competing brand identities**, with several third-party trademarks and community logos directly integrated into the production UI:

1. **Identity A: "Arch-System / Arch OS" (Mining Operations Portal)**
   - Displayed in page headers, navigation bars, and shift reports.
   - Associated with opencast coal mining sites (Brakfontein, pit sections).
   - Consumes the **official Arch Linux distribution logo** as its primary corporate symbol.
2. **Identity B: "Plantcor OS" (Plant & Fleet Management)**
   - Legacy brand imagery (`plantcor.png`, `plantcor-header.png`, `plantcor-login.png`) present in `public/` and `public/images/`.
   - Evident in autonomous pipelines (`Plantcor Autonomous Shift Pipeline`).
3. **Identity C: "eve / Vercel AI" (The Agentic System Brand)**
   - Uses the official lowercase **"eve" wordmark** from Vercel Geist brand assets (`vercel.com/geist/brands`).
   - Integrated into the global root layout footer and login `EveStatusBar`.
4. **Identity D: Third-Party Utility Branding**
   - **WhatsApp Web:** Embeds WhatsApp logo and a green `#008069` operations chat interface directly into the macOS title bar and split pane.
   - **GitHub:** Embeds GitHub Octocat icon and mock repository pull requests (`Timothy191/ArchMK2`).
   - **Redis & n8n:** Branded SVG icons embedded in admin console navigation.

---

## 2. Master Asset Inventory

| Asset Path | Type | Dimensions | File Size | Where Used | Duplicated | Optimized | Status |
|---|---|---|---|---|---|---|---|
| `apps/portal/public/logo.svg` | SVG | ViewBox 22.75 16.62 166 166 | 957 B | Favicon reference, auth header | Yes (3 places) | Yes (Vector) | `VERIFIED` |
| `apps/portal/public/archlinux-logo-black-scalable.svg` | SVG | ViewBox 22.75 16.62 166 166 | 952 B | Alternate logo reference | Yes | Yes (Vector) | `DUPLICATED` |
| `apps/portal/public/icons/archlinux-logo-black-scalable.svg` | SVG | ViewBox 22.75 16.62 166 166 | 952 B | PWA vector icon | Yes | Yes (Vector) | `DUPLICATED` |
| `apps/portal/public/images/archlinux-logo-black-1200dpi.png` | PNG | High-Res 1200 DPI | 125 KB | High-DPI exports | No | Partially (PNG) | `VERIFIED` |
| `apps/portal/public/favicon.ico` | ICO | Multi-resolution | 16 KB | Browser tab favicon | No | Standard ICO | `VERIFIED` |
| `apps/portal/public/background/global-background.mp4` | MP4 Video | 1080p / 60s loop | **11.0 MB** | `RouteBackground.tsx` | No | **Unoptimized (11 MB)** | `VERIFIED` |
| `apps/portal/public/background/global-background-poster.webp` | WebP | 1920x1080 | 94 KB | `RouteBackground.tsx` (LCP) | No | Yes (WebP) | `VERIFIED` |
| `apps/portal/public/plantcor.png` | PNG | 800x300 | 38 KB | Unused legacy branding | Yes (root & images) | No | `LEGACY / DUP` |
| `apps/portal/public/images/plantcor.png` | PNG | 800x300 | 38 KB | Duplicate of above | Yes | No | `LEGACY / DUP` |
| `apps/portal/public/plantcor-header.png` | PNG | 400x120 | 3.0 KB | Unused header brand | Yes (root & images) | No | `LEGACY / DUP` |
| `apps/portal/public/images/plantcor-header.png` | PNG | 400x120 | 3.0 KB | Duplicate of above | Yes | No | `LEGACY / DUP` |
| `apps/portal/public/images/plantcor-header-dark.png` | PNG | 400x120 | 1.2 KB | Dark-mode header variant | No | No | `LEGACY / UNUSED` |
| `apps/portal/public/plantcor-login.png` | PNG | 400x200 | 4.7 KB | Unused login brand | Yes (root & images) | No | `LEGACY / DUP` |
| `apps/portal/public/images/plantcor-login.png` | PNG | 400x200 | 4.7 KB | Duplicate of above | Yes | No | `LEGACY / DUP` |
| `apps/portal/public/whatsapp-logo.jpeg` | JPEG | 256x256 | 11 KB | `MacMenuBar.tsx` split button | No | No (JPEG icon) | `VERIFIED` |
| `apps/portal/public/error-pages/404-error.png` | PNG | 600x400 | 26 KB | `not-found.tsx` fallback | No | Standard PNG | `VERIFIED` |
| `apps/portal/public/icons/n8n.svg` | SVG | ViewBox 0 0 24 24 | 1.2 KB | Admin nav icon | No | Vector | `VERIFIED` |
| `apps/portal/public/icons/redis.svg` | SVG | ViewBox 0 0 24 24 | 1.1 KB | Admin nav icon | No | Vector | `VERIFIED` |
| `apps/portal/public/icons/icon-72x72.png` | PNG | 72x72 | 3.2 KB | PWA Manifest | No | Web PNG | `VERIFIED` |
| `apps/portal/public/icons/icon-96x96.png` | PNG | 96x96 | 4.1 KB | PWA Manifest | No | Web PNG | `VERIFIED` |
| `apps/portal/public/icons/icon-128x128.png` | PNG | 128x128 | 5.8 KB | PWA Manifest | No | Web PNG | `VERIFIED` |
| `apps/portal/public/icons/icon-144x144.png` | PNG | 144x144 | 6.7 KB | PWA Manifest | No | Web PNG | `VERIFIED` |
| `apps/portal/public/icons/icon-152x152.png` | PNG | 152x152 | 7.2 KB | PWA Manifest | No | Web PNG | `VERIFIED` |
| `apps/portal/public/icons/icon-192x192.png` | PNG | 192x192 | 9.4 KB | PWA Manifest | No | Web PNG | `VERIFIED` |
| `apps/portal/public/icons/icon-384x384.png` | PNG | 384x384 | 22 KB | PWA Manifest | No | Web PNG | `VERIFIED` |
| `apps/portal/public/icons/icon-512x512.png` | PNG | 512x512 | 34 KB | PWA Manifest | No | Web PNG | `VERIFIED` |
| `apps/portal/public/images/departments/access-control.jpg` | JPEG | 1920x1080 | 820 KB | `HeroRotator.tsx` panel | No | **Heavy JPEG (820 KB)** | `VERIFIED` |
| `apps/portal/public/images/departments/control-room.jpg` | JPEG | 1920x1080 | 817 KB | `HeroRotator.tsx` panel | No | **Heavy JPEG (817 KB)** | `VERIFIED` |
| `apps/portal/public/images/departments/admin.jpg` | JPEG | 1280x720 | 286 KB | Hub department background | No | Uncompressed JPEG | `VERIFIED` |
| `apps/portal/public/images/departments/drilling.jpg` | JPEG | 1280x720 | 282 KB | Hub department background | No | Uncompressed JPEG | `VERIFIED` |
| `apps/portal/public/images/departments/engineering.jpg` | JPEG | 1280x720 | 286 KB | Hub department background | No | Uncompressed JPEG | `VERIFIED` |
| `apps/portal/public/images/departments/overview.jpg` | JPEG | 1280x720 | 282 KB | Hub hero panel | No | Uncompressed JPEG | `VERIFIED` |
| `apps/portal/public/images/departments/production.jpg` | JPEG | 1280x720 | 277 KB | Hub department background | No | Uncompressed JPEG | `VERIFIED` |
| `apps/portal/public/images/departments/safety.jpg` | JPEG | 1280x720 | 267 KB | Hub department background | No | Uncompressed JPEG | `VERIFIED` |
| `apps/portal/public/images/departments/satellite-monitoring.jpg` | JPEG | 1280x720 | 294 KB | Hub department background | No | Uncompressed JPEG | `VERIFIED` |
| `apps/portal/public/images/departments/training.jpg` | JPEG | 1280x720 | 233 KB | Hub department background | No | Uncompressed JPEG | `VERIFIED` |
| `apps/portal/public/images/ai-sdk/ai-sdk-logotype-dark.png` | PNG | 400x100 | 12 KB | Unused asset | No | PNG | `UNUSED` |
| `apps/portal/public/images/ai-sdk/ai-sdk-logotype-dark.svg` | SVG | Vector | 2.1 KB | Unused asset | No | Vector | `UNUSED` |
| `apps/portal/public/images/ai-sdk/ai-sdk-logotype-light.png` | PNG | 400x100 | 11 KB | Unused asset | No | PNG | `UNUSED` |
| `apps/portal/public/images/ai-sdk/ai-sdk-logotype-light.svg` | SVG | Vector | 2.0 KB | Unused asset | No | Vector | `UNUSED` |
| `apps/portal/public/cursors/icons8-cursor-*.png` (9 files) | PNG | 50x50 / 100x100 | ~15 KB total | Unused custom cursors | No | Icons8 cursors | `UNUSED` |

---

## 3. Brand Vector Components

### 3.1 The Arch Logo (`@repo/ui/Logo` & `apps/portal/public/logo.svg`)
- **Code:** `packages/ui/src/components/Logo.tsx`
- **SVG Path:**
  ```xml
  <svg viewBox="22.75 16.625 166.16 166.19">
    <path d="m 105.8125,16.625 c -7.39687,18.135158 -11.858304,29.997682... fillRule="evenodd" />
  </svg>
  ```
- **Forensic Source:** This is the verbatim, official logo of the **Arch Linux operating system distribution** (created by Judd Vinet / Aaron Griffin). In Arch-System, it is styled with `text-arch-accent-blue` or `text-white` to serve as the corporate badge for "Arch Systems / Arch OS".

### 3.2 The Eve Logo (`@repo/ui/EveLogo`)
- **Code:** `packages/ui/src/components/EveLogo.tsx`
- **SVG Path:**
  ```xml
  <svg viewBox="0 0 169 53" role="img" aria-label="eve">
    <path d="M169 8.47h-51.39L81.73 53H70.36L113 0H169zM169 44.51v8.47h-45.87V44.5z..." />
  </svg>
  ```
- **Forensic Source:** Directly sourced from Vercel Geist brand assets (`vercel.com/geist/brands`). In the Arch-System UI, it is paired with the text "Arch OS", "eve agentic system ONLINE", and rendered in the global footer with a legal disclaimer acknowledging Vercel Inc. trademarks.

---

## 4. Missing Typography Assets (Network 404)

- **Referenced File:** `packages/theme/src/css/typography.css` (lines 5-11):
  ```css
  @font-face {
    font-family: Anurati;
    src: url("/fonts/Anurati-Regular.otf") format("opentype");
    font-weight: normal;
    font-style: normal;
    font-display: swap;
  }
  ```
- **Directory Audit:**
  - `apps/portal/public/fonts/` exists on disk but is **completely empty (0 bytes)**.
  - `assets/fonts/` exists at the monorepo root but is **completely empty (0 bytes)**.
- **Runtime Impact:** Whenever an `h1` through `h6` element renders, the browser requests `/fonts/Anurati-Regular.otf`, which fails with a `404 Not Found`. The browser silently falls back to `var(--font-sans)` (Inter).
- **Classification:** `MISSING / DEFECT`
