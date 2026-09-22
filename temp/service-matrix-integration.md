# Control-Access Service Matrix Integration Brief

## Source

User-provided service matrix for a local mine-access-control deployment. Stored in `temp/service-matrix-integration.md` for swarm agents to reference without exposing secrets or credentials.

## Services (no secrets)

| Service            | Protocol / Port  | Auth Pattern            | Purpose                            |
| ------------------ | ---------------- | ----------------------- | ---------------------------------- |
| Control-Access     | HTTP 8080 / 80   | Session / API Key       | Primary Mine Access Control Portal |
| Control-Access TLS | HTTPS 8443       | TLS 1.3 / Session       | Encrypted Local Access Gateway     |
| Mosquitto MQTT     | TCP 1883         | Password Auth Required  | IoT Scanner & Telemetry Bus        |
| MinIO S3           | HTTP 9000 / 9001 | S3 Key / Console Auth   | Audit Logs, Photos & Backups       |
| Vaultwarden        | HTTP 8082        | Master Password         | Password & Secrets Vault           |
| Uptime Kuma        | HTTP 3001        | Dashboard Login         | Infrastructure Health Monitor      |
| n8n Automation     | HTTP 5678        | JWT / API Key           | Industrial Workflow Engine         |
| Ollama Local LLM   | HTTP 11434       | Localhost Only          | Edge AI Inference (qwen2.5:0.5b)   |
| Valkey (Redis)     | TCP 6379         | Localhost Socket / Port | Rate Limiting & Session Store      |
| Prometheus         | HTTP 9091        | Basic Auth Protected    | Metrics & Telemetry Time-Series    |
| Netdata            | HTTP 19998       | Basic Auth Protected    | Real-Time Hardware & OS Monitor    |

## Verified state

- 74/74 test assertions passed across 3 suites.
- Active systemd services: caddy, control-access, mosquitto, netdata, valkey.
- Healthy Docker containers: uptime-kuma, minio-s3, vaultwarden.

## Integration touchpoints for Arch-System

1. **Control-Access Portal (HTTP/HTTPS)** — external identity/access events, cardholder data, gate telemetry.
2. **Mosquitto MQTT (TCP 1883)** — real-time IoT scanner and sensor events.
3. **n8n (HTTP 5678)** — workflow automation, webhook ingress, OAuth callbacks.
4. **MinIO S3 (HTTP 9000/9001)** — audit logs, photos, backups storage.
5. **Valkey/Redis (TCP 6379)** — session store, rate limiting, pub/sub event bus.
6. **Ollama (HTTP 11434)** — local LLM inference (currently localhost-only).
7. **Prometheus + Netdata** — metrics and hardware monitoring.

## Goal of the swarm

Research and identify:

- Which MCP server(s) or custom tools can expose these services to Claude Code / the agentic system.
- How the Arch-System Next.js portal (`apps/portal`) and shared packages should integrate with each service.
- A full-stack deployment/orchestration plan that keeps local services reachable from the monorepo while preserving security boundaries.
- Any missing `.agents/rules/` or documentation needed to govern agent access to these endpoints.
