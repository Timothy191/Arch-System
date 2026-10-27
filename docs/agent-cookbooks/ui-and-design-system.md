# Cookbook: UI and Design System

## Use when

Creating or modifying portal screens, components, forms, dashboards, charts, or responsive behavior.

## Steps

1. Read `packages/theme`, `packages/ui`, and the nearest feature rules before styling.
2. Reuse canonical exports such as `@repo/ui/GlassCard`; do not recreate shared primitives.
3. Use semantic OKLCH tokens from `@repo/theme`. The product is light-mode only; do not add `dark:` variants or raw colors.
4. Keep components semantic and accessible: labels, keyboard paths, focus states, correct roles, status text, and useful image alt text.
5. Prefer Flexbox for one-dimensional layouts and Grid for true two-dimensional layouts. Build mobile-first and verify the 360px viewport.
6. Keep utility chains within the repository budget and canonical class order. Extract repeated chains into components, CVA, or `cn()` constants.
7. Keep data loading on the server or through the approved query pattern; do not fetch in `useEffect`.
8. Add or update component tests and Storybook coverage for reusable UI.

## Checks

```bash
pnpm lint
pnpm audit:tokens
pnpm audit:tailwind
pnpm --filter portal test -- <changed-test-path> --runInBand
pnpm --filter @repo/ui storybook
```

## Done when

The UI uses existing tokens and primitives, works at mobile and desktop sizes, is keyboard and screen-reader usable, and passes token/Tailwind audits.
