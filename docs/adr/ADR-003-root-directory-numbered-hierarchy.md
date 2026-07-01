# ADR-003: Root directory numbered hierarchy

## Status

Accepted — 2026-06-30

## Context

The repository mixes unnumbered top-level folders (`00_applications/`, `01_platform_packages/`, `02_domain_libraries/`, …) with the greenfield convention `05_greenfield_application_source/NN_Module`. Operators and agents need a single, usage-ranked hierarchy: **most-referenced directories get the lowest prefix** (00 = highest traffic).

## Decision

Adopt `NN_descriptive_snake_case` at repository root. Names follow enterprise monorepo vocabulary (applications, platform packages, domain libraries, operations automation, infrastructure as code).

### Usage audit (2026-06-30)

| Rank | Prefix | Former path | Source files* | Role |
|------|--------|-------------|---------------:|------|
| 00 | `00_applications` | `00_applications/` | 429 | Deployable apps (portal, cms, overview) |
| 01 | `01_platform_packages` | `01_platform_packages/` | 371 | Shared `@repo/*` platform libraries |
| 02 | `02_domain_libraries` | `02_domain_libraries/` | 81 | Feature UI + data-access modules |
| 03 | `03_operations_automation` | `03_operations_automation/` | 45 | Dev, deploy, agent orchestration |
| 04 | `04_shared_static_assets` | `04_shared_static_assets/` | 21 | Icons/assets synced to portal `public/` |
| 05 | `05_greenfield_application_source` | `05_greenfield_application_source/` | 11 | Mission-scoped greenfield modules (`00_core_modules`, …) |
| 06 | `06_technical_documentation` | `06_technical_documentation/` | 148 | ADRs, wiki, product docs |
| 07 | `07_toolchain_configuration` | `07_toolchain_configuration/` | 18 | Lint, policy, toolchain config |
| 08 | `08_developer_tooling` | `08_developer_tooling/` | 21 | Policy compiler, audits |
| 09 | `09_end_to_end_verification` | `09_end_to_end_verification/` | 29 | Playwright suites |
| 10 | `10_infrastructure_as_code` | `10_infrastructure_as_code/` | 23 | Docker, K8s, compose |
| 11 | `11_continuous_integration` | `11_continuous_integration/` | 3 | CI helpers |
| 12 | `12_distributed_cache_runtime` | `12_distributed_cache_runtime/` | 7 | Local Redis offload stack |
| 14 | `14_observability_configuration` | `14_observability_configuration/` | 1 | Prometheus scrape config |
| 15 | `15_load_performance_testing` | `15_load_performance_testing/` | 2 | k6 load scripts |
| 16 | `16_database_reference_artifacts` | `database/` | 1 | Root DB reference README |

\*TypeScript/JS/CSS/SQL/shell/Python sources excluding `node_modules` and `.next`.

**Excluded from rename:** `node_modules/`, `.git/`, `.ai_content/`, `run/` (gitignored ephemeral), root harness docs (`HOW.md`, `AGENTS.md`, …).

### Internal greenfield numbering

Inside `05_greenfield_application_source/`, retain `NN_Module` prefixes (`00_core_modules`, `01_Admin`, …) per architecture-protocols.

### TypeScript aliases

- `@05-greenfield/*` → `05_greenfield_application_source/*` (canonical)
- `@05_greenfield_application_source/*` → same path (deprecated shim until callers migrate)

## Consequences

- `pnpm-workspace.yaml`, Nx `project.json`, CI, and scripts must reference numbered paths.
- One mechanical rename PR + `pnpm install` to refresh lockfile link paths.
- Documentation and symlinks at repo root updated to `06_technical_documentation/`.

## Verification

```bash
python3 03_operations_automation/repository/verify-root-hierarchy.py
pnpm --filter portal type-check
pnpm --filter portal test -- --testPathPatterns=login
```
