# Cookbook: Frontend Checklist, Performance & Rust Systems

Playbook synthesizing actionable engineering patterns from `thedaviddias/Front-End-Checklist`, `thedaviddias/Front-End-Performance-Checklist`, `leonardomso/rust-skills`, `growthbook/growthbook`, `aidenybai/million`, `jlmakes/scrollreveal`, `animate-css/animate.css`, and `tailwindlabs/tailwindcss` tailored to Arch-System's Next.js 16 + React 19 + OKLCH light-mode architecture.

## 1. Front-End & Performance Checklist (`Front-End-Checklist` / `Front-End-Performance-Checklist`)

1. **HTML Head & Meta Hygiene**:
   - `<meta charSet="UTF-8" />` MUST appear within the first 800 bytes of `<head>` (`node tools/audits/check-html-meta-tags.cjs`).
   - Always declare explicit viewport and `<html lang="en">`.
   - Avoid unnecessary `<link rel="preload">` headers on Next.js 16 RSC prefetch routes (`?_rsc=`) to prevent duplicate unused resource warnings in Chromium DevTools.
2. **CSS & Design System Budgets (`tailwindcss` / `awesome-tailwindcss` / `bootstrap`)**:
   - **Light-Mode Invariant**: Strictly `#f3f4f6` canvas (`--arch0`) with semantic OKLCH tokens from `@repo/theme`. Never use `dark:` variants or raw hex values.
   - **Utility Budget**: Maximum 20 utilities per `className` (target <= 12). Extract repeated chains (10+ tokens used 3+ times) into `@repo/ui` components, CVA variants, or shared `cn()` constants (`pnpm audit:tailwind`).
   - **CSS Bundle Ceiling**: Total CSS across `packages/{theme,ui}` must remain <= 115 KB (`node tools/audits/check-css-performance.cjs`), with zero `transition: all` declarations.
   - **Grid & Nesting**: Use `.layout-grid` (12-column responsive CSS Grid) and `.card-nested-content` optical inner radius calculation (`max(0px, calc(var(--radius-lg) - 4px))`).
3. **Images & Iconography (`Font-Awesome` / Next.js Image)**:
   - Use `next/image` with explicit `width`/`height` or `fill` + sized container.
   - Use tree-shaken `lucide-react` SVG icons with `aria-hidden="true"` on decorative icons and `aria-label` on icon-only interactive controls. Never load monolithic icon font stylesheets.
4. **Fine-Grained React 19 Rendering (`aidenybai/million`)**:
   - Isolate high-frequency SCADA / Realtime CDC subscriptions into leaf `'use client'` components so parent layouts and static tables do not re-render on every tick.
   - Aggregate multi-horizon metrics (shift, daily, monthly) in a single $O(N)$ pass rather than chained `.filter().map()` allocations.
5. **Viewport Reveal & Motion Accessibility (`scrollreveal` / `animate.css`)**:
   - Use `useScrollReveal` from `@repo/shared/hooks` for viewport-triggered entrance animations.
   - Always honor `(prefers-reduced-motion: reduce)` both in JS hooks (`shouldReduceMotion`) and CSS (`@media (prefers-reduced-motion: reduce)`), immediately revealing content without transform jitter on pit tablets.

## 2. Feature Flags & Deterministic Rollouts (`growthbook/growthbook`)

1. **Contract Validation**: Validate feature flag definitions, targeting rules, and evaluation contexts using `@repo/contract` (`featureFlagDefinitionSchema`, `featureFlagTargetingRuleSchema`, `evaluationContextSchema`).
2. **Zero-Latency Local Evaluation**: Use `evaluateFeatureFlag` and `computeDeterministicBucketPercent` from `@repo/utils/feature-flags` for deterministic SHA-256 percentage rollouts and department/site/role targeting without external network round-trips during RSC rendering or offline pit operation.

## 3. Rust Tooling & Sidecar Standards (`leonardomso/rust-skills` / `MoonZoon`)

When authoring or maintaining Rust tooling (`tools/swarms-orchestrator`, AST indexers):

1. **Ownership & Borrowing (`own-*`)**:
   - Prefer `&str` and `&Path` over `&String` and `&PathBuf` in parameters; accept `impl Into<String>` / `impl Into<PathBuf>` in builder setters.
   - Never wrap `T` in `Vec<Box<T>>` (`clippy::vec_box`) — `Vec<T>` is already heap-allocated; double indirection hurts cache locality.
2. **API Design & Type Safety (`api-*`, `type-*`)**:
   - Annotate pure builder methods and constructors with `#[must_use]`.
   - Parse and validate configuration at the boundary rather than scattering `.unwrap()` calls (`anti-unwrap-abuse`).
3. **Verification**:
   - Always run `cargo clippy -- -D warnings` and `cargo test` before committing Rust changes.

## 4. Browser Engines, Spatial WebGL & Game Engine Evaluation Playbook

1. **WebKit (`WebKit/WebKit`)**:
   - Do not embed native C++ WebKit inside the monorepo.
   - Use `PLAYWRIGHT_WEBKIT=1` (`tablet-safari` iPad Pro 11 target in `e2e/playwright.config.ts`) to validate Safari/iPadOS `backdrop-filter` (`GlassCard`) and OKLCH token rendering (`@repo/theme`) for field tablets.
2. **Spatial 2D/3D Telemetry (`Three.js`, `PixiJS`, `Taal`)**:
   - Validate 2D/3D coordinates, bounding boxes, and drill-hole trajectories using `@repo/contract` (`spatial-telemetry.schema.ts`: `spatialPoint2DSchema`, `spatialPoint3DSchema`, `spatialBoundingBox3DSchema`, `boreholeSurveySegmentSchema`, `spatialViewport2DSchema`).
   - Perform zero-bundle-bloat spatial projection using `@repo/utils/spatial-projection` (`computeBoreholeToeCoordinates`, `projectWorldToCanvas2D`, `computeEuclideanDistance3D`, `isPointWithinBoundingBox3D`) paired with `FastTelemetryChart` Canvas 2D rendering.
   - If full 3D pit/borehole meshes (`Three.js` + `@react-three/fiber`) or >5,000-node 2D schematics (`PixiJS`) are introduced in the future, isolate them in `'use client'` leaf components loaded via `next/dynamic(..., { ssr: false })` so core portal RSC bundles remain completely unaffected.
3. **Discarded Engines (`Servo`, `Qt WebEngine`, `Go-Webengine`, `Babylon.js`, `Phaser`, `PlayCanvas`, `InstantEngine`, `WebEngine CMS`)**:
   - **`servo/servo`**: Discarded — experimental Rust browser layout engine not supported as a standard Playwright target and unnecessary alongside Chromium/WebKit E2E coverage.
   - **`qt/qtwebengine` & `Use.GPU / Go-Webengine`**: Discarded — desktop C++/Qt and Go native browser embedding wrappers are redundant in a cloud-deployed Next.js 16 web application that already uses Playwright for headless browser automation and `@react-pdf/renderer` for server/client PDF export.
   - **`BabylonJS/Babylon.js`, `photonstorm/phaser`, `playcanvas/engine`, & `InstantEngine`**: Discarded — heavy consumer game engines with physics loops, audio subsystems, and sprite/scene-graph bloat that violate our strict bundle size, light-mode OKLCH, and WCAG 2.1 AA accessibility budgets.
   - **`WebEngine CMS` (`lautaroangelico/WebEngine`)**: Discarded — legacy PHP/MySQL Mu Online private server game CMS with zero architectural relevance to industrial mining operations or TypeScript/Next.js systems.
