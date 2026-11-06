---
name: turbopack-css-compat
description: Next.js 16 Turbopack CSS @layer compatibility, PostCSS pipeline ordering, @repo/theme stylesheet imports, and third-party CSS patching protocol.
paths:
  - 'apps/portal/next.config.mjs'
  - 'packages/theme/src/css/**/*.css'
  - 'packages/ui/src/**/*.css'
  - 'scripts/patch-*.mjs'
---

# Turbopack CSS `@layer` Compatibility

## 1. Third-party `@layer base`

Turbopack runs `node_modules` CSS in a standalone PostCSS pass without `@tailwind base`, so `@layer base { ... }` fails (`CssSyntaxError: @layer base is used but no matching @tailwind base directive is present.`). Known: `@liqui-design/glass` (patched by `scripts/patch-glass-css.mjs` in `pnpm build` and `postinstall`).

After `pnpm add <pkg>`: `find node_modules/<pkg> -name "*.css" -exec grep -H "@layer" {} + 2>/dev/null`. If found:

1. Idempotent `scripts/patch-<pkg>-css.mjs` stripping the wrapper: `content.replace(/@layer base \{\s*\n(.*?)\n\}/gs, (_, inner) => inner)`.
2. Wire into `Arch-System/package.json` `build` (after `patch-glass-css.mjs`, before `turbo run build`) and `postinstall`.
3. Add to `transpilePackages` in `apps/portal/next.config.mjs`.
4. Add `// AGENT-TRACE: <pkg> CSS uses @layer base — patched via scripts/patch-<pkg>-css.mjs` in the consumer.
5. Run `node scripts/patch-<pkg>-css.mjs` immediately.

Manual `@import` does not help: entrypoints auto-import their CSS from `node_modules`.

## 2. Internal import order

- `packages/theme/src/css/index.css`: plain `@import "./..."` **without** `layer(...)` (avoids invalid `@media layer()`), order `reset` → `typography` → `variables` → `variables-generated` → `glass` → `animations` → `transitions` → `focus` → components.
- `packages/ui/src/globals.css`: `@import '@repo/theme/css';` and `@import './accessibility.css';` before `@tailwind base; @tailwind components; @tailwind utilities;`.
- `@apply`/`@layer components` prohibited in `apps/**/*.{css,scss}` and `libs/**/*.{css,scss}` (see `tailwind-utility-composition.md`).

## 3. Build guardrails

- `apps/portal/next.config.mjs` must set `turbopack: { root: workspaceRoot }` and `outputFileTracingRoot: workspaceRoot` (`pnpm audit:turbopack`).
- Purge globs owned by `tailwind-utility-composition.md`; never scan `node_modules` or `.ts` server files.
- `packages/{theme,ui}/src/**/*.css` ≤115 KB, zero `transition: all` (`pnpm lint:css-perf`).

Verify: `node tools/audits/audit-tailwind-usage.cjs`, `node tools/audits/check-css-performance.cjs`, `node tools/audits/audit-turbopack.cjs`.
