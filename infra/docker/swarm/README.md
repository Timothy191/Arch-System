<!-- cspell:ignore Caddyfile distroless allkeys requirepass healthcheck arch_internal arch_public start-first stop-first markdownlint cspell otel cadvisor -->

# Arch-System Docker Swarm Deployment Runbook

Production-grade, idempotent Docker Swarm deployment workflow for **Arch-System (Plantcor / Arch OS)** orchestrated with Conductor (`conductor/tracks/docker_swarm_deploy_20261126/`).

---

## 1. Infrastructure Specifications

| Component | Image / Runtime                                                                     | Replicas                | CPU Limit / Reservation | Memory Limit / Reservation | Healthcheck                                                 |
| :-------- | :---------------------------------------------------------------------------------- | :---------------------- | :---------------------- | :------------------------- | :---------------------------------------------------------- |
| `caddy`   | `caddy:2.8-alpine`                                                                  | `2` (`CADDY_REPLICAS`)  | `0.5` / `0.1`           | `256M` / `64M`             | `wget` `http://127.0.0.1:2019/config/`                      |
| `portal`  | `ghcr.io/plantcor/arch-system-portal:1.6.2` (`gcr.io/distroless/nodejs24-debian12`) | `2` (`PORTAL_REPLICAS`) | `1.0` / `0.25`          | `1024M` / `512M`           | `node -e "fetch('http://127.0.0.1:3000/api/health')..."`    |
| `redis`   | `redis:7.4-alpine`                                                                  | `1` (manager-pinned)    | `0.5` / `0.1`           | `384M` / `128M`            | `redis-cli` `PING` using `/run/secrets/arch_redis_password` |

> **Distroless Constraint:** `apps/portal/docker/Dockerfile` produces a `gcr.io/distroless/nodejs24-debian12` runtime image (`USER 65532`, no `/bin/sh`, `curl`, or `wget`). The `portal` healthcheck therefore executes `node -e` directly.

---

## 2. Network Topology & Service Dependency Graph

```text
Internet / Site LAN
       │  (TCP 80 / 443 via Swarm ingress mesh)
       ▼
┌─────────────────────────────────────────┐
│  arch_public (overlay, attachable)      │
│    └─ caddy (ports 80, 443)             │
└──────────────────┬──────────────────────┘
                   │  (proxy /* -> portal:3000)
┌──────────────────▼──────────────────────┐
│  arch_internal (overlay, internal,      │
│                 IPsec encrypted=true)   │
│    ├─ portal (:3000, distroless Node 24)│
│    └─ redis  (:6379, RDB + 256MB LRU)   │
└──────────────────┬──────────────────────┘
                   │  (egress via host / Cloud Supabase)
                   ▼
          Cloud Supabase (PG 17)
```

- **`arch_public`**: Attachable overlay network carrying ingress HTTP/HTTPS traffic to `caddy`.
- **`arch_internal`**: `internal: true` + `encrypted: true` overlay network isolating `portal` and `redis` from direct external access.
- **Startup & Convergence Order**: `redis` -> `portal` -> `caddy`.

---

## 3. Credential & External Docker Secret Contract

Zero secrets are stored in `stack.arch-system.yml` or committed to Git. All sensitive runtime credentials must be provisioned as external Docker Swarm secrets before live deployment:

| Swarm Secret Name           | Container Mount Path                     | Purpose                                              |
| :-------------------------- | :--------------------------------------- | :--------------------------------------------------- |
| `arch_supabase_service_key` | `/run/secrets/arch_supabase_service_key` | Supabase service-role key for privileged server jobs |
| `arch_database_url`         | `/run/secrets/arch_database_url`         | PostgreSQL / Supavisor connection string             |
| `arch_redis_password`       | `/run/secrets/arch_redis_password`       | Redis `requirepass` & portal L2 auth                 |
| `arch_cron_secret`          | `/run/secrets/arch_cron_secret`          | Cron endpoint bearer secret (`CRON_SECRET`)          |
| `arch_webhook_secret`       | `/run/secrets/arch_webhook_secret`       | Inbound webhook verification secret                  |

### Provisioning & Rotating External Secrets

```bash
# Provision on Swarm manager (never pass secrets via CLI args in shared logs; pipe via stdin)
printf '%s' "$SUPABASE_SERVICE_KEY" | docker secret create arch_supabase_service_key -
printf '%s' "$DATABASE_URL"         | docker secret create arch_database_url -
printf '%s' "$REDIS_PASSWORD"       | docker secret create arch_redis_password -
printf '%s' "$CRON_SECRET"          | docker secret create arch_cron_secret -
printf '%s' "$WEBHOOK_SECRET"       | docker secret create arch_webhook_secret -
```

Non-secret configuration (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `PORTAL_IMAGE`, `PORTAL_REPLICAS`, `CADDY_REPLICAS`, `OTEL_EXPORTER_OTLP_ENDPOINT`) is supplied via environment variables or `--env-file`.

---

## 4. Deployment Parameters & CLI Usage

Script: `infra/docker/swarm/deploy-swarm.sh`

| Flag                     | Default                                    | Description                                                     |
| :----------------------- | :----------------------------------------- | :-------------------------------------------------------------- |
| `--stack-name <name>`    | `arch-system`                              | Swarm stack name                                                |
| `--stack-file <path>`    | `infra/docker/swarm/stack.arch-system.yml` | Stack YAML path                                                 |
| `--env-file <path>`      | _(none)_                                   | Optional non-secret env file to source                          |
| `--timeout <seconds>`    | `180`                                      | Max convergence wait across all services                        |
| `--poll-interval <sec>`  | `5`                                        | Polling cadence during convergence                              |
| `--probe-url <url>`      | `http://127.0.0.1:<http-port>/api/health`  | Post-deploy HTTP health probe target                            |
| `--http-port <port>`     | `8080` (`CADDY_HTTP_PORT`)                 | Public Caddy ingress HTTP port                                  |
| `--https-port <port>`    | `8443` (`CADDY_HTTPS_PORT`)                | Public Caddy ingress HTTPS port                                 |
| `--local-image`          | `false`                                    | Use local image without registry pull (`--resolve-image never`) |
| `--resolve-image <mode>` | `always`                                   | Swarm resolve-image mode (`always`, `never`, `changed`)         |
| `--skip-probes`          | `false`                                    | Skip post-deploy HTTP probe                                     |
| `--dry-run`              | `false`                                    | Validate config & print planned actions without mutating Swarm  |
| `--validate-only`        | `false`                                    | Run env, preflight, and `docker stack config` validation only   |

```bash
# Safe local validation when Swarm is inactive
infra/docker/swarm/deploy-swarm.sh --dry-run
infra/docker/swarm/deploy-swarm.sh --validate-only

# Live production deployment on an active Swarm manager
NEXT_PUBLIC_SUPABASE_URL="https://<project>.supabase.co" \
NEXT_PUBLIC_SUPABASE_ANON_KEY="<anon-key>" \
infra/docker/swarm/deploy-swarm.sh
```

---

## 5. Rolling Update, Failure Recovery & Rollback Criteria

- **Zero-Downtime Rolling Updates**: `portal` and `caddy` use `order: start-first`, `parallelism: 1`, `delay: 10s`, and `failure_action: rollback`. `redis` uses `order: stop-first` to prevent dual-writer volume lock contention on `redis_data`.
- **Automated Recovery Trigger**: If any service enters `rollback_*` or `paused`, exceeds `--timeout` before `running == desired`, or fails the post-deploy `/api/health` probe, `deploy-swarm.sh` automatically:
  1. Captures `docker service ps --no-trunc` and `docker service logs --tail 80` into `.ci-local/swarm-diagnostics-<UTC>/`.
  2. Executes `docker service rollback --detach=false <service>` whenever `.PreviousSpec` exists.
  3. Exits non-zero so CI/CD pipelines halt immediately.

---

## 6. Post-Deployment Validation Criteria

1. `docker stack services arch-system` reports `1/1` (`redis`), `2/2` (`portal`), and `2/2` (`caddy`).
2. `GET /api/health` returns HTTP `200` with `"status": "healthy"` or `"degraded"` (HTTP `503` triggers rollback).
3. Local workflow verification suite passes:

```bash
bash -n infra/docker/swarm/deploy-swarm.sh
infra/docker/swarm/deploy-swarm.sh --dry-run
node --test infra/docker/swarm/verify-swarm-workflow.test.mjs
```
