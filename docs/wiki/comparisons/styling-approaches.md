---
title: Styling Approach Comparison
created: 2026-05-15
updated: 2026-05-15
type: comparison
tags: [css, design, architecture, decision]
sources: [docs/wiki/concepts/design-system.md, apps/portal/package.json, CLAUDE.md]
confidence: high
---

# Styling Approach Comparison: Tailwind CSS vs CSS-in-JS vs CSS Modules

## What is Being Compared

Selection of styling architecture for a multi-departmental portal with a strict dark-themed design system shared across a monorepo.

## Dimensions of Comparison

| Dimension          | Tailwind CSS 3.4                 | CSS-in-JS (styled-components/emotion) | CSS Modules                  |
| ------------------ | -------------------------------- | ------------------------------------- | ---------------------------- |
| **Bundle Size**    | ~0 (purge unused)                | Runtime overhead (10-15KB)            | Moderate (per-component CSS) |
| **Build Speed**    | Fast (JIT compiler)              | Slower (runtime parsing)              | Fast                         |
| **SSR/Next.js**    | Full support                     | Complex (critical CSS extraction)     | Full support                 |
| **Theming**        | CSS variables + class strategy   | ThemeProvider context                 | CSS variables                |
| **Design Tokens**  | Config + plugin system           | Theme object                          | Manual variables             |
| **Component Libs** | @repo/theme shared preset        | Style duplication risk                | Scoped styles                |
| **Dev Experience** | Utility classes (learning curve) | Familiar CSS-in-JS                    | Scoped CSS                   |
| **RSC Support**    | Full                             | Requires 'use client'                 | Full                         |
| **Dark Mode**      | class-based strategy             | ThemeProvider switching               | Manual media queries         |
| **Monorepo Share** | Tailwind preset in @repo/theme   | Theme context per app                 | Import CSS files             |

## Project Implementation

The portal uses **Tailwind CSS 3.4 with CSS variables** from `@repo/theme`:

```typescript
// @repo/theme/tailwind/preset.ts
export const themePreset = {
  theme: {
    extend: {
      colors: {
        void: "hsl(var(--bg-void))",
        primary: "hsl(var(--bg-primary))",
        card: "hsl(var(--bg-card))",
        border: "hsl(var(--border))",
        accent: "#3ecf8e",
      },
    },
  },
};
```

Usage in components:

```tsx
// Forbidden: font-bold, font-semibold, shadow-*
// Required: font-medium, custom shadow via CSS
<div className="bg-void border-border rounded-lg">
  <h2 className="text-heading font-medium">Production Log</h2>
</div>
```

Design system enforcement via DeepEval metrics:

- `DesignSystemComplianceMetric` checks for forbidden classes
- Pre-commit hooks validate Tailwind usage

## Why Tailwind Was Chosen

1. **Design system enforcement** — Centralized `@repo/theme` preset ensures consistency
2. **Bundle efficiency** — PurgeCSS eliminates unused styles (critical for dashboard performance)
3. **Dark mode** — CSS variable strategy enables instant theme switching
4. **RSC compatibility** — No JavaScript runtime, works in Server Components
5. **Monorepo sharing** — Single `@repo/theme` package consumed by all apps
6. **Developer velocity** — Utility classes reduce context-switching between CSS files

## Why Not CSS-in-JS

styled-components/emotion would require:

- `'use client'` directive (breaks RSC optimization)
- Runtime JavaScript overhead
- ThemeProvider cascade complexity
- Duplicate style generation across monorepo packages

For a Next.js 15 App Router application, CSS-in-JS is an anti-pattern.

## Why Not CSS Modules

CSS Modules are excellent for component isolation but:

- Design token sharing requires manual CSS variable management
- No built-in utility composition
- More files to maintain (`.module.css` alongside each component)

Tailwind's utility-first approach fit the rapid iteration needs better.

## Verdict

**Tailwind CSS with @repo/theme preset is optimal** for a design-system-driven, RSC-first, monorepo architecture with strict dark-mode requirements.

## Related

- [[design-system]] — Full design system documentation
- [[deepeval-integration]] — Automated enforcement via DesignSystemComplianceMetric
- [[nx-monorepo]] — How @repo/theme is shared across packages
