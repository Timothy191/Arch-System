# n8n Backend Requirements

## Runtime Contract

The repository uses the existing n8n engine at `http://192.168.1.79:5678`.
The engine is an external service and is not provisioned by the repository's
Docker Compose tools stack.

Required checks:

- `GET /healthz` returns `200`.
- Unauthenticated workflow API requests return `401`.
- Authenticated API requests use an n8n API key supplied at runtime through
  `N8N_API_KEY`; keys must never be committed or printed by verification tools.
- OAuth providers use this callback URL:
  `http://192.168.1.79:5678/rest/oauth2-credential/callback`.

An OAuth client ID is issued by the identity provider being connected. n8n
does not provide a universal client ID. Create the provider application first,
register the callback above, and store its client ID and secret in the n8n
credential configuration. For production, replace the LAN callback with a TLS
hostname before enabling remote access.

## Redis and Queueing

The portal and local automation helpers use:

```text
redis://127.0.0.1:6379
```

Redis must remain loopback-only. Do not use `192.168.1.79:6379` from another
device unless a separately authenticated and encrypted Redis gateway is added.

## ScrapingBee Workflow

The `ScrapingBee/n8n-no-code-web-scraper` workflow requires:

- An n8n HTTP Request node configured with `SCRAPINGBEE_API_URL`.
- A ScrapingBee API key stored as an n8n credential or runtime secret.
- A defined input schema for target URL, extraction instructions, and limits.
- Rate limiting, timeout, retry, and robots/compliance policy.
- An output contract that records source URL, fetch timestamp, status, and
  extracted content or an error.
- An LLM credential when extraction uses an AI node. The local Ollama endpoint
  is `http://127.0.0.1:11434` and must not be exposed beyond localhost.

The repository does not contain the workflow export or a ScrapingBee key, so
it cannot claim end-to-end scraper execution until an operator imports the
workflow and configures those credentials in n8n.

## Service Matrix Boundary

The following services are external dependencies and are not created by this
repository: Control-Access, Mosquitto MQTT, MinIO, Vaultwarden, Uptime Kuma,
and Netdata. Their endpoints must be supplied through deployment-specific
configuration and verified separately. The local verifier reports them as
warnings rather than assuming that a missing listener is a repository bug.

## Verification

Run:

```bash
bash scripts/verify-n8n-stack.sh
```

This verifies n8n, Redis, the portal, Flowise, Langfuse, Qdrant, ClickHouse,
Prometheus, and Ollama. It validates the n8n unauthenticated API boundary and
never prints secret values. A passing result proves service reachability, not
that a particular n8n workflow is imported, active, or authorized to call an
external provider.
