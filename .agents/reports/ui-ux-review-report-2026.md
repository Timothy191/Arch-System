# UI/UX Review Report — Arch Monorepo vs. 2026 Next.js World-Class Standards

**Date:** 2026-09-19  
**Reviewer:** Multi-agent review team (Droid `review` + `agent-ready` skills)  
**Scope:** `apps/portal`, `packages/ui`, `packages/theme`, `libs/features/**/ui`  
**Method:** Objective scans + 7 parallel dimension reviews against Vercel Design Guidelines, WCAG 2.2/3.0-draft, Core Web Vitals 2026, shadcn/Tailwind v4 token best-practice, and macOS Sonoma glassmorphism standards.

---

## Executive Score

**Overall weighted score: 62.5 / 100** — Good foundation, not yet world-class.

| Dimension                             | Score | Weight | Notes                                                                                |
| :------------------------------------ | ----: | -----: | :----------------------------------------------------------------------------------- |
| Design-token discipline               |    62 |   0.15 | Strong token layer, but raw colors/opacities leak into GlassCard, login, and preset. |
| Glassmorphism & visual consistency    |    62 |   0.15 | Glass foundation restored; opaque overrides and charcoal drift remain.               |
| Accessibility (a11y)                  |    68 |   0.20 | Labels/focus good; touch targets and reduced-motion guards are the gaps.             |
| Performance & Core Web Vitals         |    52 |   0.15 | Largest gap: 4.5 MB PNG LCP, disabled inline CSS, misaligned preload.                |
| Interaction & motion design           |    62 |   0.15 | Mostly transform-only; inconsistent easing and missing `prefers-reduced-motion`.     |
| Navigation & information architecture |    68 |   0.10 | Skip links + route announcer; missing breadcrumbs, nested `<main>`, mobile nav gaps. |
| Mobile / responsive fit               |    64 |   0.10 | Desktop-first residues: fixed sidebars, fixed-width popovers, unscaled 3D carousel.  |

**Agent-ready scans:** `/login`, `/hub`, `/` all score **98/100 A+** with valid MCP manifest, `llms.txt`, and JSON-LD.  
**Build:** Full production build OOM-killed (exit 137) during TypeScript; dev server builds OK on webpack.  
**Type-check / CSS lint:** All UI packages pass.  
**Targeted tests:** 42 tests pass; React `act()` warnings and an async Client Component warning in `ProductionTrend` appear.

---

## What “World-Class” Means in 2026

1. **Token-first design system.** OKLCH primitives, single source of truth (`tokens.json` → CSS variables → Tailwind utilities), no raw hex/rgba/opacities in components.
2. **Accessibility by default.** WCAG 2.2 AA+; ≥44×44 px touch targets, visible focus, `prefers-reduced-motion`, persistent live regions.
3. **Performance as a feature.** LCP ≤2.5 s, INP ≤200 ms, CLS ≤0.1; inlined critical CSS, `next/image`, lazy heavy JS, aligned preloads.
4. **Calm, purposeful motion.** Compositor-only animations, 150 ms ease-out-expo tactile feedback, reduced-motion respected everywhere.
5. **Mobile-first responsive.** 360 px minimum viewport, collision-aware popovers, collapsible sidebars, no fixed-width overflow.
6. **Clear IA.** One `<main>` per page, breadcrumbs on deep pages, `aria-current`, client-side `Link` navigation.

---

## Priority 0 — Fix First (Biggest Impact, Lowest Effort)

1. **RouteBackground: use the preloaded poster and `next/image`.**
   - File: `apps/portal/components/RouteBackground.tsx`
   - Issue: a 4.5 MB PNG is rendered synchronously while an 86 KB preloaded WebP poster is unused.
   - Fix: render `/background/edge-of-the-event-horizon-poster.webp` with `<Image priority fetchPriority="high" />`; lazy/defer the 4K MP4.
   - Impact: single biggest LCP win.

2. **Enable `inlineCss` in `next.config.mjs`.**
   - File: `apps/portal/next.config.mjs:116`
   - Issue: `experimental.inlineCss: false` keeps render-blocking external CSS.
   - Fix: set `inlineCss: true` (or remove the explicit `false`).
   - Impact: removes one render-blocking request, improves LCP/FCP.

3. **Align `<head>` preload with the actual LCP asset.**
   - File: `apps/portal/app/layout.tsx:118`
   - Issue: preloads `poster.webp` but RouteBackground renders a different PNG.
   - Fix: preload the asset that is actually painted first.

4. **Fix invalid Tailwind focus ring in Checkbox.**
   - File: `packages/ui/src/components/ui/checkbox.tsx:72`
   - Issue: `peer-focus-visible:ring-neutral-900:ring-neutral-100` is invalid.
   - Fix: replace with valid `peer-focus-visible:ring-2 peer-focus-visible:ring-neutral-900 ring-offset-*`.
   - Impact: restores keyboard focus visibility (WCAG 2.4.7).

5. **Enlarge critical touch targets.**
   - Files: `libs/features/auth/ui/src/LoginForm.tsx:141`, `packages/ui/src/components/MacMenuBar.tsx:154`, `apps/portal/components/system/SystemTray.tsx:725`
   - Issue: 16–26 px icon-only targets.
   - Fix: `min-w-11 min-h-11` (44 px) transparent hit slabs, preserve visual size.

---

## Priority 1 — Short-Term Roadmap (Next Sprint)

| #   | Action                                                                         | Files                                                                                                                                                                                                | Effort | Impact                                     |
| :-- | :----------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----- | :----------------------------------------- |
| 1   | Add global `prefers-reduced-motion` policy                                     | `packages/theme/src/tokens/motion.ts`, `packages/ui/src/components/ui/animated-button.tsx`, `cyber-button.tsx`, `packages/ui/src/components/motion/AnimeStagger.tsx`, `apps/portal/app/hub/page.tsx` | M      | Eliminates WCAG 2.3 risk across all motion |
| 2   | Replace `transition-all` and width animations with transform-only              | `packages/ui/src/components/ui/cyber-button.tsx`, `SystemTray.tsx:260`                                                                                                                               | S-M    | Reduces INP/layout cost                    |
| 3   | Standardize tactile feedback: `active:scale-[0.97] duration-150 ease-out-expo` | All interactive primitives (`button.tsx`, `GlassCard.tsx`, `liqui-button.tsx`)                                                                                                                       | M      | Consistent premium feel                    |
| 4   | Audit `login/page.tsx` for raw colors/opacities and migrate to tokens          | `apps/portal/app/(auth)/login/page.tsx`                                                                                                                                                              | M      | Fixes the visual entry point               |
| 5   | Make GlassCard token-only                                                      | `packages/ui/src/components/GlassCard.tsx`                                                                                                                                                           | M      | Closes biggest token-drift source          |
| 6   | Remove opaque `bg-white/75` overrides in ToolBanner and GlowBorder             | `libs/features/hub/ui/src/ToolBanner.tsx`, `packages/ui/src/components/GlassCard.tsx:370`                                                                                                            | S      | Restores glass illusion                    |
| 7   | Fix charcoal drift: replace deprecated `var(--accent-blue)` with electric blue | `packages/ui/src/components/GlassCard.tsx:88`, `apps/portal/components/system/SystemTray.tsx:342`                                                                                                    | S      | Restores brand-blue accent                 |
| 8   | Add `aria-live`/`aria-describedby` refactor to LoginForm errors                | `libs/features/auth/ui/src/LoginForm.tsx:153`                                                                                                                                                        | S      | Robust screen-reader status                |
| 9   | Add collision padding + max-width to all popovers/dropdowns                    | `SystemTray.tsx`, `WeatherWidget.tsx`, `MacMenuBar.tsx`                                                                                                                                              | M      | Fixes mobile overflow                      |
| 10  | Increase default input/button/icon sizes to 44 px                              | `packages/ui/src/components/ui/input.tsx:24`, `button.tsx:33`                                                                                                                                        | S-M    | WCAG 2.5.5/2.5.8                           |

---

## Priority 2 — Medium-Term Roadmap (Next Quarter)

1. **Breadcrumbs on every department/deep page.**  
   `apps/portal/app/(departments)/[department]/page.tsx` and sub-pages.
2. **Eliminate nested `<main>` landmark.**  
   `packages/ui/src/components/DepartmentLayout.tsx:159`.
3. **Mobile-first DepartmentLayout.**  
   Hide fixed 240 px sidebar on mobile, rely on `BottomNav` + a sheet menu.
4. **Responsive Three.js hero carousel.**  
   `packages/ui/src/components/ThreeHeroRotator.tsx` — switch to CSS carousel below `md`, scale dimensions above.
5. **ToolBanner marquee replacement.**  
   Mobile snap-scroll or 2-column grid; pause on touch.
6. **Tokenize remaining raw shadows in Tailwind preset.**  
   `packages/theme/src/tailwind/preset.ts` glass-depth, tremor, diffusion-cyan, status-glow.
7. **OKLCH-first palette migration.**  
   Convert Tier 1 primitives in `tokens.json` to OKLCH and regenerate `variables.css`.
8. **Internal navigation hardening.**  
   Replace `<a>` and `window.location.href` with Next.js `Link`/`useRouter` in department actions and `ServicesDropdown`.
9. **Visual regression baseline.**  
   Chromatic/Percy for `GlassCard`, `login`, `hub`, `SystemTray` stories.
10. **Lighthouse/Playwright CWV budget in CI.**  
    Block PRs that regress LCP >2.5 s or a11y score <95.

---

## Priority 3 — Strategic (Design-System Maturity)

- **Unified `GlassCard` governance.** Enforce the DESIGN.md variant limits programmatically: max 1 spotlight, max 2 glow-border, no nested cards. Add an ESLint rule.
- **Token linting.** Expand `stylelint` to forbid raw `bg-white`, `text-black`, `border-white/*`, etc. in `apps/portal` and `libs/features`.
- **Dark-mode scaffolding.** Map `[data-theme="dark"]` tokens now (even if disabled) so the system is future-proof.
- **Focus-mode context.** Implement a global focus-mode provider that dims non-active surfaces and respects `prefers-reduced-motion`.

---

## Validation Checklist Used

- [x] `agent-ready scan` on `/`, `/login`, `/hub` — 98/100 A+ each
- [x] Type-check on all UI packages — pass
- [x] CSS lint on `@repo/ui` and `@repo/theme` — pass
- [x] Targeted portal tests (login, hub, GlassCard, SystemTray, LoginForm) — 42 pass
- [ ] Full production build — blocked by OOM during TypeScript (exit 137)
- [ ] Lighthouse CWV audit — pending stable production build
- [ ] axe DevTools audit — pending stable production build or Playwright E2E

---

## Recommended Next Action

Create a focused follow-up task: **“P0 performance + token discipline sprint”** that fixes RouteBackground, enables `inlineCss`, aligns preload, repairs the Checkbox focus ring, and enlarges the top 5 touch targets. That alone should lift the overall score from 62.5 to ~72 and unblock a clean Lighthouse run.
