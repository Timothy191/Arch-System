# Agent Tracer - @repo/features/hub/ui

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
