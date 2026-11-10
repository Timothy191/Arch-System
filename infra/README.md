# Arch-System Infrastructure (`infra/`)

Production-grade infrastructure manifests, container orchestration profiles, observability pipelines, caching topologies, and on-premises deployment runbooks for **Arch-System (Plantcor / Arch OS)**.

---

## 1. Directory Overview

The `infra/` directory organizes all local, on-premises, and cloud infrastructure configurations by domain:

- **`docker/`**: Centralized Docker Compose profiles and reverse-proxy configurations (`Caddyfile`, `compose.portal.yml`, `compose.production.yml`, `compose.staging.yml`, `compose.full-stack.yml`, `compose.redis.yml`, `compose.redis-stack.yml`, `compose.tools.yml`, `compose.ai-tools.yml`, `compose.security.yml`, `compose.dashboards.yml`, `compose.n8n-production.yml`).
- **`k8s/`**: Kubernetes production manifests, HorizontalPodAutoscaler (`hpa.yaml`), Argo Rollouts (`rollout.yaml`, `analysis-template.yaml`), NetworkPolicy (`network-policy.yaml`), Ingress (`ingress.yaml`), Cert-Manager (`cert-manager-issuer.yaml`), External Secrets, Helm charts, Kustomize overlays, and Velero backup schedules (`velero-schedule.yaml`).
- **`monitoring/`**: Core observability runtime definitions (`docker-compose.yml`, `otel-collector-config.yaml`, `grafana-provisioning/`) for Prometheus, Grafana, and the OpenTelemetry Collector.
- **`observability/`**: Prometheus scrape configurations (`prometheus.yml`), Alertmanager routing (`alertmanager.yml`), custom alert rules (`prometheus-rules/`), and Grafana dashboard JSON models (`grafana-dashboards/`).
- **`redis/`**: Redis L2 cache and cluster configurations (`redis.conf`, `acl/`, `config/shard-map.json`, `docker-compose/redis-cluster.yml`, and `terraform/`).
- **`systemd/`**: Linux service units and timers (`arch-systems.service`, `arch-systems-local.service`, `arch-agents.service`, `arch-backup.timer`, `arch-health.timer`) for bare-metal mining site servers.
- **`terraform/`**: Cloud infrastructure-as-code modules (`main.tf`, `vpc.tf`, `eks.tf`, `storage.tf`, `cdn.tf`, `dns.tf`, `backend.tf`, `variables.tf`, `outputs.tf`).
- **`vault/`**: HashiCorp Vault server configuration (`vault-config.hcl`) and access control policies (`policies/`).
- **`argocd/`**: GitOps continuous delivery application manifest (`application.yaml`).
- **`cloudflared/`**: Cloudflare Tunnel configuration template (`production-tunnel.yml.example`) for zero-trust ingress without opening inbound firewall ports.
- **`cron/`**: Scheduled database maintenance and backup jobs (`db-backup.cron`).

---

## 2. Local & On-Premises Docker Compose Topologies

Arch-System supports modular Docker Compose profiles for local development, air-gapped mining site servers, and staging environments.

### Core Compose Profiles

1. **Portal & Core Services (`infra/docker/compose.portal.yml` & `compose.production.yml`)**:
   Runs the Next.js 16 portal (`apps/portal`), Caddy/Nginx reverse proxy, and production environment overrides.
2. **Redis L2 & Cluster Stack (`infra/docker/compose.redis.yml` & `compose.redis-stack.yml`)**:
   Provides low-latency L2 caching, Pub/Sub tag invalidation channels, rate-limiting buckets, and SCADA telemetry streams on port `6379`.
3. **Secondary Workflow & AI Tooling (`infra/docker/compose.tools.yml` & `compose.ai-tools.yml`)**:
   Launches auxiliary workflow automation, MinIO S3-compatible storage, FUXA SCADA HMI (`port 1881`), and local LLM inference services.
4. **Full-Stack On-Premises Bundle (`infra/docker/compose.full-stack.yml`)**:
   Combines portal, Redis, database backups, and reverse proxy into a unified stack for single-server mining site deployments.

### Common Orchestration Commands

```bash
# Deploy full local / on-premises stack
./scripts/deploy.sh local

# Start standalone Redis L2 cache instance
docker compose -f infra/docker/compose.redis.yml up -d

# Start auxiliary developer and workflow tools
docker compose -f infra/docker/compose.tools.yml up -d
```

---

## 3. Observability Stack (Prometheus, Grafana, Alertmanager, OpenTelemetry)

The observability pipeline collects application, cache, database, and SCADA telemetry metrics across `infra/monitoring/` and `infra/observability/`.

### Architecture & Data Flow

- **Application Metrics (`/api/metrics`)**:
  Prometheus scrapes the portal's `/api/metrics` endpoint (`infra/observability/prometheus.yml`) for HTTP request latency histograms, L1/L2 cache hit ratios, TinyLFU eviction counters (`l1_eviction`), L2 round-trips (`l2_round_trip`), privilege version changes, and write-through delay (`write_through_delay_ms`).
- **OpenTelemetry Collector (`infra/monitoring/otel-collector-config.yaml`)**:
  Receives OTLP traces and metrics from the Next.js server runtime and forwards spans and metrics to Prometheus and tracing backends.
- **Grafana Dashboards (`infra/observability/grafana-dashboards/`)**:
  Pre-provisioned via `infra/monitoring/grafana-provisioning/` to visualize portal throughput, Redis memory utilization, Postgres connection pools, and department shift KPIs.
- **Alertmanager (`infra/observability/alertmanager.yml` & `prometheus-rules/`)**:
  Evaluates threshold and anomaly rules (including SCADA stream z-score anomalies, Redis connectivity drops, and elevated 5xx error rates) and dispatches notifications to control room operators.

### Starting & Stopping the Monitoring Stack

```bash
# Launch Prometheus, Grafana, and OpenTelemetry Collector
pnpm monitor:grafana

# Stop the monitoring stack
pnpm monitor:grafana-stop
```

---

## 4. MinIO S3-Compatible Turborepo Remote Cache & Security Hardening

Arch-System accelerates monorepo builds across developer workstations and CI runners using a self-hosted MinIO S3-compatible remote cache (`turbo-remotecache-s3`).

### Remote Cache Configuration

- **Bucket**: `turborepo-cache` hosted on the local or on-premises MinIO instance.
- **Integration**: Configured via root Turborepo settings and environment variables (`TURBO_TEAM`, `TURBO_TOKEN`, `S3_ENDPOINT`, `S3_BUCKET`).

### Security Hardening Controls

1. **Least-Privilege IAM Policy**:
   MinIO access is restricted to a dedicated service account scoped strictly to `s3:GetObject`, `s3:PutObject`, and `s3:ListBucket` on `arn:aws:s3:::turborepo-cache/*`. Wide-open administrative credentials are prohibited in build environments.
2. **Artifact Signature Verification**:
   Turborepo remote cache artifact signing is enabled (`signature: true`) to prevent cache poisoning or unauthorized binary tampering.
3. **Network Isolation**:
   MinIO API ports are bound to internal Docker networks or authenticated VPN/Cloudflare Tunnel interfaces (`infra/cloudflared/`), never exposed publicly without TLS termination.

---

## 5. Verification & Health Check Commands

Use the following commands to verify infrastructure readiness, endpoint health, and real-layer performance across Postgres, Redis, and the Next.js portal:

```bash
# 1. Verify portal liveness and upstream dependency health (Supabase, Redis)
curl -fsS http://localhost:3000/api/health | jq .

# 2. Verify Prometheus metrics exposition
curl -fsS http://localhost:3000/api/metrics | head -n 40

# 3. Execute real-layer infrastructure performance verification
pnpm perf:real-layer

# 4. Run full 28-gate repository verification suite
pnpm agent:verify
```
