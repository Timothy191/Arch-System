# CSS Tokenization Priority Order

Global rollout order for the Fallow CSS-health findings (219 distinct colors, 13 font sizes, 11 z-index, 14 radius, 189 unreferenced custom properties).

## Priority (highest impact first)
1. **Colors** — replace repeated hex/rgb with `@repo/theme` OKLCH tokens (highest count, highest drift risk).
2. **Font sizes** — standardize on the theme type scale (mix of pt/px/rem).
3. **Border radius** — collapse 14 values to theme radius tokens.
4. **Z-index** — adopt the theme z-index scale (11 values).
5. **Shadows** — tokenize 25 distinct shadows.
6. **Unreferenced custom properties** — remove or wire up the 189 unused vars.

## Execution rules
- One priority level per spec/PR; never mix levels in a single change.
- Run `pnpm audit:tokens` + `pnpm test:a11y` (Storybook + axe) after each batch.
- Use the `spec-driven-implementer` agent with a spec per batch.
- Verify no visual regression via Playwright visual specs (`pnpm test:e2e:visual`).
