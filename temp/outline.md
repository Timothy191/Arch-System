# Task Outline: Frontend UI & Design Refinement

## Objective
Enhance frontend UI with consistent pill-shaped elements, calibrated transparency, visual depth/effects, and verify integrity of core component libraries and dependencies.

## High-Level Workstreams
1. **Design System & Tokens**: Audit OKLCH color palettes, elevation shadows, backdrop blurs, and border radius tokens.
2. **Component Library & Asset Verification**: Inspect removed/missing packages or components across `packages/ui` and `apps/portal`.
3. **Pill Shapes & Ergonomics**: Reintroduce pill shapes (`rounded-full`) for badges, status chips, quick-action buttons, and search filters where ergonomically appropriate.
4. **Transparency & Glassmorphism Effects**: Apply calibrated background translucency (`bg-white/80`, `backdrop-blur-md`, light-mode luminance > 200) without violating strict light mode invariants.
5. **Quality & Regression Guard**: Verify TypeScript compilation, Biome formatting, and monorepo quality suite.
