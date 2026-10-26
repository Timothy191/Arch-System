---
name: tailwind-class-budget
description: Keep Arch-System Tailwind class chains inside the repo's utility budget and design-token rules. Use when writing or editing UI markup in apps/portal, packages/ui, or libs/**/ui, when pnpm audit:tailwind or audit:tokens fails, or before adding a long className/cn() chain. Covers the 16-utility cap, duplicate detection, banned raw values, and the extraction ladder.
---

# Tailwind Class Budget

`pnpm audit:tailwind` and `pnpm audit:tokens` are gates inside `pnpm agent:verify`, and `audit:tailwind` also runs on every staged JS/TS file. Both exit 1 on violations.

## 1. What the auditor actually measures

`tools/audits/audit-tailwind-usage.cjs`:

- Cap: **16 utilities per element**, counted per `className` attribute from the _longest single string_ after resolving literals, template spans, ternaries, `+`/`&&`/`||`/`??`, arrays, and calls named `cn`, `clsx`, `twMerge`, `classNames`, `cx`.
- Duplicate rule: a **deduped, sorted** fingerprint appearing ≥10 tokens and ≥3 uses is reported.
- Scope is hardcoded: `apps/portal/**/*.tsx`, `packages/ui/src/**/*.tsx`, `libs/**/ui/**/*.tsx`; tests, specs, `node_modules`, `.next`, `dist` are ignored.
- Also gated: `@apply` / `@layer components` outside the theme package, and purge-config regressions in `packages/theme/src/tailwind/preset.ts` (positive globs must end in `.tsx`, required exclusions present, `future.hoverOnlyWhenSupported: true`).
- **There is no inline disable comment and no path argument.** You cannot exempt one element. Grandfathered chains live in `tools/audits/tailwind-baseline.json`.

## 2. Fix ladder (in this order)

`.agents/rules/tailwind-utility-composition.md`: existing component → CVA variant → local style constant → theme class.

1. Reuse a component — glass surfaces are `@repo/ui/GlassCard`, never a hand-rolled blur chain.
2. CVA variant, e.g. `packages/ui/src/components/ui/badge.tsx:5` with `size: { sm: 'h-5 gap-1 px-1.5 text-xs' }`.
3. Local constant composed with `cn()`, e.g. `MachineOperationsComplianceWidget.tsx:44-46` (`BODY_CELL_CLASS`, then `NUMERIC_CELL_CLASS = \`${BODY_CELL_CLASS} text-right font-mono tabular-nums\``).
4. Add a theme class in `packages/theme` and regenerate (`/regenerate-artifacts`).

## 3. Token rules

Light mode only (`#f3f4f6` canvas); `dark:` variants are reported by `pnpm audit:tokens` as advisory warnings, and the theme is strictly light-only — do not add them.
Use semantic classes from `packages/theme/src/tailwind/preset.ts`:
`bg-primary|secondary|tertiary`, `text-heading|primary|body|secondary|muted`, `border-subtle|default|emphasis`, `accent-blue|green|amber|red|charcoal`, `glass-surface*`, `radius-*`, `shadow-*`, `ease-glass|mac-decelerate`, spacing `xs…4xl`.

Hard token failures: `UNAPPROVED_SHADOW_TOKEN` (arbitrary `shadow-[...]` or an unknown `shadow-x`; `shadow-<palette>-<n>` passes) and `UNTOKENIZED_BOX_SHADOW` in consumer CSS. Raw colors are caught by stylelint (`scale-unlimited/declaration-strict-value` on `/color$/`) — only `var(--…)`, `currentColor`, `transparent`, and gradients are allowed; primitive `--arch0`–`--arch15` are banned in app code.

Class order is a Biome rule (`nursery.useSortedClasses`, `error`, safe fix, applied to `className`, `classList`, `cn/clsx/cva/twMerge` and `wrapperClassName`/`iconClassName`/`contentClassName`): layout → box-model → typography → visual → transitions → modifiers. `pnpm biome check --write <file>` sorts; `biome format` does not.

## 4. Check and baseline

```bash
pnpm audit:tailwind
pnpm audit:tokens
pnpm lint:styles          # stylelint raw-color strict-value
pnpm lint:css-perf        # ≤115 KB built CSS
```

Run `pnpm audit:tailwind -- --update-baseline` **only after** a refactor genuinely lowered the counts — the baseline records existing debt, and `checkConfig` fails if it goes stale in either direction.
