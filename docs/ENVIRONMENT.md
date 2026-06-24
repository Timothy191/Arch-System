# Environment Variables Guide

This document outlines the environment variables used across the Arch-System monorepo.

## Frontend (Portal & Overview)

- `NEXT_PUBLIC_SUPABASE_URL`: The public URL of the Supabase instance.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: The public anonymous key for Supabase.

## Backend (Supabase, Payload CMS)

- `SUPABASE_SERVICE_KEY`: Service role key for administrative DB access (NEVER expose to frontend).
- `DATABASE_URL`: Connection string for PostgreSQL.
- `PAYLOAD_SECRET`: Secret key for Payload CMS sessions/auth.

## Third-Party Integrations

- `N8N_URL`: URL to the n8n automation instance.
- `FLOWISE_URL`: URL to the Flowise LLM orchestration instance.
- `REDIS_URL`: Connection string for Redis caching.

## Telemetry & Observability

- `NEXT_TELEMETRY_DISABLED`: Set to `1` to disable Next.js telemetry.
- `OTEL_EXPORTER_OTLP_ENDPOINT`: Endpoint for OpenTelemetry distributed tracing.

**Note:** All development variables should be provided via `.env` files (copy from `.env.example`). Production secrets must be injected securely via a vault mechanism (e.g., Kubernetes Secrets, HashiCorp Vault) and never stored in plain text.
