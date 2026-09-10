---
title: "ADR-011: Turborepo and Boundaries Plugin for Monorepo Management"
created: 2026-09-10
updated: 2026-09-10
type: decision
status: accepted
tags: [adr, monorepo, build, decision, turborepo, boundaries]
sources: [turbo.json, package.json, tools/policy-compiler.cjs]
confidence: high
---

# ADR-011: Turborepo and Boundaries Plugin for Monorepo Management

## Status

**Accepted** — Implemented September 2026 (Supersedes [[adr-008-nx-monorepo]])

## Context

In June 2026, the monorepo migrated to Nx 22.7.5 to handle test suite stabilization and fine-grained token caching. However, over time, the Nx setup introduced several maintainability complexities:

- Requirement for 24 separate `project.json` files solely to carry project tags for `@nx/enforce-module-boundaries`.
- Heavy multi-package Nx dependencies (`@nx/eslint-plugin`, `@nx/vite`, `nx`, `nx-remotecache-s3`) and large `.nx/cache` directory overhead.
- Tight coupling of build/lint scripting with Nx daemon semantics.

With Turborepo 2.x maturing its pipeline caching, global environment hashing, and fine-grained `inputs`/`outputs` modeling, and with `eslint-plugin-boundaries` providing lightweight pattern-based architectural boundary enforcement, we re-evaluated our monorepo architecture.

## Decision

We migrate the monorepo task orchestration from **Nx** to **Turborepo 2.x** and replace `@nx/enforce-module-boundaries` with **`eslint-plugin-boundaries`**, maintaining **pnpm workspaces** for package management.

### Key Details

1. **Turborepo Core (`turbo.json`)**:
   - Single root `turbo.json` configures all task pipelines (`build`, `codegen`, `sync-assets`, `lint`, `lint:tokens`, `lint:css`, `type-check`, `test`).
   - `globalEnv` tracks 12+ environment cache signatures (`NODE_ENV`, `VERCEL_ENV`, `OTEL_EXPORTER_OTLP_ENDPOINT`, `INNGEST_EVENT_KEY`, etc.).
   - Eliminates all 24 `project.json` files and `nx.json`.

2. **Architectural Boundaries (`eslint-plugin-boundaries`)**:
   - The Policy SSoT compiler (`tools/policy-compiler.cjs`) compiles `DEPENDENCY_RULES` directly into `eslint-plugin-boundaries` `element-types` configuration.
   - Preserves 100% of architectural barriers (UI purity, database isolation, theme unidirectional dependency).

3. **Test Stability Guard**:
   - Explicit `--concurrency` controls and `--runInBand` flags prevent worker contention under parallel execution.

4. **Command Redirection**:
   - Route core workspace commands (`pnpm build`, `pnpm lint`, `pnpm test`, `pnpm type-check`, `pnpm quality`) through `turbo run`.

## Consequences

### Positive

- **Lightweight Architecture**: Eliminated 24 `project.json` metadata files and all `@nx/*` packages.
- **Fast Task Orchestration**: Rust-native Turborepo binary provides near-zero startup overhead and deterministic local/remote caching.
- **SSoT Preservation**: Architectural rules remain strictly compiled and checked via `pnpm policy:check`.
- **Simplified Tooling**: Standardized on standard Vite (`vite-tsconfig-paths`) and ESLint boundary plugins without custom executor lock-in.

### Negative

- **Script Syntax Migration**: Developers transition from `nx run-many` / `nx affected` to `turbo run` / `turbo run --filter=...[HEAD~1]`.

## Related

- [[adr-008-nx-monorepo]] — Superseded decision record (Nx)
- [[adr-003-turborepo-monorepo]] — Historical Turborepo decision record
