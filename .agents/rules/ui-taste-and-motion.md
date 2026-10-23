---
name: ui-taste-and-motion
description: Light-mode-only OKLCH design token SSoT (@repo/theme), GlassCard surface hierarchy, Tailwind utility composition & ordering, compositor-only motion physics, WCAG 2.1 AA accessibility, and Next.js 16 image optimization guardrails.
paths:
  - 'apps/portal/**/*.{ts,tsx,css}'
  - 'packages/ui/**/*.{ts,tsx,css}'
  - 'packages/theme/**/*.{ts,tsx,json,css}'
  - 'libs/features/**/ui/**/*.{ts,tsx}'
---

# Global UI Taste, Design Tokens, Glass Surfaces, Motion & Accessibility Guidelines

This rule codifies the production UI/UX, OKLCH token architecture, glass surface hierarchy, Tailwind composition, compositor-only motion physics, and WCAG 2.1 AA accessibility standards across `Arch-System`.

---

## 1. Light-Mode-Only OKLCH Token SSoT (`@repo/theme`)

- **Strict Light-Mode Canvas (`#f3f4f6`)**: `Arch-System` operates exclusively in a high-luminance light theme (`#f3f4f6` base canvas, `--bg-primary` / `--color-bg-base`). Introducing `dark:` Tailwind variants or dark-mode toggles is strictly forbidden across the monorepo.
- **Zero Raw Hex/RGB in Component Markup**: Never hardcode raw hex (`#...`), `rgb(...)`, or `hsl(...)` colors in component `className`s or inline styles, and never reference primitive `--arch0`–`--arch15` variables in application code. Always consume semantic tokens from `packages/theme/src/tailwind/preset.ts` (`bg-primary`, `bg-secondary`, `bg-tertiary`, `text-heading`, `text-primary`, `text-body`, `text-secondary`, `text-muted`, `border-subtle`, `border-default`, `border-emphasis`, `accent-blue`, `accent-green`, `accent-amber`, `accent-red`, `accent-charcoal`, `dept-*`). Semantic color tokens use `withAlpha()` (`color-mix(in srgb, var(--token) ..., transparent)`) so Tailwind opacity modifiers (`bg-dept-drilling/10`, `border-accent-blue/40`) work natively.
- **Approved Shadow Tokens Only**: Raw CSS `box-shadow` declarations in consumer stylesheets and arbitrary `shadow-[...]` classes are banned (`pnpm audit:tokens`). Use approved tokens from `@repo/theme`: `shadow-sm`, `shadow-md`, `shadow-lg`, `shadow-card`, `shadow-card-hover`, `shadow-window`, `shadow-elevated`, `shadow-glass-depth`, `shadow-glass-depth-hover`, `shadow-glass-depth-active`, `shadow-liquid-depth-hover`, `shadow-diffusion-{sm,md,lg,xl,cyan}`, and `shadow-glow-{primary,electric,mint,blue,amber,emerald,rose,purple}`.
- **Token Codegen & Validation Workflow**: `packages/theme/tokens.json` is the Single Source of Truth. Whenever `tokens.json` or `packages/theme/src/css/variables.css` is modified, run:
  ```bash
  pnpm --filter @repo/theme codegen       # Regenerates CSS variables & TypeScript token exports
  pnpm --filter @repo/theme lint:tokens   # Checks var() definitions, primitive leaks, deprecated aliases & JSON↔CSS drift
  pnpm audit:tokens                       # Audits tokens.json, Inter/JetBrains Mono fonts, static assets, keyframes & shadows
  ```

---

## 2. Glass Surface Hierarchy (`@repo/ui/GlassCard`)

- **Use Canonical `GlassCard` Variants**: Never build ad-hoc `backdrop-blur-* bg-white/... border-... shadow-...` utility chains on raw `<div>` elements for cards, modals, or HUD panels. Import `GlassCard` from `@repo/ui/GlassCard` (`packages/ui/src/components/GlassCard.tsx`) and select the appropriate `variant`:
  - `default`: Standard light-mode glass surface (`liquid-glass-light`, `shadow-window`, `rounded-card`, `.gold-steel-border.gold-steel-border-slim`).
  - `window`: macOS-style window container with `MacTrafficLights` and title bar header.
  - `spotlight`: Cursor-tracked radial illumination writing `--mouse-x` and `--mouse-y` CSS custom properties directly on the DOM node (zero React re-renders; automatically disabled on touch devices and under `prefers-reduced-motion`).
  - `glowborder`: Conic-gradient animated perimeter glow supporting `colorPreset` (`nature`, `ocean`, `sunset`, `aurora`, `custom`), automatically paused when reduced motion is active.
  - `liquid`: SVG `<feDisplacementMap>` + chromatic-aberration `<feColorMatrix>` refraction surface with `requestAnimationFrame`-coalesced `ResizeObserver` updates (displacement canvas capped at `512px`) and specular sheen sweep.
- **Canonical Borders, Icon Bubbles & Z-Index Matrix**:
  - Use `.gold-steel-border` (and `.gold-steel-border-slim`) from `packages/theme/src/css/cards.css` for metallic specular card framing.
  - Use `.uiverse-card` and `.uiverse-card-icon-bubble` (`border-radius: 9999px`, `42px × 42px`, `backdrop-filter: blur(16px)`) for department/hub feature cards instead of ad-hoc circular icon wrappers.
  - Use semantic Z-index utilities from `packages/ui/src/globals.css` (`z-background`, `z-route-bg`, `z-telemetry`, `z-primary-card`, `z-dock`, `z-navigation`, `z-overlay`, `z-popover`, `z-skip-link`, `z-toast`) instead of arbitrary `z-[999]` classes.

---

## 3. Tailwind Composition, Ordering & Build Purge

Owned by [`tailwind-utility-composition.md`](tailwind-utility-composition.md) — the ≤12/≤16 per-element utility budget and extraction ladder, Biome `nursery/useSortedClasses` ordering, the `.tsx`-only purge globs and negative exclusions in `packages/theme/src/tailwind/preset.ts`, `future: { hoverOnlyWhenSupported: true }`, `@apply`/`@layer components` containment in `packages/theme` and `packages/ui/src/globals.css`, and the ≤115 KB source CSS budget. Verify with `pnpm audit:tailwind` and `pnpm lint:css-perf`; Turbopack-specific consequences live in [`turbopack-css-compat.md`](turbopack-css-compat.md).

---

## 4. Compositor-Only Motion & Reduced Motion

- **Animate Only `transform` and `opacity`**: Never use `transition: all`, and never animate layout-inducing properties (`width`, `height`, `margin`, `padding`, `top`, `left`, `right`, `bottom`) or continuous `box-shadow` keyframes in consumer components (`pnpm audit:tokens` and `pnpm lint:css-perf` enforce this).
- **Named Theme Timing Tokens & Asymmetric Durations**: Never use linear easing for UI transitions or raw `ease-[cubic-bezier(...)]` arbitrary utilities. Use named timing tokens defined in `packages/theme/src/tailwind/preset.ts`:
  - `ease-glass` (`cubic-bezier(0.2, 0, 0, 1)`) — standard glass surface and sheet transitions
  - `ease-mac-decelerate` / `ease-out-smooth` (`cubic-bezier(0.16, 1, 0.3, 1)`) — entrances and window reveals
  - `ease-liquid-inertia` (`cubic-bezier(0.25, 1.15, 0.45, 1)`) — tactile spring-like micro-interactions (`active:scale-95`, `hover:scale-[1.01]`)
  - Exit animations should complete faster than entrance animations (e.g., `150ms–200ms` exit vs. `240ms–300ms` entrance).
- **Hardware Acceleration & `prefers-reduced-motion`**: Use `.gpu-accelerated` or `will-change-transform` (`translate3d(0, 0, 0)`, `backface-visibility: hidden`) on 3D and heavy glass surfaces. Every CSS animation/transition and Framer Motion (`m.*`) interaction must honor `prefers-reduced-motion: reduce` via `@media (prefers-reduced-motion: reduce)` rules (`packages/ui/src/accessibility.css`, `packages/theme/src/css/animations.css`), Tailwind `motion-safe:` / `motion-reduce:` variants, or Framer Motion's `useReducedMotion()` hook.

---

## 5. WCAG 2.1 AA Accessibility & Image Optimization

- **Visible Focus Rings & Keyboard Navigation**: Never apply `outline-none` without an explicit accessible focus ring (`focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)]`). Interactive custom containers (such as clickable `GlassCard`s) must provide `tabIndex={0}`, `role="button"`, and `Enter` / `Space` keyboard activation. Inactive 3D or flanking carousel cards must set `pointer-events-none` or cleanly capture click-to-activate without hijacking inner controls. Modals must trap focus (`aria-modal="true"`) and close on `Escape`; preserve `.skip-link` (`z-skip-link`) and `@media (forced-colors: active)` support in `packages/ui/src/accessibility.css`.
- **Semantic ARIA & Contrast**: All icon-only buttons require `aria-label` (or `.sr-only` text), form inputs require linked `<label htmlFor>`, and text over glass surfaces must use semantic contrast tokens (`text-on-glass`, `text-heading`, `text-body`) meeting WCAG 2.1 AA contrast ratios (≥4.5:1 normal text, ≥3:1 large text/UI controls). Verify component accessibility with `pnpm test:a11y` (Storybook + axe-core).
- **Next.js 16 Image Optimization (`pnpm audit:images`)**: Raw `<img>` tags are banned in application UI (allowed only in isolated error boundaries `apps/portal/app/error.tsx` and zero-JS video poster fallbacks `apps/portal/components/RouteBackground.tsx`). Every `<Image />` from `next/image` must declare a descriptive `alt` attribute and prevent Cumulative Layout Shift (CLS) via explicit `width` + `height`, `fill` (with a sized parent and responsive `sizes` attribute), or a statically imported asset, backed by `images.formats: ['image/avif', 'image/webp']`, `minimumCacheTTL`, and restricted `remotePatterns` in `apps/portal/next.config.mjs`.
- **Tree-Shaken Icons**: Always use named imports from `lucide-react` (`import { ShieldCheck } from 'lucide-react'`); wildcard imports (`import * as Icons`) are prohibited by `pnpm audit:tokens`.

---

## 6. Verification Gate

Before completing any UI, styling, token, or component task, run and pass:

```bash
node tools/audits/audit-design-tokens.cjs
node tools/audits/audit-tailwind-usage.cjs
node tools/audits/audit-image-optimization.cjs
node tools/audits/check-css-performance.cjs
pnpm --filter @repo/theme lint:tokens
```
