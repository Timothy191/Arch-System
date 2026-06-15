---
title: "ADR-004: Tailwind CSS with Design Token Architecture"
created: 2026-05-15
updated: 2026-05-15
type: decision
status: accepted
tags: [adr, css, design, decision]
sources:
  [
    wiki/comparisons/styling-approaches.md,
    wiki/concepts/design-system.md,
    CLAUDE.md,
  ]
confidence: high
---

# ADR-004: Tailwind CSS with Design Token Architecture

## Status

**Accepted** — Implemented May 2024

## Context

We needed a styling approach for:

- Light-themed mining operations portal
- Shared design system across monorepo packages
- Minimal CSS bundle sizes
- Type-safe styling
- Rapid development velocity
- No CSS-in-JS (for RSC compatibility)

## Decision

We will use **Tailwind CSS 3.4 with CSS variable-based design tokens**, centralized in `@repo/theme`.

### Key Architectural Choices

1. **Tailwind CSS** — Utility-first CSS framework
2. **@repo/theme package** — Single source of truth for all styling
3. **CSS variables** — Runtime theme switching capability
4. **Light mode default** — Portal is always light-themed (macOS Sonoma visual language)
5. **Design system enforcement** — Automated checks for forbidden patterns

### Forbidden Patterns

These classes are prohibited and caught by DeepEval + pre-commit hooks:

- `font-bold`, `font-semibold` → use `font-medium`
- `bg-white/5`, `border-white/10`, `text-white/50`, `text-white/70`
- `shadow-*` → use CSS shadows from design tokens
- Direct `clsx`/`tailwind-merge` imports → use `cn()` from `@repo/ui`

## Consequences

### Positive

- **Bundle efficiency** — PurgeCSS eliminates unused styles
- **RSC compatible** — No JavaScript runtime required
- **Design consistency** — `@repo/theme` enforces tokens everywhere
- **Developer velocity** — Utility classes reduce context switching
- **Type safety** — Tailwind IntelliSense + TypeScript
- **Automated enforcement** — DeepEval metrics check compliance

### Negative

- **Utility class learning curve** — New team members need adjustment
- **HTML verbosity** — Classes can make JSX verbose
- **Tailwind dependency** — Migration away would be significant effort

### Neutral

- **Light mode default** — Simplifies styling but no dark mode support

## Alternatives Considered

### CSS-in-JS (styled-components, Emotion) (REJECTED)

- Requires `'use client'` directive (breaks RSC)
- Runtime JavaScript overhead
- ThemeProvider cascade complexity
- Duplicate style generation across packages

### CSS Modules (REJECTED)

- More files to maintain
- No built-in utility composition
- Manual design token sharing
- Slower iteration than utilities

### Vanilla Extract (REJECTED)

- Good TypeScript support but
- Newer ecosystem, fewer examples
- Build configuration complexity

## Implementation Notes

```typescript
// @repo/theme/src/tailwind/preset.ts
export const preset = {
  theme: {
    extend: {
      colors: {
        "bg-primary": "var(--bg-primary)",
        "bg-secondary": "var(--bg-secondary)",
        "border-subtle": "var(--border-subtle)",
        "text-primary": "var(--text-primary)",
        "accent-blue": "var(--accent-blue)",
      },
    },
  },
};
```

- Portal and `@repo/ui` both re-export `@repo/theme/tailwind`
- `ArchThemeProvider` provides CSS variable values
- `cn()` utility from `@repo/utils` for class merging

## Related

- [[design-system]] — Full design system documentation
- [[comparisons/styling-approaches]] — Detailed comparison
- [[deepeval-integration]] — Automated compliance checking
