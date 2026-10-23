---
name: turbopack-css-compat
description: Next.js 16 Turbopack CSS @layer compatibility, PostCSS pipeline ordering, @repo/theme stylesheet imports, and third-party CSS patching protocol.
paths:
  - 'apps/portal/next.config.mjs'
  - 'packages/theme/src/css/**/*.css'
  - 'packages/ui/src/**/*.css'
  - 'scripts/patch-*.mjs'
---

# Rule: Turbopack CSS `@layer` Compatibility & Stylesheet Pipeline

## 1. The Third-Party `@layer base` Problem

Turbopack (Next.js 16+) processes `node_modules` CSS files in a **standalone PostCSS pass** that does NOT include the application's `@tailwind base` directive. Any third-party package that ships CSS using `@layer base { ... }` fails at build time:

```text
CssSyntaxError: @layer base is used but no matching @tailwind base directive is present.
```

**Known affected packages:** `@liqui-design/glass` (patched automatically via `scripts/patch-glass-css.mjs` during `pnpm build` and `postinstall`).

### Pre-Install Check for Packages Shipping CSS

After running `pnpm add <package>`, inspect any bundled CSS files for `@layer` directives:

```bash
find node_modules/<package> -name "*.css" -exec grep -H "@layer" {} + 2>/dev/null
```

### Fix Protocol for Third-Party `@layer` CSS

1. **Create an idempotent patch script** at `scripts/patch-<pkg>-css.mjs`:
   ```js
   // Strip @layer base { ... } wrapper — safe because unlayered rules
   // are overridden by Tailwind utilities anyway (see glass.css comment)
   const patched = content.replace(/@layer base \{\s*\n(.*?)\n\}/gs, (_, inner) => inner);
   ```
2. **Wire into `Arch-System/package.json` `build` and `postinstall` scripts**:
   ```json
   "build": "node scripts/sync-assets-smart.cjs && node scripts/patch-glass-css.mjs && node scripts/patch-<pkg>-css.mjs && turbo run build"
   ```
3. **Add to `transpilePackages` in `apps/portal/next.config.mjs`** alongside workspace UI packages (`@repo/ui`, `@repo/theme`, `@repo/contract`).
4. **Document with `AGENT-TRACE`** in the consuming component:
   ```tsx
   // AGENT-TRACE: <pkg> CSS uses @layer base — patched via scripts/patch-<pkg>-css.mjs
   // Re-run `node scripts/patch-<pkg>-css.mjs` after pnpm install if build breaks.
   ```
5. **Execute immediately** and verify:
   ```bash
   node scripts/patch-<pkg>-css.mjs
   ```

> **Why not `@import` the CSS manually?** Third-party entrypoints (e.g., `@liqui-design/glass` `index.js`) auto-import `"./glass.css"`, so bundlers always evaluate the file in `node_modules`; stripping the `@layer base` wrapper in-place is the only reliable fix.

---

## 2. Internal Stylesheet Import Order & `@layer` Containment

- **Plain `@import` in `@repo/theme/css` (`packages/theme/src/css/index.css`)**: Always use plain `@import "./..."` statements **without** `layer(...)` syntax in `packages/theme/src/css/index.css` (`reset.css` → `typography.css` → `variables.css` → `variables-generated.css` → `glass.css` → `animations.css` → `transitions.css` → `focus.css` → component stylesheets). Bundler/PostCSS pipelines can miscompile `@import "..." layer(...)` when nested `@media` queries are present, producing invalid `@media layer()` blocks.
- **Canonical Entrypoint Order (`packages/ui/src/globals.css`)**: `@import '@repo/theme/css';` and `@import './accessibility.css';` must precede `@tailwind base; @tailwind components; @tailwind utilities;` so CSS custom properties and accessibility resets are registered before Tailwind layers expand.
- **`@apply` and `@layer components` Containment (`pnpm audit:tailwind`)**: `@apply` and `@layer components` are strictly prohibited in `apps/**/*.{css,scss}` and `libs/**/*.{css,scss}`. All design-system component layers and `@apply` rules must live exclusively in `packages/theme/**` or `packages/ui/src/globals.css`.

---

## 3. Turbopack & CSS Build Guardrails

- **Monorepo Root Resolution (`pnpm audit:turbopack`)**: `apps/portal/next.config.mjs` must declare both `turbopack: { root: workspaceRoot }` and `outputFileTracingRoot: workspaceRoot` so Turbopack resolves hoisted pnpm packages and PostCSS dependencies across the workspace.
- **Tailwind Purge SSoT (`pnpm audit:tailwind`)**: the `content` globs and `future.hoverOnlyWhenSupported` contract in `packages/theme/src/tailwind/preset.ts` is owned by [`tailwind-utility-composition.md`](tailwind-utility-composition.md) — this rule only adds that Turbopack must never be handed a glob that scans `node_modules` or `.ts` server files.
- **Source CSS Performance Budget (`pnpm lint:css-perf`)**: Total source CSS across `packages/{theme,ui}/src/**/*.css` must remain **≤115 KB** with zero `transition: all` declarations (`node tools/audits/check-css-performance.cjs`).

---

## 4. Reference & Verification

- Patch script: [`scripts/patch-glass-css.mjs`](../../scripts/patch-glass-css.mjs)
- Consuming component: [`packages/ui/src/components/GlassCard.tsx`](../../packages/ui/src/components/GlassCard.tsx)
- Theme CSS entrypoint: [`packages/theme/src/css/index.css`](../../packages/theme/src/css/index.css)
- Global UI stylesheet: [`packages/ui/src/globals.css`](../../packages/ui/src/globals.css)
- Verify compliance:
  ```bash
  node tools/audits/audit-tailwind-usage.cjs
  node tools/audits/check-css-performance.cjs
  node tools/audits/audit-turbopack.cjs
  ```
