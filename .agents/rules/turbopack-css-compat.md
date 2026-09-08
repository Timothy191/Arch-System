# Rule: Turbopack Third-Party CSS `@layer` Compatibility

## The Problem

Turbopack (Next.js 16+) processes `node_modules` CSS files in a **standalone PostCSS
pass** that does NOT include the application's `@tailwind base` directive. Any
third-party package that ships CSS using `@layer base { ... }` will fail at build time:

```
CssSyntaxError: @layer base is used but no matching @tailwind base directive is present.
```

**Known affected packages:** `@liqui-design/glass` (patched via `scripts/patch-glass-css.mjs`)

## Before Installing Any Package That Ships CSS

Run this check after `pnpm add <package>`:

```bash
# Find and inspect CSS files for @layer usage
find node_modules/<package> -name "*.css" | xargs grep "@layer" 2>/dev/null
```

If `@layer base` is present, apply the fix below.

## Fix Protocol

1. **Create a patch script** at `scripts/patch-<pkg>-css.mjs`:
   ```js
   // Strip @layer base { ... } wrapper — safe because unlayered rules
   // are overridden by Tailwind utilities anyway (see glass.css comment)
   const patched = content.replace(/@layer base \{\s*\n(.*?)\n\}/gs, (_, inner) => inner);
   ```

2. **Register it in root `package.json` `postinstall`**:
   ```json
   "postinstall": "node scripts/patch-glass-css.mjs && node scripts/patch-<pkg>-css.mjs"
   ```

3. **Add to `transpilePackages` in `apps/portal/next.config.mjs`** as a secondary safeguard:
   ```js
   transpilePackages: [
     // ...existing packages
     "@problem-package/name",
   ]
   ```

4. **Document with AGENT-TRACE** in the consuming file:
   ```tsx
   // AGENT-TRACE: <pkg> CSS uses @layer base — patched via scripts/patch-<pkg>-css.mjs
   // Re-run `node scripts/patch-<pkg>-css.mjs` after pnpm install if build breaks.
   ```

5. **Run the patch immediately** after creating the script:
   ```bash
   node scripts/patch-<pkg>-css.mjs
   ```

## Why Not Just `@import` the CSS Manually?

The CSS is auto-imported by the package's `index.js` (`import "./glass.css"`), so
we cannot prevent it from being included — only patch its content.

## Reference

- Patched package: [`@liqui-design/glass`](file:///home/timothy/orca/Arch-System/node_modules/.pnpm/@liqui-design+glass@0.2.2_react-dom@19.2.7_react@19.2.7__react@19.2.7/node_modules/@liqui-design/glass/dist/glass.css)
- Patch script: [`scripts/patch-glass-css.mjs`](file:///home/timothy/orca/Arch-System/scripts/patch-glass-css.mjs)
- Consuming component: [`packages/ui/src/components/ui/liqui-button.tsx`](file:///home/timothy/orca/Arch-System/packages/ui/src/components/ui/liqui-button.tsx)
