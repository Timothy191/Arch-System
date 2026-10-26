# Phase 1 — Baseline Audit: Integrations Marketplace

**Date:** 2026-10-26  
**Mode:** Read-only (no code, schema, config, env, or infra changes)  
**Scope:** Administration → Integrations marketplace (portal)  
**Status:** Complete; awaiting explicit approval for Phase 2.

## 1. Executive summary

The Arch-System integrations marketplace is a functional but lightly governed platform:

- **Storage model** is sound: 4 tables (`integration_catalog`, `integration_installations`, `integration_credentials`, `integration_audit_logs`) with RLS, indexes, audit triggers, AES-256-GCM app-side credential encryption.
- **Catalog** is seeded to 20 curated connectors (migrations 168/186/188) spanning MCP, action bridges, native plugins.
- **UI** is a single client component (`IntegrationManager`) with catalog grid, install form, installed list, tool discovery, tool test, audit log view. Admin-gated at page level.
- **API** exposes CRUD, tool discovery, tool test, and a machine-readable manifest.
- **Guard chain** for tool invocation exists (allowlist, risk class, rate limit, audit digest).

**Critical gaps identified:**

1. **Manifest endpoint returns decrypted secrets in plaintext JSON** (`manifest/route.ts`) — anyone with `INTEGRATIONS_MANIFEST_TOKEN` or admin session receives all connector credentials.
2. **No SSRF protection** on `server_url` — admin can point MCP servers at internal endpoints.
3. **Audit log insert RLS policy `WITH CHECK (true)`** allows any authenticated client to insert arbitrary audit rows.
4. **No health-check subsystem** — no scheduled/on-demand health status; last_error text only.
5. **Empty tool allowlist defaults to all tools** — permissive default.
6. **No uniqueness constraint** preventing duplicate installations of same catalog entry per scope/department.
7. **In-memory rate limiter** resets on cold start; not distributed.
8. **MCP connection cache has no TTL/eviction**.
9. **Manifest token comparison is not constant-time**.
10. **Test coverage is partial**: only route entry point (mocked) and tool-bridge guard chain are tested; service CRUD, MCP client, crypto, UI, schema, RLS are untested.

## 2. Architecture & data flow

```
browser (admin)
  → apps/portal/app/admin/page.tsx (server: role === 'admin')
  → IntegrationsTab → IntegrationManager (client)
      fetch /api/integrations
  → route.ts handleGetIntegrations → listCatalog/listInstallations (service-role)
  → integration_catalog / integration_installations (RLS)
install:
  POST /api/integrations → installIntegration (service)
    → upsert catalog row (if new_entry)
    → insert installation
    → encrypt secret → integration_credentials
    → refreshTools (MCP tools/list) → tool_cache
invoke:
  tool-bridge.invokeIntegrationTool
    → parse name, listActiveMcpIntegrations, findActiveForTool, risk class, rate limit
    → mcp-client-manager (streamable HTTP, cached connection)
    → writeAuditLog (args SHA-256 digest)
```

Key files:

- `apps/portal/features/integrations/components/IntegrationManager.tsx`
- `apps/portal/features/integrations/components/IntegrationWebhookLogsPanel.tsx`
- `apps/portal/features/admin/tabs/IntegrationsTab.tsx`
- `apps/portal/app/api/integrations/route.ts`, `[id]/route.ts`, `[id]/test/route.ts`, `[id]/tools/route.ts`, `manifest/route.ts`
- `apps/portal/lib/integrations/service.ts`, `mcp-client-manager.ts`, `tool-bridge.ts`, `crypto.ts`
- `packages/contract/src/schemas/integration.schema.ts`
- `packages/database/migrations/168_integration_platform.sql`, `186_integration_sentry_seed.sql`, `188_expand_integration_catalog.sql`
- `documentation/integrations-platform.md`, `docs/operations/fuxa-integration-plan.md`

## 3. Existing integrations and their actual capabilities

### Curated catalog (20 entries, `CURATED_INTEGRATION_CATALOG` in `service.ts:54-396` + DB seeds 186/188)

| #   | ID                       | Kind   | Auth    | Verified | Key domains                                                                         |
| --- | ------------------------ | ------ | ------- | -------- | ----------------------------------------------------------------------------------- |
| 1   | sentry                   | mcp    | bearer  | yes      | errors, releases, performance                                                       |
| 2   | supabase-mcp             | mcp    | bearer  | yes      | database, rls-audit, migrations, postgrest-logs                                     |
| 3   | vercel-mcp               | mcp    | bearer  | yes      | deployments, runtime-logs, web-vitals, edge-cache                                   |
| 4   | cloudflare-observability | mcp    | bearer  | yes      | edge, waf, logs, dns                                                                |
| 5   | upstash-redis            | mcp    | bearer  | yes      | redis, queues, ratelimit                                                            |
| 6   | linear                   | mcp    | bearer  | yes      | issues, projects, incidents                                                         |
| 7   | github-mcp               | mcp    | bearer  | yes      | repos, pull_requests, actions, security                                             |
| 8   | grafana-mcp              | mcp    | bearer  | yes      | prometheus, loki-logs, alert-rules, dashboards                                      |
| 9   | slack-incident-mcp       | mcp    | bearer  | yes      | incident-paging, shift-handover, channel-alerts                                     |
| 10  | postgres-analytics-mcp   | mcp    | bearer  | yes      | read-only-sql, query-plan, production-rollups                                       |
| 11  | sixtyfour-intelligence   | mcp    | api_key | yes      | enrichment, intelligence                                                            |
| 12  | windsor-ai               | mcp    | api_key | yes      | analytics, attribution, reporting                                                   |
| 13  | firecrawl-lan-mcp        | mcp    | none    | yes      | oem-manuals, dmre-compliance, web-extraction (LAN 192.168.0.215)                    |
| 14  | nestjs-scada-proxy       | action | bearer  | yes      | modbus-tcp, pit-viper-351, plc-registers, scada-ingest                              |
| 15  | n8n-workflow-engine      | action | api_key | yes      | workflow-triggers, shift-pdf-dispatch, breakdown-escalation                         |
| 16  | whatsapp-shift-dispatch  | action | bearer  | yes      | whatsapp-dispatch, muster-alerts, shift-handover                                    |
| 17  | rust-telemetry-engine    | native | none    | yes      | telemetry-ingest, sub-ms-pipeline, rust-ffi (hooks: onLogCreated, onBreakdownAdded) |
| 18  | langfuse-openrouter-ai   | native | api_key | yes      | llm-tracing, zar-cost-attribution, prompt-cache, model-routing                      |
| 19  | c66-cr80-hardware-bridge | native | none    | yes      | c66-key-interlock, cr80-300dpi-print, rfid-qr-verify                                |
| 20  | fleet-smr-reconciler     | native | none    | yes      | smr-meter-sync, bin-factor-audit, shift-rollover (hooks)                            |

### Other integration-related implementations in repo

- Native plugin framework: `apps/portal/lib/plugins/types.ts` (ArchPlugin), `orchestrator.ts`, `consumers.ts`; plugins under `apps/portal/plugins/*`; widgets consumed by hub page.
- WhatsApp split-screen workspace: control-room shift compilation (referenced by whatsapp-shift-dispatch action).
- FUXA integration plan: `docs/operations/fuxa-integration-plan.md` (industrial connectivity plan; verify availability before implementing).
- Power BI: no dedicated route found in portal in this checkout; target Tier 3 reuses existing plan if present — none verified.
- Webhooks: WhatsApp dispatch action uses webhook transport; no standalone webhook marketplace item.
- Observability: Sentry/Cloudflare/Vercel/Grafana catalog entries; OpenTelemetry not yet a catalog entry (doc references existing telemetry pipeline).
- Docs: `documentation/integrations-platform.md` describes platform model, API surface, native plugins, dev-agent sync, security notes.

### Capabilities summary

- All catalog entries are `verified: true`.
- Transport: streamable-HTTP MCP for mcp kind; in-process native for native kind; HTTP action endpoints for action kind.
- Risk class default set at install time (`read` for mcp/native, `write` for action).
- No version field, publisher verification beyond `verified` boolean, no health status field.

## 4. Route, component, API, database and migration inventory

### API routes

- `GET /api/integrations` — list catalog + visible installations.
- `POST /api/integrations` — admin install; validates `installIntegrationSchema`; body limit 262144; rate limit.
- `GET /api/integrations/[id]` — installation + audit logs (admin only logs); `canView` scope filter.
- `PATCH /api/integrations/[id]` — admin update status/config/allowlist.
- `DELETE /api/integrations/[id]` — admin remove.
- `POST /api/integrations/[id]/test` — admin tool invocation (forces write risk class).
- `POST /api/integrations/[id]/tools` — admin refresh tool discovery.
- `GET /api/integrations/manifest` — admin OR `INTEGRATIONS_MANIFEST_TOKEN`.

### UI

- `IntegrationManager` (client) — header, install form (custom + configured), installed list (via `IntegrationWebhookLogsPanel`), catalog marketplace (via `IntegrationCatalogMarketplace`).
- `IntegrationsTab` — pass-through.

### DB tables (migration 168)

See §5.

### Migrations

- 168 (platform), 186 (Sentry seed), 188 (expand catalog to 20). No later integration migrations. No down migrations. Seeds use upsert (idempotent).

## 5. Permissions and secrets security assessment

### Database

- All 4 tables RLS enabled.
- Catalog: signed-in read; admins ALL.
- Installations: admins ALL; employees SELECT scoped by department/`accessible_departments`.
- Credentials: `SELECT USING (false)` only; no INSERT/UPDATE/DELETE policies → service-role only (implicit).
- Audit logs: admins SELECT; `INSERT WITH CHECK (true)` — overly permissive; any authenticated user can insert.
- Gaps: `invoked_by`, `installed_by` not FK to employees; no unique constraint on duplicate installations per scope/dept; no index on `(installation_id, created_at)`.

### Secrets

- AES-256-GCM app-side (`crypto.ts`), scrypt key from `INTEGRATION_ENCRYPTION_KEY` (min 16 chars), fixed salt `arch-integrations-v1`, fresh IV per encryption. DB stores ciphertext only. Good.
- Key cached in module-level `cachedKey`.
- **Critical:** `manifest/route.ts` decrypts and returns plaintext secrets in JSON response (lines ~61-88) — high risk.
- Secret input is `type="password"` in UI; value held in client state during form; not displayed after install. Test result `<pre>` may expose tool output (possibly sensitive).

### Authorization

- Admin gating at `admin/page.tsx` server component; integration UI only under admin tab. No client-side role guard inside component (relies on page).
- Routes use `getAuthenticatedEmployee`; admin checks `role !== 'admin'`.
- Manifest token comparison uses `===` (not constant-time) — minor timing leak.
- Empty tool allowlist = all tools permitted (`tool-bridge.ts:108`) — permissive default.
- `config` uses `.passthrough()` allowing arbitrary keys.

### SSRF / egress

- `server_url` validated as URL in schema but no allowlist/private-IP blocking. Admin can target internal addresses (SSRF). `new URL(installation.serverUrl)` used directly in MCP client.

### Tool invocation guard chain

- Parse qualified name → list active → find active for tool (slug + dept scope + allowlist) → risk class (write requires confirmed) → in-memory rate limit (30/60s) → call → audit (args SHA-256 digest only). Args not validated against tool `inputSchema`.

## 6. Existing test coverage and reproducible verification results

**Executed verification (2026-10-26):**

- Command: `pnpm --filter portal test -- --testPathPatterns="integrations|tool-bridge"`
- Exit status: 0 (PASS)
- Result: 2 test suites, 16 tests passed, 0 failed, 0 snapshots.
  - `apps/portal/app/api/integrations/route.test.ts` (GET/POST auth & validation, mocked service)
  - `apps/portal/lib/integrations/tool-bridge.test.ts` (malformed names, happy path + audit, allowlist denial, write-class denial/confirmation, department scope, tool errors, rate limit, listEmployeeTools)

**Coverage assessment (accurate):**

- `service.ts`, `mcp-client-manager.ts`, `crypto.ts` — **no unit tests**.
- API routes `[id]`, `[id]/test`, `[id]/tools`, `manifest` — **no tests**.
- UI components (`IntegrationManager`, `IntegrationWebhookLogsPanel`) — **no tests**.
- Contract schema `integration.schema.ts` — **no tests**.
- DB migrations / RLS — **no tests**.
- E2E — no specs mention "integration".

So coverage exists only for the route entry point (mocked) and the tool-bridge guard chain; the rest of the platform (service CRUD, MCP client, crypto, UI, schema, RLS) is untested.

Commands available: `pnpm --filter portal test`, `pnpm --filter portal test:integration` (Redis only), `pnpm --filter portal type-check`, `pnpm --filter portal lint`, `pnpm test:e2e`.

## 7. Gaps (classified)

### Critical

- Manifest endpoint exposes decrypted secrets in plaintext JSON.
- Audit log insert RLS `WITH CHECK (true)` allows arbitrary inserts by any authenticated user.
- No SSRF protection on `server_url`.

### High

- Test coverage limited to route entry point (mocked) and tool-bridge guard chain; service, MCP client, crypto, UI, schema, RLS untested.
- No health-check subsystem / meaningful health status.
- Empty allowlist defaults to all tools.
- No uniqueness constraint on duplicate installations per scope/department.
- `invoked_by`/`installed_by` not FK to employees.
- In-memory rate limiter (not distributed, resets on cold start).
- MCP connection cache no TTL/eviction.

### Medium

- Manifest token comparison not constant-time.
- Args not validated against tool inputSchema.
- `id` param not validated as UUID in routes (relies on DB error).
- `config` passthrough allows arbitrary keys.
- No OAuth flow UI despite `oauth2` auth type.
- No credential rotation/reveal UI.
- No loading skeletons / empty filtered state in UI.
- Test tool uses shared global state across installations (state leakage).
- Status toggle only pending/disabled; cannot mark active/error manually.

### Low

- No pagination/search server-side; client-filtered.
- No marketplace ratings/reviews/versioning/changelog.
- No index on `(installation_id, created_at)`.
- Catalog `capabilities` untyped beyond `[key: string]: unknown`.

## 8. Recommended target architecture

Preserve existing 4-table model; add only where documented insufficient:

- **Catalogue**: add `version`, `publisher_verified`, `health_status` (or separate health table), `last_health_check_at`.
- **Installation registry**: add unique constraint `(catalog_id, scope, department_id)`; add `version_installed`, `update_available`.
- **Configuration**: keep `config` JSONB but validate via Zod; consider allowlisted keys.
- **Credential provider**: keep AES-256-GCM; add key rotation procedure; never expose via manifest (replace with env-var reference + out-of-band secret delivery).
- **Integration adapters**: provider-specific (Grafana/Prometheus first) as server-side modules, not arbitrary code in request handlers.
- **Execution runtime**: keep MCP streamable-HTTP only; no stdio in serverless.
- **Policy engine**: server-side RBAC + department scope; tool allowlist default should be explicit (empty = none OR all documented; recommend explicit).
- **Health service**: on-demand + scheduled bounded checks; application-level validation, not just TCP.
- **Audit service**: keep digest-only args; restrict insert to service role.
- **Approval workflow**: add `pending_approval`/`approved` states if required by target (current status enum lacks approval states).
- **UI**: marketplace discovery, install wizard, health centre, audit trail.

## 9. Proposed implementation plan, file-level changes and dependencies

### Phase 2 (after approval) — concrete file-level changes

**Security hardening**

- `apps/portal/app/api/integrations/manifest/route.ts`: remove decrypted secret emission; return env-var references only; use `crypto.timingSafeEqual` for token compare.
- `apps/portal/lib/integrations/mcp-client-manager.ts`: add SSRF guard (reject private/loopback/link-local IPs, validate redirects) before `new URL`.
- `packages/database/migrations/NNN_integration_rls_hardening.sql`: restrict `integration_audit_logs` INSERT to service role (drop `WITH CHECK (true)` policy); add FKs for `invoked_by`/`installed_by`; add unique constraint `(catalog_id, scope, department_id)`.
- `apps/portal/lib/integrations/service.ts`: change empty allowlist default to explicit (document); validate `config` keys.

**Test coverage**

- `apps/portal/lib/integrations/crypto.test.ts` (new): encrypt/decrypt round-trip, tamper detection, missing key.
- `apps/portal/lib/integrations/service.test.ts` (new): CRUD, scope visibility, install idempotency.
- `apps/portal/app/api/integrations/[id]/route.test.ts` (new), `[id]/test/route.test.ts`, `[id]/tools/route.test.ts`, `manifest/route.test.ts`.
- `apps/portal/features/integrations/components/IntegrationManager.test.tsx` (new).
- `packages/contract/src/schemas/integration.schema.test.ts` (new).

**Health subsystem**

- `apps/portal/app/api/integrations/[id]/health/route.ts` (new): on-demand bounded application-level check.
- `apps/portal/lib/integrations/health.ts` (new): provider-agnostic health check helpers.
- UI: health badge + last check + latency in `IntegrationWebhookLogsPanel`.

**Grafana + Prometheus path**

- `apps/portal/lib/integrations/adapters/grafana.ts` (new): allowlisted metrics queries, bounded timeouts, health check.
- `apps/portal/lib/integrations/adapters/prometheus.ts` (new): read-only query with allowlist + timeout.
- Catalog entries already present (`grafana-mcp`); add adapter wiring in tool-bridge for native provider calls.

**Marketplace UX**

- `IntegrationManager.tsx` / `IntegrationWebhookLogsPanel.tsx`: loading skeletons, empty filtered state, accessibility (aria-pressed, aria-label search), credential rotation UI, status transitions including active/error.

**Migrations & docs**

- Add backward-compatible migrations; document rollback/forward-recovery in this plan.
- Update `documentation/integrations-platform.md` with health, SSRF, manifest changes.

Dependencies: `INTEGRATION_ENCRYPTION_KEY` in all envs; Grafana/Prometheus test instances for adapter verification; Entra ID app registration if OAuth added (deferred).

## 10. Rollback, migration and deployment strategy

- Migrations are additive (CREATE TABLE/INSERT upsert). Rollback = reverse migration (drop tables) — destructive; prefer forward-recovery.
- Seed migrations idempotent via `ON CONFLICT ... DO UPDATE`.
- RLS changes require careful testing; run `pnpm audit:drift` + `pnpm lint:migrations`.
- Deploy via canonical Vercel project `arch-system` after staging verification.
- Keep feature branch/worktree per repo policy; no direct push to main.

## 11. Risks, unresolved questions & required external services

- Real Grafana/Prometheus/Loki instances availability unknown — verify before implementing adapters.
- Plant endpoints (MQTT/OPC UA/Modbus) require gateway verification; implement config/diagnostics only if unavailable.
- OAuth2 flow requires Entra ID app registration (not yet verified).
- `INTEGRATION_ENCRYPTION_KEY` must be present in all environments; rotation procedure TBD.
- Vercel serverless cannot reach private plant endpoints — keep cloud portal separate from plant networks.
- Manifest consumers (`scripts/sync-integrations-mcp.mjs`) depend on plaintext secrets — must be reworked to use env references.

## 12. Prioritized acceptance-test matrix

| Priority | Test                                                      | Expected                                  |
| -------- | --------------------------------------------------------- | ----------------------------------------- |
| P0       | Manifest endpoint does not return plaintext secrets       | Response contains only env-var references |
| P0       | Non-admin cannot install/update/delete                    | 403                                       |
| P0       | SSRF: server_url pointing to private IP rejected          | 400                                       |
| P0       | Audit log insert restricted to service role               | user-scoped insert fails                  |
| P1       | Crypto encrypt/decrypt round-trip + tamper detection      | pass                                      |
| P1       | Installation CRUD + scope visibility                      | pass                                      |
| P1       | Tool invocation guard chain (allowlist, risk, rate limit) | pass                                      |
| P1       | Health check reports failure + stale data                 | pass                                      |
| P2       | Grafana/Prometheus connectivity against test instance     | pass or documented blocker                |
| P2       | UI accessibility (keyboard, screen reader)                | pass                                      |
| P2       | Migration backward compatibility                          | pass                                      |

---

**STOP — Phase 1 complete. Awaiting explicit approval before Phase 2 implementation.**
