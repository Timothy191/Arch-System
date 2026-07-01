# ADR-003: Root directory industry-standard abbreviations

## Status

Accepted — 2026-07-01

## Context

The repository mixes unnumbered top-level folders (`apps/`, `pkgs/`, `libs/`, …) with the greenfield convention `src/NN_Module`. Operators and agents need a single, usage-ranked hierarchy: **most-referenced directories get the lowest prefix** (00 = highest traffic).

## Decision

Adopt `industry-standard abbreviations` at repository root. Names follow enterprise monorepo vocabulary (applications, platform packages, domain libraries, operations automation, infrastructure as code).

### Usage audit (2026-07-01)

| Rank | Abbreviation | Purpose |  | Role |
|------|--------|-------------|---------------:|------|
| 00 | `apps` | `apps/` | 429 | Deployable apps (portal, cms, overview) |
| 01 | `pkgs` | `pkgs/` | 371 | Shared `@repo/*` platform libraries |
| 02 | `libs` | `libs/` | 81 | Feature UI + data-access modules |
| 03 | `ops` | `ops/` | 45 | Dev, deploy, agent orchestration |
| 04 | `assets` | `assets/` | 21 | Icons/assets synced to portal `public/` |
| 05 | `src` | `src/` | 11 | Mission-scoped greenfield modules (`00_core_modules`, …) |
| 06 | `docs` | `docs/` | 148 | ADRs, wiki, product docs |
| 07 | `toolchain` | `toolchain/` | 18 | Lint, policy, toolchain config |
| 08 | `tools` | `tools/` | 21 | Policy compiler, audits |
| 09 | `e2e` | `e2e/` | 29 | Playwright suites |
| 10 | `infra` | `infra/` | 23 | Docker, K8s, compose |
| 11 | `ci` | `ci/` | 3 | CI helpers |
| 12 | `cache` | `cache/` | 7 | Local Redis offload stack |
| 14 | `obs` | `obs/` | 1 | Prometheus scrape config |
| 15 | `perf` | `perf/` | 2 | k6 load scripts |
| 16 | `db-ref` | `database/` | 1 | Root DB reference README |

\*TypeScript/JS/CSS/SQL/shell/Python sources excluding `node_modules` and `.next`.

**Excluded from rename:** `node_modules/`, `.git/`, `.ai_content/`, `run/` (gitignored ephemeral), root harness docs (`HOW.md`, `AGENTS.md`, …).

### Internal greenfield numbering

Inside `src/`, retain `NN_Module` prefixes (`00_core_modules`, `01_Admin`, …) per architecture-protocols.

### TypeScript aliases

- `@src/*` → `src/*` (canonical)
- `@05-greenfield/*` → `src/*` (deprecated shim until callers migrate)

## Consequences

- `pnpm-workspace.yaml`, Nx `project.json`, CI, and scripts must reference abbreviated paths.
- One mechanical rename PR + `pnpm install` to refresh lockfile link paths.
- Documentation and symlinks at repo root updated to `docs/`.

## Verification

```bash
python3 ops/repository/verify-root-hierarchy.py
pnpm --filter portal type-check
pnpm --filter portal test -- --testPathPatterns=login
```
