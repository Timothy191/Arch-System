# Cookbook: UI and Design System

## Use when

Creating or modifying portal screens, components, forms, dashboards, charts, or responsive behavior.

## 1. Core Design Principles (Always Enforced)

1. **Visual Hierarchy**:
   - Establish immediate focal priority: primary KPIs and active alerts lead (`text-fluid-2xl` / `text-fluid-3xl`, `text-heading`), supporting labels use `.system-label` (`text-secondary`), and metadata uses `text-muted`.
   - Layer surfaces intentionally on the `#f3f4f6` (`--arch0`) light canvas using `@repo/ui/GlassCard` variants (`default`, `window`, `spotlight`, `glowborder`, `liquid`).
2. **Consistency**:
   - Reuse canonical `@repo/ui` primitives (`GlassCard`, `KPICard`, `KPIGrid`, `DepartmentLayout`, `PageHeader`, `Clock`).
   - Compose multi-slot components with `defineSlotRecipe` (`chakra-ui/panda` pattern) and deterministic contrast pairings via `resolveSurfacePairing` (`skeletonlabs/skeleton` pattern) from `@repo/ui`.
3. **Proximity & Grouping**:
   - Apply Gestalt proximity: tighter spacing (`gap-1.5` / `gap-2`) within a single metric/control group, wider spacing (`gap-4` / `gap-6`) between distinct cards or sections.
   - Use `.card-nested-content` for optical concentric inner border radii (`max(0px, calc(var(--radius-lg) - 4px))`).
   - Verify spatial alignment (`inside`, `above`, `below`, `no-overlap`, `aligned horizontally/vertically`) with `expectGalenLayout` (`e2e/helpers/galen-layout.ts`).
4. **Whitespace (Negative Space)**:
   - Preserve `p-6` (`24px`) padding on primary cards, `60ch–75ch` max width for documentation/prose, and at least `8px` (`gap-2`) clearance between interactive targets.

## 2. Layouts, Grids, Typography, Navigation & Performance Standards

- **Layouts, Grids & Spacing**:
  - Prefer Flexbox for 1D flows and `.layout-grid` (12-column CSS Grid) for 2D dashboards.
  - Use CSS `@container` queries for component-level responsiveness and `breakpoints.up / down / between / only` (`@repo/shared/hooks`) for viewport queries.
  - Validate across `RESPONSIVELY_MINING_VIEWPORTS` (`390×844` Field Mobile, `768×1024` Pit Tablet Portrait, `1024×768` Pit Tablet Landscape, `1920×1080` Control Room Wall).
- **Typography & Color**:
  - Fonts: `--font-sans` (Inter), `--font-display` (Space Grotesk), `--font-mono` (JetBrains Mono with `tabular-nums` for live telemetry).
  - Light-mode only (`#f3f4f6`); use `@repo/theme` OKLCH tokens with `withAlpha()` (`color-mix`). No `dark:` variants or raw hex/rgb.
- **Navigation & Interactive Elements**:
  - Ensure stretched-link overlays (`after:inset-0 after:z-20`) sit above decorative overlays (`z-10 pointer-events-none`).
  - Maintain `≥44×44px` touch targets on field tablets, `:focus-visible` OKLCH rings, Two-Tier Speculation Rules (`SpeculationRules.tsx`), and `.disclosure-native` for zero-JS `<details>/<summary>` disclosures.
- **Performance & Accessibility Essentials**:
  - Apply `.cv-auto-grid` (`content-visibility: auto`) to large off-screen card grids, animate only `transform` and `opacity`, honor `prefers-reduced-motion`, and reserve explicit media dimensions (`aspect-*` / `min-h-*`) for `0.000` CLS.

## Checks

```bash
pnpm lint
pnpm audit:tokens
pnpm audit:tailwind
node tools/audits/design-audit.cjs
pnpm --filter portal test -- <changed-test-path> --runInBand
pnpm test:a11y
```

## Done when

The UI upholds Visual Hierarchy, Consistency, Proximity/Grouping, and Whitespace across mobile, tablet, and control-room viewports, is keyboard and screen-reader accessible (WCAG 2.2 AA), and passes all token, Tailwind, and design audits.
