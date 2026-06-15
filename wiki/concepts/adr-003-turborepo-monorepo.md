---
title: "ADR-003: Turborepo for Monorepo Management"
created: 2026-05-15
updated: 2026-06-03
type: decision
status: superseded
tags: [adr, monorepo, build, decision]
sources: [wiki/comparisons/monorepo-tools.md, turbo.json, CLAUDE.md]
confidence: high
---

# ADR-003: Turborepo for Monorepo Management

> [!WARNING]
> This decision has been **superseded** by [[adr-008-nx-monorepo]]. The project has migrated to Nx for workspace task orchestration and stabilized test runners.

## Status

**Superseded** by [[adr-008-nx-monorepo]] (June 2026)

## Context

We needed to organize a growing codebase with:

- Main portal application (Next.js 15)
- Shared UI component library
- Shared utilities and types
- Separate CMS application
- Consistent build pipeline across packages
- Fast CI/CD with intelligent caching

## Decision

We will use **Turborepo 2.1 with pnpm 9.12.0 workspaces**.

### Key Decisions Within This Choice

1. **Turborepo** — Task orchestration and caching
2. **pnpm workspaces** — Package management and linking
3. **Workspace catalogs** — Centralized dependency versions
4. **Path aliases** — `@/` and `~/` → `apps/portal/`

## Consequences

### Positive

- **Build caching** — Local and remote cache for faster builds
- **Task pipeline** — Graph-based dependency-aware builds
- **pnpm efficiency** — Disk space savings, faster installs
- **Catalog versions** — Single source of truth for shared deps
- **Vercel integration** — Zero-config deployments
- **Incremental builds** — Only rebuilds affected packages

### Negative

- **Turborepo learning curve** — New concepts (pipeline, cache)
- **pnpm adoption** — Team must learn pnpm commands
- **Debugging complexity** — Build issues harder to trace across packages

### Neutral

- **Vercel preference** — Turborepo is Vercel-native

## Alternatives Considered

### Nx (REJECTED)

- More powerful but overkill for our scale (3 apps, 8 packages)
- Steeper learning curve
- Angular-legacy perception (though framework-agnostic now)

### pnpm Workspaces Alone (REJECTED)

- No build orchestration across dependency graph
- No task caching (critical for CI speed)
- Manual script management for builds

### npm/Yarn + Lerna (REJECTED)

- Lerna in maintenance mode
- npm/yarn slower than pnpm
- Less monorepo-native features

## Implementation Notes

- `pnpm-workspace.yaml` defines workspace packages
- `turbo.json` configures task dependencies
- `catalog:` and `catalog:react19` in workspace.yaml
- `@repo/*` naming convention for internal packages

## Related

- [[turborepo-monorepo]] — Workspace layout and conventions
- [[comparisons/monorepo-tools]] — Detailed comparison
