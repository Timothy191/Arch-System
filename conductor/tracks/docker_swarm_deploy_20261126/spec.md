<!-- cspell:ignore Caddyfile distroless allkeys requirepass healthcheck arch_internal arch_public start-first stop-first -->

# Specification: Automated Idempotent Docker Swarm Deployment Workflow (`docker_swarm_deploy_20261126`)

## Overview

Implement an automated, idempotent Docker Swarm deployment workflow for **Arch-System (Plantcor / Arch OS)** orchestrated under Conductor, covering:

1. **Swarm Stack Manifest (`infra/docker/swarm/stack.arch-system.yml`)** for `caddy`, `portal`, and `redis`.
2. **Idempotent Deployment Script (`infra/docker/swarm/deploy-swarm.sh`)** with preflight checks, config validation, rolling deployment, convergence polling, automated rollback/diagnostics, post-deploy health probes, and safe `--dry-run` / `--validate-only` modes.
3. **Automated Verification Suite (`infra/docker/swarm/verify-swarm-workflow.test.mjs`)** using `node --test`.
4. **Operational Runbook (`infra/docker/swarm/README.md`)** documenting topology, secret contracts, CLI parameters, and recovery criteria.

## Discovery Findings

- **Docker Engine**: Client/Server `29.9.2`, Compose `5.6.1`, local Swarm `LocalNodeState: inactive` (`ControlAvailable: false`).
- **Portal Runtime (`apps/portal/docker/Dockerfile`)**: 4-stage Turborepo-pruned build ending on `gcr.io/distroless/nodejs24-debian12` (`USER 65532`, `PORT=3000`, no shell/`curl`/`wget`). Healthcheck must invoke `node -e` against `http://127.0.0.1:3000/api/health`.
- **Health Endpoint (`apps/portal/app/api/health/route.ts`)**: Probes Supabase, Redis, and optional FUXA; returns HTTP `200` (`healthy` / `degraded`) or `503` (`unhealthy`).
- **Environment Contract (`libs/shared/utils/src/env.ts`)**: Production requires `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Sensitive secrets (`SUPABASE_SERVICE_KEY`, `DATABASE_URL`, Redis password, `CRON_SECRET`, `WEBHOOK_SECRET`) are injected via external Docker Swarm secrets at `/run/secrets/arch_*`.

## Functional Requirements

- **Network Isolation**: `arch_internal` (`driver: overlay`, `internal: true`, `encrypted: true`) isolates `portal` and `redis`; `arch_public` (`driver: overlay`) exposes only `caddy` (`80`/`443`).
- **Rolling Updates & Rollback**: All services define `healthcheck`, `deploy.resources.limits`, `deploy.update_config` (`failure_action: rollback`), and `deploy.rollback_config`. `portal` and `caddy` use `order: start-first`; `redis` uses `order: stop-first` to protect `redis_data`.
- **Idempotent Orchestration**: `deploy-swarm.sh` supports `--dry-run` and `--validate-only` safely when Swarm is inactive, and uses `docker stack deploy --prune` + convergence polling + `docker service rollback` on failure in live mode.

## Acceptance Criteria

- `bash -n infra/docker/swarm/deploy-swarm.sh` exits `0`.
- `infra/docker/swarm/deploy-swarm.sh --dry-run` and `--validate-only` exit `0` idempotently.
- `node --test infra/docker/swarm/verify-swarm-workflow.test.mjs` passes all assertions.
- `markdownlint`, `cspell`, `pnpm policy:check`, and `pnpm validate:json` pass on all touched files.
- Zero edits to `apps/portal/features/hub/`, `apps/portal/app/hub/`, `packages/ui/`, or `packages/theme/`.

## Out of Scope

- Initializing a live production Swarm cluster or committing real secrets.
- Pushing to `origin/main` or deploying to Vercel.
