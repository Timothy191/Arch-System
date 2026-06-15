---
title: "ADR-008: Nx for Monorepo Management"
created: 2026-06-03
updated: 2026-06-03
type: decision
status: accepted
tags: [adr, monorepo, build, decision]
sources: [nx.json, package.json, wiki/concepts/nx-monorepo.md]
confidence: high
---

# ADR-008: Nx for Monorepo Management

## Status

**Accepted** — Implemented June 2026

## Context

Previously, the workspace was orchestrated using Turborepo (documented in [[adr-003-turborepo-monorepo]]). As the project grew to incorporate more packages (such as `@repo/errors` and `@repo/rate-limiter`) and more complex test workflows (such as DeepEval AI compliance and Jest environment setups), we hit several challenges:

- Intermittent test runner hangs and Jest environment stabilization issues under Turborepo orchestration.
- The need for finer control over cache inputs/outputs for specialized operations (like Style Dictionary `codegen`, `lint:tokens`, and `lint:css`).
- Desired CLI features like interactive task running and advanced dependency graph visualizers.

## Decision

We will migrate the monorepo task orchestration from **Turborepo** to **Nx 22.7.5**, maintaining **pnpm workspaces** for package linkage.

### Key Details

1. **Nx Core**: Orchestrate tasks via `nx.json` and package-specific targets.
2. **Target Defaults Configuration**: Explicitly define dependencies like `build` relying on `^build` and `^codegen`.
3. **Environment Signature Tracking**: Centralize environment variable cache-invalidation signatures in `nx.json`'s `sharedGlobals`.
4. **Command Redirection**: Route core workspace commands (`pnpm build`, `pnpm lint`, `pnpm test`, `pnpm quality`) through `nx run-many`.

## Consequences

### Positive

- **Stabilized Testing**: Solved the Jest environment hangs and timeout issues, improving local and CI/CD testing reliability.
- **Fine-Grained Caching**: Custom cache rules for code generation and token validation are now possible (avoiding unnecessary rebuilds when only styling tokens change).
- **Interactive Graphing**: Ability to generate interactive dependency graphs using `nx graph` for visual auditing.
- **Topological Integrity**: Native, strict execution order handling for parallel builds.

### Negative

- **Migration Effort**: Required migrating `turbo.json` settings and global scripts to `nx.json` target defaults.
- **Learning Curve**: Team members must familiarize themselves with `nx` command flags and caching behaviors instead of `turbo`.

## Alternatives Considered

- **Retaining Turborepo 2.1**: Rejected because it struggled to stabilize Jest test execution environments under parallel runs.
- **Lerna / pnpm-only**: Rejected due to a lack of task caching and dependency-aware parallelization.

## Related

- [[nx-monorepo]] — Updated workspace layout and conventions
- [[adr-003-turborepo-monorepo]] — Superseded decision record (Turborepo)
- [[comparisons/monorepo-tools]] — Detailed comparison of tools
