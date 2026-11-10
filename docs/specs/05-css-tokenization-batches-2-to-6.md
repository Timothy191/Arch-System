# Spec: CSS Tokenization Batches 2–6 (Font Sizes, Border Radius, Z-Index, Shadows, Unreferenced Custom Properties)

Status: DONE (2026-11-10). Standardized typography (`@repo/theme` modular type scale), border radii (`--arch-radius-*`), z-index stacking scale (`--arch-z-*`), glass/elevation shadows (`--arch-shadow-*`), and pruned/wired unreferenced custom properties across `packages/theme` and `packages/ui/src/globals.css`.

## Batch Breakdown

- **Batch 2 (Font sizes)**: Standardized component typography on the `@repo/theme` modular scale (`xs` through `4xl`) and Tailwind semantic utilities.
- **Batch 3 (Border radius)**: Consolidated component border radii onto `@repo/theme` radius tokens (`rounded-lg`, `rounded-xl`, `rounded-2xl`, `rounded-full`).
- **Batch 4 (Z-index)**: Aligned stacking contexts (`dropdown`, `sticky`, `modal`, `popover`, `toast`, `tooltip`) with the `@repo/theme` z-index scale.
- **Batch 5 (Shadows)**: Standardized elevation and glass surface shadows onto `@repo/ui/GlassCard` variants and `@repo/theme` shadow tokens.
- **Batch 6 (Unreferenced custom properties)**: Audited custom CSS variables across `packages/theme` and `packages/ui/src/globals.css`, wiring active semantic tokens and removing dead declarations.

## Verification

- `pnpm audit:tokens`: 0 violations.
- `pnpm audit:tailwind`: 0 violations.
- `pnpm --filter portal type-check`: PASS.
