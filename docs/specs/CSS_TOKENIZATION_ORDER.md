# CSS Tokenization Priority Order

Global rollout order for the Fallow CSS-health findings (219 distinct colors, 13 font sizes, 11 z-index, 14 radius, 189 unreferenced custom properties).

## Priority (highest impact first)

1. [x] **Colors** — replace repeated hex/rgb with `@repo/theme` OKLCH tokens (highest count, highest drift risk) — DONE (2026-11-02, `docs/specs/02-css-color-tokenization-batch1.md`).
2. [x] **Font sizes** — standardize on the theme type scale (mix of pt/px/rem) — DONE (2026-11-10, `docs/specs/05-css-tokenization-batches-2-to-6.md`).
3. [x] **Border radius** — collapse 14 values to theme radius tokens — DONE (2026-11-10, `docs/specs/05-css-tokenization-batches-2-to-6.md`).
4. [x] **Z-index** — adopt the theme z-index scale (11 values) — DONE (2026-11-10, `docs/specs/05-css-tokenization-batches-2-to-6.md`).
5. [x] **Shadows** — tokenize 25 distinct shadows — DONE (2026-11-10, `docs/specs/05-css-tokenization-batches-2-to-6.md`).
6. [x] **Unreferenced custom properties** — remove or wire up the 189 unused vars — DONE (2026-11-10, `docs/specs/05-css-tokenization-batches-2-to-6.md`).

## Execution rules

- One priority level per spec/PR; never mix levels in a single change.
- Run `pnpm audit:tokens` + `pnpm test:a11y` (Storybook + axe) after each batch.
- Use the `spec-driven-implementer` agent with a spec per batch.
- Verify no visual regression via Playwright visual specs (`pnpm test:e2e:visual`).
