---
name: react-components
description: React 19 UI component conventions, strict light mode invariant, OKLCH design tokens, and a11y accessibility standards.
paths:
  - "packages/ui/**/*.{ts,tsx}"
  - "packages/theme/**/*.{ts,tsx,json,css}"
  - "apps/portal/components/**/*.{ts,tsx}"
  - "apps/portal/app/**/*.{ts,tsx}"
  - "libs/features/**/ui/**/*.{ts,tsx}"
---

# React 19 & UI Component Standards

## 1. The Strict Light Mode Invariant

- **Rule**: All user interfaces in Arch-System MUST strictly operate in Light Mode (#f3f4f6 background, luminance > 200).
- **Hard Guard**: NEVER introduce Tailwind `dark:` variant classes or dark-mode toggle states.

## 2. Design Tokens & OKLCH Styling

- Rely strictly on design tokens from `@repo/theme` (OKLCH color system).
- Use approved semantic color tokens (`--color-surface-base`, `--color-accent-primary`, `--color-border-subtle`).
- Avoid arbitrary hardcoded hex codes (`#123456`) in component stylesheets or inline styles.

## 3. Server vs. Client Boundary Isolation

- Default to React Server Components (RSC) for presentation, layouts, and data streaming.
- Client Components must be explicitly annotated with `"use client";` at line 1.
- Never pass un-serializable objects (functions, classes, symbols) across the Server-to-Client boundary.

## 4. Accessibility (a11y) Standards

- All interactive elements must have accessible labels (`aria-label`, `aria-labelledby`, or visible text).
- Form inputs must be linked to `<label>` elements via `htmlFor`.
- Keyboard navigation must support `Tab`, `Enter`, `Space`, and `Escape` for modals and dropdown menus.
