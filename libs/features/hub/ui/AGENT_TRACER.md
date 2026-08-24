# Agent Tracer - @repo/features/hub/ui

## 2026-08-24 - HeroRotator Elite 3D Spatial Cylinder Physics & Focal Blur

- **Purpose**: Implement continuous 3D spatial cylinder mechanics on `<HeroSlide>` with `translateZ` depth tracking (`z: [-250, -120, 0, -120, -250]`) and dynamic depth-of-field focal blur (`filter: blur([8, 4, 0, 4, 8]px)`).
- **Changes**:
  - `libs/features/hub/ui/src/HeroRotator.tsx`:
    - Added `z` translation to `useTransform` mappings in `HeroSlide` for true 3D spatial projection.
    - Added `filter: blur(...)` using `useMotionTemplate` on non-active flanking cards.
    - Attached `z` and `filter` into `HeroSlide` motion.div inline styles.
- **Verification**:
  - `pnpm --filter @repo/hub/ui test` ✅ (16/16 tests passing)
- **What the Next Agent Should Know**: `<HeroSlide>` uses continuous GPU-composited `translateZ` and dynamic focal blur. `transform-gpu` and `will-change-transform` prevent layout reflows during panning and automatic rotation.

## 2026-08-24 - TrustLogos SVG Icons & Spacing Elevation

- **Purpose**: Integrate dedicated SVG vector icons (`Logo`, `Radio`, `Cpu`, `ShieldCheck`) into each placeholder trust pill, refine typography to font-mono, and adjust vertical padding and margins so pill borders never collide with outer hero card borders.
- **Changes**:
  - `libs/features/hub/ui/src/TrustLogos.tsx`: Added Lucide & Logo icons to each badge, updated container padding to `pt-1.5 border-t border-black/[0.08]` to elevate the component above bottom card bounds.
  - `apps/portal/features/hub/components/TrustLogos.tsx`: Synchronized icon definitions and responsive padding.
- **Verification**:
  - `pnpm --filter @repo/hub/ui test` ✅ (16/16 tests passing)
- **What the Next Agent Should Know**: Each placeholder item in `TrustLogos` now has an explicit SVG `icon` JSX node and renders in a `rounded-full` liquid-glass pill.

## 2026-08-24 - HeroRotator Rules-of-Hooks, Pause-Conflict & A11y Hardening

- **Purpose**: Resolve the Rules-of-Hooks violation (per-slide `useTransform` calls inside `panels.map`), separate hover-pause from manual-pause so cursor movement no longer clobbers the play/pause toggle, and close a11y/UX gaps (keyboard nav, drag-vs-click double-advance, `inert` on React 19, magic constants).
- **Changes**:
  - `libs/features/hub/ui/src/HeroRotator.tsx`:
    - Extracted a `<HeroSlide>` child component that owns all per-panel `useTransform` hooks (offset, rotateY, x, scale, opacity, zIndex, pointerEvents) + pan/click handlers. `HeroRotator` now maps panels to `<HeroSlide />`, so hooks are called unconditionally at the top of a real component — no longer reliant on a stable panel count/order.
    - Split `isPaused` into `isHovering` (driven by `onMouseEnter`/`onMouseLeave`) and `isManuallyPaused` (driven by the Play/Pause button). Auto-rotate runs only when neither is true; the button reflects/toggles `isManuallyPaused` only.
    - `carouselIndex.onChange` subscription now reads `activeIndexRef` (a ref mirror) instead of `activeIndex`, so it binds once and no longer resubscribes on every index change.
    - Replaced `inert={!isActive || undefined}` with `inert={!isActive}` (React 19 boolean `inert`).
    - Added a `panMovedRef` drag-distance guard on each slide so the click that follows a pan-release no longer also fires `jumpToSlide` and double-advances.
    - Added `onKeyDown` on the carousel root: `ArrowRight`→`nextSlide`, `ArrowLeft`→`prevSlide` (gated on `total > 1`), with `tabIndex={0}` + a `focus-visible` ring.
    - Extracted magic numbers into a commented `CONFIG` block (`cardWidth`, `cardLeft`, `perspective`, `autoRotateMs`, `panDivisor`, `velocityThreshold`, `clickDragThresholdPx`, `minHeight`).
    - Removed the dead duplicate `DEPT_STYLE_MAP.satellite` entry — the canonical slug is `satellite-monitoring` (confirmed against `departments.ts`); the fallback in the `.map` already covers unknown slugs.
    - Memoized `handleImageError` and made it skip-allocation when the src is already known-failed.
    - Switched `PanInfo` import to a `type`-only import; added `type MotionValue` import for the `HeroSlide` prop signature.
  - `libs/features/hub/ui/src/HeroRotator.test.tsx` (new): 10 tests covering panel rendering, active/inactive `aria-hidden` + CTA `tabIndex`, prev/next/jump navigation, manual pause toggle, urgency badges, Nominal badge, and HUD suppression for single-panel carousels. Mocks `framer-motion` (MotionValues as plain objects with a working `onChange`, `motion.*` as plain divs) and `TrustLogos`.
- **Verification**:
  - `pnpm --filter @repo/hub/ui type-check` ✅
  - `pnpm --filter @repo/hub/ui lint` ✅ (--max-warnings 0)
  - `pnpm --filter @repo/hub/ui test -- --testPathPatterns=HeroRotator` ✅ (10/10)
- **What the Next Agent Should Know**: The carousel slide track still keeps all panels mounted (the translate3d math depends on it); `content-visibility` + `inert` remain the correct levers, not lazy-mounting. Per-slide hooks now live in `<HeroSlide>` — add any new per-panel MotionValue there, not back in the `.map`. Hover-pause and manual-pause are independent states; do not collapse them back into a single `isPaused`.

## 2026-08-24 - Frontend Design System, Spacing, Padding & Bordering Polish

- **Purpose**: Refactor Hub page components to align with modern frontend design standards, consistent spacing rhythm (4/8/16/24px), refined border hierarchies, and responsive padding.
- **Changes**:
  - `HeroRotator.tsx`: Elevated hero card internal padding (`p-4 sm:p-6 lg:p-7`), increased preview thumbnail height (`h-24 sm:h-28 lg:h-32`), polished typography hierarchy (`text-base sm:text-lg md:text-xl`), enhanced CTA button sizing and hover/focus rings, refined glass pill badges and dot indicator widths.
  - `DepartmentReviews.tsx`: Upgraded review card dimensions (`w-[320px]`), added `MessageSquareQuote` semantic header icon, polished review card padding (`p-4 sm:p-5`), and glass surface styling (`bg-white/75 backdrop-blur-xl border border-black/[0.08]`).
  - `AlertTicker.tsx`: Refined container with `rounded-2xl border border-arch-border-subtle bg-white/70 shadow-card`, enhanced header contrast, list row dividers, and padded status chips.
  - `ToolBanner.tsx`: Polished tool card padding (`p-5 sm:p-6`), rounded-2xl glass card geometry, icon wrapper borders, and typographic hierarchy.
  - `ProductionTrend.tsx`: Removed unwanted top margin offset (`mt-8` -> `mt-2`), added clean header divider, refined department legend badges with OKLCH tokens.
  - `DepartmentCard.tsx`: Synchronized library implementation with photographic terrain background image fallback, `useTransition` navigation, and memoization.
- **What the Next Agent Should Know**: Hub components use unified 4/8/16/24px rhythm with light-only glass surfaces (`bg-white/70 backdrop-blur-xl border border-black/[0.08]`), named shadow tokens (`shadow-card`, `shadow-card-hover`), and responsive layout containers.

## 2026-08-24 - Context Optimization & Export Alignment

- **Purpose**: Remove duplicate default export in `HeroRotator.tsx` to align exports with `@repo/features/hub/ui` named export barrel and eliminate knip duplicate export warning.
- **Changes**:
  - `libs/features/hub/ui/src/HeroRotator.tsx`: Removed `export default HeroRotator`, keeping canonical `export function HeroRotator`.
- **What the Next Agent Should Know**: All consumers import `HeroRotator` as a named export from `@/features/hub` or `@repo/features/hub/ui`.

## 2026-08-24 - 3D Slideshow Orb & Standalone Ghost Preview Cards

- **Purpose**: Implement 3D slideshow orb carousel layout where the main center view, the past preview card on the left, and the future preview card on the right each have their own independent, standalone liquid `GlassCard` wrapper angled in 3D space.
- **Changes**:
  - `libs/features/hub/ui/src/HeroRotator.tsx`:
    - Moved `GlassCard` wrapper from outer section into individual slide panels.
    - Added CSS 3D perspective (`perspective: 1400px`) container.
    - Main card: rendered with full opacity, active `GlassCard`, and `transform: none` (relative z-20).
    - Left ghost card: rendered as its own separate `GlassCard` with `transform: translateX(-32%) rotateY(45deg) translateZ(-80px)` and 40% opacity (click activates `prevSlide()`).
    - Right ghost card: rendered as its own separate `GlassCard` with `transform: translateX(32%) rotateY(-45deg) translateZ(-80px)` and 40% opacity (click activates `nextSlide()`).
    - Propagated operational urgency status badges (`Open`, `Breakdown`, `Offline`) into active card headers.
  - `apps/portal/app/hub/page.tsx`:
    - Unwrapped static outer `GlassCard` to allow 3D cards to project independently outside the card boundary.
- **What the Next Agent Should Know**: Each slide panel is its own dedicated `GlassCard` instance with independent glass highlights and borders. The 3D orb projection angles are hardware-accelerated with zero CLS layout shifts.

- **Purpose**: Eliminate GPU/compositor saturation on the hub page — SVG filters on animated elements and 9 fully-rendered carousel panels were the dominant cost.
- **Changes**:
  - `libs/features/hub/ui/src/Sparkline.tsx`:
    - Removed `feDropShadow` (end-node glow) and `feGaussianBlur` (line path) SVG filters. SVG filters on animated elements force a filter re-evaluation every frame; replaced with a static halo circle (`r=3`, `opacity=0.25`) + gradient stroke at zero filter cost.
    - Gated the infinite `spark-pulse` r/opacity animation behind `prefers-reduced-motion` via `matchMedia` (pattern from `RouteBackground.tsx`).
    - Fixed a latent conditional-hook bug: `useId()` was called after an early return; all hooks now run unconditionally before the `data.length < 2` guard.
  - `libs/features/hub/ui/src/HeroRotator.tsx`:
    - Added `distanceFromActive` circular-distance helper. Panels 2+ slides away get `content-visibility: auto` + `contain-intrinsic-size: auto 200px` so the browser skips their layout/paint while the slide track keeps them in the DOM for the `translate3d(-activeIndex * 100%)` math.
    - Non-active panels are now `inert` + `aria-hidden` — their links/buttons are no longer tabbable and they leave the a11y tree (previously all 9 panels' controls were keyboard-reachable).
- **Verification**:
  - `pnpm nx run-many -t type-check --projects=features-hub-ui,@repo/ui,@repo/theme,portal --skip-nx-cache` ✅
  - `pnpm nx run-many -t lint --projects=features-hub-ui,@repo/ui,@repo/theme,portal --skip-nx-cache` ✅
  - `pnpm nx run @repo/theme:lint:css --skip-nx-cache` ✅
  - `pnpm nx run @repo/theme:lint:tokens --skip-nx-cache` ✅ (278 tokens, 161 references)
  - `node tools/check-css-performance.cjs` ✅ (9 pre-existing warnings only)
- **What the Next Agent Should Know**: The carousel slide track must keep all panels mounted (the translate3d math depends on it); `content-visibility` + `inert` are the correct levers, not lazy-mounting. The sparkline pulse is now motion-safe. Adjacent panels stay fully rendered so the 500ms slide transition never shows a blank pop.

## 2026-08-24 - Hero Rotator Taskbar Theme Alignment & Design Tokens

- **Purpose**: Refactor 3D hero carousel cards to fully adopt the theme, liquid-glass effects, and OKLCH color palette of the top Mac Menu Bar (`MacMenuBar.tsx`).
- **Changes**:
  - `libs/features/hub/ui/src/HeroRotator.tsx`:
    - Adopted `liquid-glass-light border border-black/10 shadow-window rounded-2xl` matching top taskbar glass reflection.
    - Integrated department squircle icons matching `DEPARTMENTS_LIST` from `MacMenuBar.tsx` (`Pickaxe`, `TrendingUp`, `ScanFace`, `CreditCard`, `TowerControl`, `HardHat`, `GraduationCap`, `Orbit`) with their departmental OKLCH tints (`text-dept-*`, `bg-dept-*/10`).
    - Standardized typography and interaction tokens: `text-[var(--text-heading)]`, `text-[var(--text-secondary)]`, `text-[var(--text-muted)]`, `bg-[var(--accent-blue)]`.
    - Refactored HUD pill controller to `liquid-glass-light border border-black/10 shadow-window` with smooth hover states and active dot highlighting in `bg-[var(--accent-blue)]`.
- **What the Next Agent Should Know**: The hero carousel cards and top taskbar share identical macOS Sonoma liquid glass surfaces, department icon color definitions, and semantic design tokens.
