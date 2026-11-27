<!-- cspell:ignore Caddyfile distroless markdownlint cspell healthcheck -->

# Implementation Plan: Automated Idempotent Docker Swarm Deployment Workflow

## Phase 1: Environment & Infrastructure Discovery

- [x] Task: Inspect existing Docker, network, health, and environment contracts
  - [x] Inspect `infra/docker/*`, `apps/portal/docker/Dockerfile`, `infra/monitoring/docker-compose.yml`, and `libs/shared/utils/src/env.ts`
  - [x] Verify local Docker Engine (`29.9.2`), Swarm state (`inactive`), networks, and health endpoint (`apps/portal/app/api/health/route.ts`)

## Phase 2: Docker Swarm Stack, Automation & Verification Suite

- [x] Task: Write verification test suite (`infra/docker/swarm/verify-swarm-workflow.test.mjs`)
  - [x] Verify `deploy-swarm.sh` syntax (`bash -n`), `stack.arch-system.yml` invariants (`docker stack config`), `--dry-run` idempotency, `--validate-only`, and Conductor track registration
- [x] Task: Implement Swarm stack manifest (`infra/docker/swarm/stack.arch-system.yml`)
  - [x] Configure `portal`, `redis`, and `caddy` with `healthcheck`, `resources`, `update_config` (`failure_action: rollback`), `rollback_config`, encrypted `arch_internal` + `arch_public` overlays, and external secrets
- [x] Task: Implement automated deployment script (`infra/docker/swarm/deploy-swarm.sh`)
  - [x] Implement env validation, Swarm/secret/network preflight, `docker stack config` check, `docker stack deploy --prune`, convergence polling, automated `docker service rollback` + diagnostics, health probes, and `--dry-run` / `--validate-only`
- [x] Task: Author operational runbook (`infra/docker/swarm/README.md`)

## Phase 3: Conductor Registration & Full Verification

- [x] Task: Register track `docker_swarm_deploy_20261126` in `conductor/tracks.md`
- [x] Task: Execute all verification gates (`bash -n`, `--dry-run`, `node --test`, `markdownlint`, `cspell`, `pnpm policy:check`, `pnpm validate:json`)

## Phase 4: Distroless Secret Files & Swarm Execution Hardening

- [x] Task: Implement pure `*_FILE` secret loader in `@repo/shared/utils` (`secret-files.ts`) and wire in `apps/portal/instrumentation.ts`
- [x] Task: Add Jest unit test coverage in `libs/shared/utils/src/secret-files.test.ts` (11/11 passing)
- [x] Task: Configure configurable ports (8080/8443 defaults) and `--local-image` / `--resolve-image` flags in `deploy-swarm.sh` and `stack.arch-system.yml`
- [x] Task: Expand test suite in `infra/docker/swarm/verify-swarm-workflow.test.mjs` to assert `--local-image` and port overrides
