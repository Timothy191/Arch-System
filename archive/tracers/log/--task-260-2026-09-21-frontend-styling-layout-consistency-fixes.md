# Agent Tracer Task Log: --task-260

**Task ID:** `--task-260`
**Timestamp:** `2026-09-21T06:00:00Z`
**Subject:** Frontend Styling & Layout Consistency Fixes — Token Drift, Z-Index Matrix, Body Layout, Focus Mode, and Build Warnings
**Status:** Completed
**Routine:** Solo / Direct Implementation
**Model:** kimi-k2.7-code:cloud
**Quality Gate:** Partial (see Verification)

---

## 1. Context & Objectives

Audit and repair frontend styling/layout inconsistencies across the Arch-Systems Next.js portal that could cause UI/UX errors, layering conflicts, token drift, or build/runtime warnings. All fixes were scoped to the styling/theme/layout layer; no schema, auth, infra, or CI changes.

## 2. Root Cause Diagnoses & Resolutions

1. **Dual `:root` token drift**
   - **Root Cause:** `packages/theme/src/css/index.css` imported both `variables.css` and `variables-generated.css` under `layer(theme)`. The generated file hard-coded values such as `--accent-blue: #007aff`, overriding the hand-authored `--accent-blue: var(--accent-electric-blue)` and causing silent drift.
   - **Resolution:** Updated `tokens.json` so `accent-blue`, `success`, `warning`, `danger`, `info`, and deprecated accent aliases resolve to canonical tokens (`accent-electric-blue`, `accent-green`, `accent-red`, `accent-charcoal`). Added missing canonical tokens (`accent-electric-blue`, `accent-electric-blue-hover`, `accent-mint`, `accent-amber`) to `tokens.json`. Regenerated `variables-generated.css` via `pnpm --filter @repo/theme codegen`. Added legacy `--arch-*` aliases and `--shadow-none` / `--accent-blue-hover` to `variables.css`.

2. **Missing CSS variables**
   - **Root Cause:** `packages/theme/src/css/borders.css` referenced `--arch-border-emphasis`, `--arch-accent-blue`, `--arch-surface-*`; `focus.css` referenced `--shadow-none`; `packages/ui/src/globals.css` focus-mode referenced `--accent-blue-hover`; none were defined.
   - **Resolution:** Defined the missing variables in `variables.css` and removed a stale duplicate z-index/shadow block at the end of `variables.css`.

3. **Magic z-index values outside the matrix**
   - **Root Cause:** Components used `z-[9999]`, `z-[9950]`, `z-[9900]`, `z-[9998]`, `z-[120]`, `z-[110]`, `z-40`, `z-30`. The matrix only defined 5 layers, so overlays conflicted and focus-mode overrides missed them.
   - **Resolution:** Expanded the matrix in `variables.css` with `--z-route-bg`, `--z-dock`, `--z-dock-trigger`, `--z-popover`, `--z-ai-launcher`, `--z-offline-banner`, `--z-skip-link`, `--z-toast`, `--z-dev-overlay`, `--z-priority`. Added Tailwind utilities in `packages/ui/src/globals.css`. Replaced magic values in `OfflineBanner`, `AriaLauncher`, `SkipLinks`, `LCPObserver`, `FeedbackWidget`, `PWAInstallButton`, `ServicesDropdown`, `SystemClock`, `WeatherWidget`, `SystemTray`, `ViewportBoundaries`, `SplitWindowLayout`, `BottomNav`, `RouteBackground`.

4. **Body max-width conflict with fixed overlays**
   - **Root Cause:** `<body>` carried `max-w-[1920px] mx-auto shadow-window` while `MacMenuBar`, `AriaLauncher`, `OfflineBanner`, etc. were fixed to the viewport. On ultra-wide displays fixed UI stretched beyond the centered body column.
   - **Resolution:** Removed layout constraints from `<body>` in `apps/portal/app/layout.tsx`. Wrapped `main` + `footer` in a `div` with `max-w-[1920px] mx-auto shadow-window`. Moved `CommandBar`, `ViewportBoundaries`, `ClientOverlays`, and `Toaster` outside the constrained wrapper so they remain viewport-relative overlays.

5. **Incomplete focus-mode overrides**
   - **Root Cause:** Focus-mode CSS only targeted `.z-navigation`, `.fixed.z-[100]`, `.bg-white/95`, `.shadow-window`, `.shadow-card`. New overlay layers and raw translucent utilities stayed bright.
   - **Resolution:** Extended `:is(body.focus-mode)` selectors to cover all new z-utility classes and added catch-all overrides for `[class*="bg-white/"]`, `[class*="bg-black/"]`, `[class*="border-white/"]`, `[class*="border-black/"]` plus `.shadow-sm`, `.shadow-md`, `.shadow-lg`, `.shadow-diffusion-sm`.

6. **Raw Tailwind shadow utilities**
   - **Root Cause:** `SplitWindowLayout.tsx`, `ViewportBoundaries.tsx`, and `LCPObserver.tsx` used forbidden `shadow-sm`, `shadow-md`, `shadow-lg`, `shadow-2xs`, `shadow-xs`.
   - **Resolution:** Replaced raw shadows with design-token classes (`shadow-card`, `shadow-window`, `shadow-diffusion-sm`).

7. **Inconsistent Tailwind opacity modifiers**
   - **Root Cause:** Many semantic colors in `packages/theme/src/tailwind/preset.ts` used plain `var(--token)`, so opacity modifiers like `bg-bg-primary/10` were silently dropped.
   - **Resolution:** Wrapped semantic tokens (`bg-*`, `overlay-*`, `border-*`, `text-*`, `brand-*`, `mac-*`, `glass-*`, `color-*`, `success`, `warning`, `danger`, `info`, `backdrop-dim`) with the existing `withAlpha` helper.

8. **Build warnings**
   - **Root Cause (YAML):** Swagger JSDoc in `apps/portal/app/api/health/n8n/route.ts` contained inline `optional: true` / `backend_status: normal` text that the OpenAPI parser treated as nested YAML mappings.
   - **Resolution:** Rewrote the description to avoid colon-space pseudo-key/value text.
   - **Root Cause (NFT):** `apps/portal/app/api/codebase-maps/route.ts` used `process.cwd()` and `path.resolve(..., "../../codebase-maps")`, causing Turbopack NFT to over-trace the whole project.
   - **Resolution:** Refactored `getMapsRoot` to use `path.join(/*turbopackIgnore: true*/ process.cwd(), ...)` with static subfolder paths. Added type annotation for `manifest`.

9. **Duplicate keyframes**
   - **Root Cause:** `shine`, `marquee`, `marquee-vertical` had been duplicated between `globals.css` `@theme inline` and the Tailwind preset; the diff already moved them to the preset.
   - **Resolution:** Verified no duplicates remain in `globals.css`. Build-time chunk duplicates for `enter`/`exit`/`spin`/`fade-in` originate from Tailwind/Radix and are out of immediate scope.

## 3. Files Mutated

- `packages/theme/tokens.json`
- `packages/theme/src/css/variables.css`
- `packages/theme/src/css/variables-generated.css` (regenerated)
- `packages/theme/src/tailwind/preset.ts`
- `packages/theme/scripts/validate-tokens.mjs`
- `packages/ui/src/globals.css`
- `apps/portal/app/layout.tsx`
- `apps/portal/components/OfflineBanner.tsx`
- `apps/portal/components/ai/AriaLauncher.tsx`
- `apps/portal/components/accessibility/SkipLinks.tsx`
- `apps/portal/components/LCPObserver.tsx`
- `apps/portal/components/FeedbackWidget.tsx`
- `apps/portal/components/PWAInstallButton.tsx`
- `apps/portal/components/nav/ServicesDropdown.tsx`
- `apps/portal/components/nav/BottomNav.tsx`
- `apps/portal/components/clock/SystemClock.tsx`
- `apps/portal/components/weather/WeatherWidget.tsx`
- `apps/portal/components/system/SystemTray.tsx`
- `apps/portal/components/system/ViewportBoundaries.tsx`
- `apps/portal/components/system/SplitWindowLayout.tsx`
- `apps/portal/components/RouteBackground.tsx`
- `apps/portal/app/api/health/n8n/route.ts`
- `apps/portal/app/api/codebase-maps/route.ts`

## 4. Verification Artifacts & Evidence

- **`pnpm --filter @repo/theme codegen`** — PASS
- **`pnpm lint --filter=portal --filter=@repo/ui --filter=@repo/theme`** — PASS (3/3 packages)
- **`pnpm --filter portal type-check`** — PASS
- **`pnpm audit:design`** — PASS (0 critical / 0 warnings)
- **`pnpm --filter @repo/theme lint:tokens`** — PASS (286 tokens, 93 references, no drift)
- **`pnpm --filter portal build`** — PASS (45/45 pages generated)
- **`pnpm quality`** — PARTIAL: 51 of 52 tasks passed. The single failure was `portal#test` where a Jest worker crashed with `JavaScript heap out of memory` while running `components/ui/GeistExtended.test.tsx`. 875 tests passed before the worker OOM. The failure is environmental and unrelated to the styling/layout changes.

## 5. Remaining Risks / Follow-ups

- The Turbopack NFT warning for `codebase-maps` may still appear if `process.cwd()` cannot be statically resolved; consider scoping file reads to a dedicated subfolder or moving the route to a development-only API.
- Several page-level components still use raw `shadow-sm`/`shadow-md`/`shadow-lg`; a follow-up pass should migrate those to design-token shadows and enable the forbidden-raw-shadow test.
- The full `pnpm quality` test suite requires a runner with more than ~4 GB heap to complete without worker crashes.
