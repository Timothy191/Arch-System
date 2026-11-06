---
name: tailwind-utility-composition
description: Tailwind CSS utility budget, class ordering, composition, and build-size purge rules
paths:
  - 'apps/portal/**/*.tsx'
  - 'packages/ui/src/**/*.tsx'
  - 'libs/**/ui/**/*.tsx'
  - 'packages/theme/**/*.{ts,css}'
---

# Tailwind Utility Composition & Build Purge

## 1. Budget & ordering

- Target ≤12 utilities per element; hard limit 16.
- Order `layout` → `box-model` → `typography` → `visual` → `transitions` → `modifiers`, enforced by Biome `nursery/useSortedClasses` (`"level": "error"`, `"fix": "safe"`; `className`, `classList`, `cn()`, `clsx()`, `cva()`, `twMerge()`).

## 2. Extraction ladder (chain ≥10 utilities, 3+ uses, or names one component)

1. Existing `@repo/ui` component (`GlassCard`, `Button`, `Badge`) props/variants.
2. CVA variant in `packages/ui/src/components/ui/*`.
3. Local constant / `cn(...)` within one module.
4. Theme class in `packages/theme/src/css/*` (or `packages/ui/src/globals.css`) only for cross-package patterns. No global class for one-offs.

## 3. Conditional classes

- Always `cn()` from `@repo/ui` (`packages/ui/src/lib/utils.ts`, `tailwind-merge`); no template concatenation when conflicts possible; keep variant maps in the component, not multi-chain ternaries.

## 4. Purge (build size)

- `packages/theme/src/tailwind/preset.ts` is the `content` SSoT (re-exported by `apps/portal/tailwind.config.ts`, `packages/ui/tailwind.config.ts`).
- Positive globs ONLY `.tsx` UI sources: `apps/*/app/**/*.tsx`, `apps/*/components/**/*.tsx`, `apps/*/features/**/*.tsx`, `apps/*/plugins/**/*.tsx`, `packages/ui/src/**/*.tsx`, `packages/theme/src/react/**/*.tsx`, `libs/features/*/ui/src/**/*.tsx`. Never `.ts` files, `preset.ts` itself, or `node_modules/**` (e.g. `@tremor`).
- Must exclude `**/node_modules/**/*`, `**/.next/**/*`, `**/.turbo/**/*`, `**/dist/**/*`, `**/coverage/**/*`, `**/storybook-static/**/*`, `**/*.d.ts`, `**/*.test.{ts,tsx}`, `**/*.spec.{ts,tsx}`, `**/*.stories.{ts,tsx}`, `**/__tests__/**/*`, `**/__mocks__/**/*`, and `knip.json`-ignored components.
- Keep `future: { hoverOnlyWhenSupported: true }`. Use `ease-glass`, `ease-mac-decelerate`, `ease-out-smooth` instead of `ease-[cubic-bezier(...)]`.

## 5. Where CSS lives

- `@apply` / `@layer components` **only** in `packages/theme/**` and `packages/ui/src/globals.css`; app/feature CSS composes via components or `cn()`.
- Raw hex/rgb and arbitrary shadows stay banned (design-token audit).

## 6. Enforcement

- `pnpm audit:tailwind` (`tools/audits/audit-tailwind-usage.cjs`; `agent:verify` step 14 + CI `policy-check`) fails on: chains >16 without baseline headroom; repeated chains gaining uses; `@apply`/`@layer components` outside allowed packages; `preset.ts` purge regressions (scanning `.ts`/`node_modules`, missing exclusions, disabling `hoverOnlyWhenSupported`).
- `pnpm lint:css-perf` (`tools/audits/check-css-performance.cjs`): ≤115 KB source CSS.
- `tools/audits/tailwind-baseline.json` grandfathers violations. **Never** regenerate it to hide new ones; `--update-baseline` only after counts drop.
