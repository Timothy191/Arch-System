# Agent Tracer - Overview App

## 2026-06-24 - Explicit CSS layer order and React Flow layering

- **Purpose**: Align overview CSS cascade with `@repo/ui` — explicit layer declaration and component-layer grouping for XYFlow styles.
- **Changes**:
  - `app/globals.css`: Added `@layer reset, base, theme, components, utilities;` after theme import.
  - Wrapped all `.react-flow*` and tab active-state rules inside `@layer components`.
- **Next Steps**: Verify React Flow node/edge styling in overview dev server (`pnpm --filter overview dev` on :3002).
