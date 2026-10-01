# Integration Platform (Plugins · MCP Connectors · Actions)

One registry, three plugin kinds, all managed from **Admin → Integrations**:

| Kind     | What it is                                                                                                                                                   | Status                 |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------- |
| `mcp`    | Remote **streamable-HTTP MCP servers** — third-party connectors in the same mould as ChatGPT Apps SDK apps (WorkOS-authed servers, SixtyFour, Windsor AI, …) | **Live (MVP)**         |
| `native` | First-party in-process `ArchPlugin` modules in `apps/portal/plugins/*` (engine + hooks + widgets)                                                            | **Live (MVP)**         |
| `action` | Authenticated HTTP action endpoints callable from n8n / Kestra / Inngest                                                                                     | Reserved (later phase) |

MCP is the universal protocol: any server that speaks streamable-HTTP MCP can be
installed, which covers the bulk of the connector ecosystem including apps built
for the OpenAI Apps SDK.

## Data model (`packages/database/migrations/168_integration_platform.sql`)

- **`integration_catalog`** — admin-curated registry of installable connectors
  (slug PK, kind, `server_url`, `auth_type`, verified flag).
- **`integration_installations`** — a catalog entry installed `global`- or
  `department`-scoped. Holds non-secret `config` (`risk_class`, `api_key_header`,
  `request_timeout_ms`), a `tool_allowlist` (empty = all tools), the MCP
  `tool_cache` from the last `tools/list`, and `status`
  (`pending|active|error|disabled`).
- **`integration_credentials`** — secrets encrypted **application-side**
  (AES-256-GCM, key from `INTEGRATION_ENCRYPTION_KEY`; see
  `apps/portal/lib/integrations/crypto.ts`). The DB never sees plaintext or the
  key. RLS denies all user-session access; server code uses the service-role
  client.
- **`integration_audit_logs`** — every tool invocation with a **SHA-256 digest of
  the arguments** (raw args are never persisted), duration, and outcome
  (`success|error|denied`).

RLS: admins manage everything (`employees.role = 'admin'`); other employees can
read the catalog and installations scoped to their department (+ global).

## Request flow

```
Aria assistant / admin test call
        │  tool: integration__<slug>__<tool>          (contract: integration.schema.ts)
        ▼
/api/ai/actions  (kind: read | write)                or /api/integrations/[id]/test (admin)
        ▼
tool-bridge.ts   — allowlist → risk class (write requires human-confirmed 'write' path)
                   → per-employee rate limit → execute → audit log
        ▼
mcp-client-manager.ts — streamable-HTTP MCP client (cached per installation,
                        hard timeout, reconnects after transport errors)
        ▼
Third-party MCP server
```

`write`-classified installations follow the existing Aria confirmation-card
contract: the model only proposes; the confirmed write call is what executes.

## API surface

| Route                                     | Who                                                   | Purpose                                                                                                                      |
| ----------------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/integrations`                   | any employee                                          | Catalog + installations visible to caller                                                                                    |
| `POST /api/integrations`                  | admin                                                 | Install (creates catalog entry inline when `catalog_entry` is provided, stores encrypted secret, probes MCP immediately)     |
| `GET/PATCH/DELETE /api/integrations/[id]` | admin (GET also scoped employees)                     | Detail + audit tail / status, config, allowlist, secret rotation, server URL / uninstall (cascades credentials, keeps audit) |
| `POST /api/integrations/[id]/tools`       | admin                                                 | Re-run MCP `tools/list`, persist to `tool_cache`, set status `active`/`error`                                                |
| `POST /api/integrations/[id]/test`        | admin                                                 | Invoke one tool through the same guard chain                                                                                 |
| `GET /api/integrations/manifest`          | admin session or `INTEGRATIONS_MANIFEST_TOKEN` bearer | Machine-readable manifest for dev coding agents                                                                              |

## Native plugins (first-party)

- Contract: `apps/portal/lib/plugins/types.ts` (`ArchPlugin`: metadata, engine,
  hooks `onLogCreated` / `onBreakdownAdded`, widgets, workflow node).
- Orchestrator: `apps/portal/lib/plugins/orchestrator.ts` (XState machines under
  `lib/plugins/machines/`); loaded plugin names must match
  `apps/portal/plugins/*` directory names (`DEFAULT_PLUGINS` in
  `orchestrator.machine.ts`).
- Consumption points (failure-isolated via `lib/plugins/consumers.ts`):
  - `getPluginWidgets()` → hub page “Plugin Widgets” grid (`app/hub/page.tsx`)
  - `triggerPluginHook('onLogCreated', …)` → `createDailyLog`
    (`app/(departments)/[department]/daily-log/actions.ts`)
  - `triggerPluginHook('onBreakdownAdded', …)` → `createBreakdown` /
    `directCheckout` (`features/departments/components/engineering/breakdowns/actions.ts`)
- Example plugin: `apps/portal/plugins/rust-telemetry-engine` with its API route
  `app/api/plugins/rust-telemetry`.

## Dev coding agents (Claude, GLM, …)

```bash
node scripts/sync-integrations-mcp.mjs
```

Fetches the manifest and idempotently writes managed entries (prefixed
`integration:`) into `.mcp.json`, `.agents/mcp_config.json`, `.vscode/mcp.json`,
and `.junie` / `.repowise` configs when present. Hand-authored server entries are
never touched. Secrets are written **only** to the gitignored `.env.integrations`
and referenced as `${ENV_VAR}` placeholders in header values. Restart your coding
agent afterwards.

## Setup checklist

1. Run migration `168_integration_platform.sql` (`pnpm supabase:push`), then
   regenerate Supabase types (`pnpm supabase:types`) — the checked-in
   `database.types.ts` already carries hand-added matching entries.
2. Set `INTEGRATION_ENCRYPTION_KEY` (≥ 16 chars, e.g. `openssl rand -hex 32`) in
   `apps/portal/.env`. Without it, installs that include a secret fail.
3. Set `INTEGRATIONS_MANIFEST_TOKEN` for the dev-agent sync script.
4. Admin → Integrations → Install: register the connector (name, streamable-HTTP
   MCP URL, auth type + key), choose global/department scope and read/write risk
   class, then “Refresh tool discovery”.

## Roadmap (deferred phases)

- **P3 — OAuth 2.1 connectors**: dynamic client registration + consent flow for
  MCP servers using OAuth (WorkOS AuthKit-style), per-user connectors.
- **P4 — Widget rendering**: third-party MCP Apps UI components in sandboxed
  iframes (per-installation CSP `frame-src` allowlist) alongside first-party
  `PluginWidget`s.
- **P5 — Event subscriptions**: push `breakdown.created` / `daily_log.created`
  to installed servers via the existing Postgres-trigger + outbox + Inngest
  pipeline; MCP notifications bridge.
- **P6 — `action` kind**: per-installation authenticated HTTP endpoints callable
  from n8n / Kestra / Inngest flows.

## Security notes

- Credentials: AES-256-GCM at rest, decrypted only in-process by the MCP client
  manager, never logged, never returned by any API route.
- Audit: arguments SHA-256-digested; every call (success, error, denied) recorded.
- Allowlists + risk classes gate tool execution; `write` tools always require the
  human-confirmed path.
- Rate limits: route-level (`withRateLimit`) + per-employee per-installation
  window in the tool bridge.
- SSRF surface limited by the admin-curated catalog (only admins register server
  URLs); all outbound MCP calls carry hard timeouts.
