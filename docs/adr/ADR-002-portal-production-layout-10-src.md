# ADR-002: Portal Production Layout in 10-src

- **Status**: accepted
- **Date**: 2026-06-30
- **Deciders**: Tim
- **Tags**: portal, 10-src, login, taskbar, glassmorphism

## Context

Login and taskbar chrome needed pixel-perfect production polish: crisp white glass inputs, cool ambient lighting, standard placeholders, footer clipping fixes, and taskbar search/tray alignment. Stale layout risk requires all overrides to live under `10-src/` and sync into `@repo/theme`.

## Decision

1. **`10-src/01_Admin/styles/portal-production.css`** — production overrides scoped to `.portal-auth-stage` and `.layer-taskbar-brushed`
2. **`LoginFormProduction` + `login-portal-copy.ts`** — production form and copy source of truth in `10-src`
3. **`LoginCardHeader`** — uppercase "System Authentication" title
4. Portal wires via `@10-src/01_Admin/components`; feature barrel re-exports `LoginFormProduction`

## Consequences

### Positive

- Layout changes isolated from legacy `packages/theme/glass.css` gold branding
- Copy and geometry centralized for operational realism
- Theme import chain keeps portal consuming one CSS bundle

### Negative

- Duplicate form component until `libs/features/auth/ui` fully delegates to `10-src`
- Production CSS uses `!important` to override existing gold/pill rules

### Neutral

- Complements ADR-001 login glass branding; production layer supersedes warm ambient on auth routes

## Links

- `docs/adr/ADR-001-login-glass-branding-system.md`
- `10-src/01_Admin/styles/portal-production.css`
