---
name: ui-taste-and-motion
description: Light-mode-only OKLCH design token SSoT (`@repo/theme`), GlassCard surface hierarchy, Tailwind utility composition & ordering, compositor-only motion physics, and WCAG 2.1 AA accessibility guidelines.
paths:
  - 'apps/portal/**/*.{ts,tsx,css}'
  - 'packages/ui/**/*.{ts,tsx,css}'
  - 'packages/theme/**/*.{ts,tsx,json,css}'
  - 'libs/features/**/ui/**/*.{ts,tsx}'
---

# Light-Mode UI Guidelines

## 1. Light-Mode OKLCH Tokens

- **Canvas**: `#f3f4f6` only. No `dark:` variants.
- **Tokens**: Use semantic tokens from `packages/theme/src/tailwind/preset.ts` (`bg-primary`, `text-heading`, `border-emphasis`, etc.). Never hardcode hex/rgb.
- **Tokens**: Always `withAlpha()` (`color-mix(in srgb, var(--token) ..., transparent)`). Tailwind opacity (`bg-dept-drilling/10`) works natively.
- **Shadows**: Use approved tokens (`shadow-sm`, `shadow-card`, `shadow-glass-depth`) — no raw `box-shadow` or `shadow-[...]` classes.
- **Codegen**: Modify `tokens.json` → run `pnpm --filter @repo/theme codegen` → `pnpm --filter @repo/theme lint:tokens` → `pnpm audit:tokens`.

## 2. GlassCard Surface

- **Use Canonical `GlassCard`** (`@repo/ui/GlassCard`) — never build ad-hoc `div` with `backdrop-blur-* bg-* border-*`.
- **Variants**: `default` (standard glass), `window` (macOS-style), `spotlight` (cursor-tracked radial illumination), `glowborder` (conic-gradient animated glow), `liquid` (SVG `<feDisplacementMap>` + chromatic aberration).
- **Borders**: Use `.gold-steel-border` for metallic card framing.
- **Icons**: Use `.uiverse-card` + `.uiverse-card-icon-bubble` (42px × 42px, `border-radius: 9999px`, `backdrop-filter: blur(16px)`).

## 3. Tailwind Composition

- **≤16 utilities per class** (≤12 recommended). Extract repeated chains into components/CVA.
- **Ordering**: Follow `tailwind-utility-composition.md` — sort by type (spacing, typography, colors, effects) and use `cn()` for complex classes.
- **Purge**: `pnpm audit:tailwind` + `pnpm lint:css-perf`. Use `future: { hoverOnlyWhenSupported: true }` and negative exclusions in `preset.ts`.

## 4. Motion & Accessibility

- **Animate only `transform` and `opacity`** — never `all`, `width`, `margin`, `box-shadow`.
- **Easing**: Use named tokens (`ease-glass`, `ease-mac-decelerate`, `ease-liquid-inertia`). Exit animations < entrance animations.
- **Reduced Motion**: Honor `prefers-reduced-motion: reduce` with `.motion-safe-` / `.motion-reduce-` Tailwind variants and `useReducedMotion()` in Framer Motion.

## 5. Accessibility

- **Focus**: `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)]`. Custom buttons need `tabIndex={0}`, `role="button"`, `Enter`/`Space` activation.
- **ARIA**: Icon buttons → `aria-label`. Form fields → linked `<label>`. Modals → `aria-modal="true"`, `Escape` close.
- **Contrast**: Text over glass → `text-on-glass`, `text-heading`, `text-body` (≥4.5:1 normal, ≥3:1 large). Verify with `pnpm test:a11y`.

## 6. Images & Optimization

- **Images**: `next/image` only — no raw ``. Must have descriptive `alt`, explicit `width`/`height`, prevent CLS.
- **Optimization**: `pnpm audit:images` — AVIF/WebP, explicit dimensions, restricted `remotePatterns` in `next.config.mjs`.

## 7. Verification

- `node tools/audits/audit-design-tokens.cjs`
- `node tools/audits/audit-tailwind-usage.cjs`
- `node tools/audits/audit-image-optimization.cjs`
- `pnpm --filter @repo/theme lint:tokens`
- `pnpm test:a11y`

---

## 7. Verification Gate

Before completing UI, styling, token, or component tasks, run and pass:

```bash
node tools/audits/audit-design-tokens.cjs
node tools/audits/audit-tailwind-usage.cjs
node tools/audits/audit-image-optimization.cjs
node tools/audits/check-css-performance.cjs
pnpm --filter @repo/theme lint:tokens
pnpm test:a11y
```

<system>88 lines read from file starting from line 1. Total lines in file: 88. Requested range complete. Effective max_chars: 100000. End of file reached.</system>
</tool_call>
