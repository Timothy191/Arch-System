---
name: tailwind-utility-composition
description: Tailwind CSS utility budget and composition rules — fewer utilities per element, combine repeated chains, centralize global classes
paths:
  - 'apps/portal/**/*.tsx'
  - 'packages/ui/src/**/*.tsx'
  - 'libs/**/ui/**/*.tsx'
  - 'packages/theme/**/*.css'
---

# Tailwind Utility Composition

Long utility chains are hard to read, duplicate intent across the codebase, and bypass the design system. Apply this rule to every `className` in the workspace.

## 1. Utility budget

- **Target:** 12 or fewer utilities per element.
- **Hard limit:** 16. Above 16 the element is styling a component, not expressing layout.
- `p-4 border rounded-xl` on one element is fine. A repeated `w-full px-3 py-2 rounded-lg bg-[...] border ... text-...` chain is a component.

## 2. Combine utilities that serve one purpose

When a chain is repeated (≥10 utilities, 3+ uses) or clearly names a single component, extract it using this ladder:

1. **Existing component** — `GlassCard`, `Button`, `Badge`, etc. from `@repo/ui`; use its props and variants instead of restyling a `div`.
2. **CVA variant** — add a variant in `packages/ui/src/components/ui/*` with `class-variance-authority` when one component needs visual states.
3. **Local style constant** — for a chain used within one module, define `const cardStyles = '...'` (or `cn(...)`) next to the component.
4. **Theme component class** — only for patterns shared across packages: add a class in `packages/theme/src/css/*` (or `packages/ui/src/globals.css`).

Do not add a new global CSS class for a one-off element.

## 3. Composing conditional classes

- Always use `cn()` from `@repo/ui` (`packages/ui/src/lib/utils.ts`) for conditional or merged classes; it routes through `tailwind-merge`, so later classes win.
- Do not build `className` by template concatenation when conflicts are possible (`text-sm` plus `text-xs`).
- Keep variant maps in the component, not inline ternaries containing several full chains.

## 4. Where CSS lives

- `@apply` and `@layer components` are **only** allowed in `packages/theme/**` and `packages/ui/src/globals.css`.
- App- and feature-level CSS must not define Tailwind component classes; compose via components or `cn()`.
- Raw hex/rgb colors and arbitrary shadows remain banned by the design-token audit; this rule does not relax it.

## 5. Enforcement

- `pnpm audit:tailwind` scans `apps/portal`, `packages/ui`, and `libs/**/ui` in about one second. It fails on:
  - any className chain above 16 utilities in a file without baseline headroom,
  - a repeated chain (≥10 utilities, 3+ uses) that gains uses,
  - `@apply` or `@layer components` outside the allowed packages.
- The check runs in `agent:verify` step 14 and in the CI `policy-check` job.
- `tools/audits/tailwind-baseline.json` grandfathers current violations. **Never** regenerate it to hide a new violation; run `--update-baseline` only after a refactor reduces counts (the audit prints when headroom exists).

## 6. Review checklist

- [ ] Longest chain on the element is ≤ 12 utilities (16 absolute max).
- [ ] Repeated chains extracted per the ladder above.
- [ ] Conditional classes go through `cn()`.
- [ ] No new `@apply` or `@layer components` outside `packages/theme` and `packages/ui` globals.
