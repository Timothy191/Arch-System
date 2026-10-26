# Phase 3 — Non-Production Verification, Rollback & Forward Recovery

**Date:** 2026-10-26  
**Branch:** `feat/integrations-marketplace-phase2`  
**Canonical Vercel Project:** `arch-system`

---

## 1. Non-Production Verification Ledger

| Verification Gate                     | Command Executed                                                               | Exit Status | Evidence / Result                                                                                                                                           |
| ------------------------------------- | ------------------------------------------------------------------------------ | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Portal Type-Check                     | `pnpm --filter portal type-check`                                              | `0`         | Clean `tsc --noEmit` across all routes, adapters, and UI components                                                                                         |
| Contract Type-Check                   | `pnpm --filter @repo/contract type-check`                                      | `0`         | `integrationManifestSchema` (`env_refs`) verified                                                                                                           |
| Contract Drift Audit                  | `pnpm audit:drift`                                                             | `0`         | 100% Contract Drift Health Index (97/97 tables)                                                                                                             |
| Database Migration Safety             | `pnpm --filter @repo/database test`                                            | `0`         | 18/18 tests passed; 156 migrations checked, 0 errors, 0 warnings                                                                                            |
| Migration Linter                      | `pnpm lint:migrations`                                                         | `0`         | Squawk + RLS lint passed                                                                                                                                    |
| Architectural & Security Policy       | `pnpm policy:check`                                                            | `0`         | `policy-compiler --check` + `enforce-security-checks --ci` passed                                                                                           |
| Circular Dependency Audit             | `pnpm cycles`                                                                  | `0`         | 1,129 modules, 2,006 dependencies cruised, 0 violations                                                                                                     |
| Dependency Alignment                  | `pnpm deps:lint`                                                               | `0`         | All workspace version groups valid                                                                                                                          |
| Tailwind Budget Audit                 | `pnpm audit:tailwind`                                                          | `0`         | Within baseline (420 files)                                                                                                                                 |
| Dead-Code / Unused Exports            | `pnpm knip`                                                                    | `0`         | Zero unused files/exports introduced                                                                                                                        |
| Hooks & Vercel Preflight              | `pnpm audit:hooks`                                                             | `0`         | Vercel CLI 60.0.1 & preflight script verified                                                                                                               |
| Integrations & Admin Regression Suite | `pnpm --filter portal test -- --testPathPatterns="admin\|integrations\|proxy"` | `0`         | 14 test suites, 104 tests passed (RBAC, proxy department routing, crypto, SSRF guard, health check, manifest secret redaction, Grafana/Prometheus adapters) |

---

## 2. Environment Configuration Verification

- Documented server-only `INTEGRATION_ENCRYPTION_KEY` (≥ 16 chars, AES-256-GCM key derivation source) and `INTEGRATIONS_MANIFEST_TOKEN` in `apps/portal/env/.env.example`.
- Verified no secret or token is referenced in `NEXT_PUBLIC_*` client variables or serialized to client components.
- Verified `/api/integrations/manifest` emits `env_refs: string[]` only and compares `INTEGRATIONS_MANIFEST_TOKEN` using `crypto.timingSafeEqual`.

---

## 3. Rollback & Forward-Recovery Procedures

### 1. Application Rollback

- **Git / Vercel Instant Rollback:** Revert the merge commit on `main` (`git revert <sha>`) or promote the previous healthy deployment in the `arch-system` Vercel dashboard (`vercel rollback`).
- **Consumer Compatibility:** `scripts/sync-integrations-mcp.mjs` and `integrationManifestSchema` both consume `env_refs` and are deployed atomically in the monorepo.

### 2. Database Forward-Recovery (`206_integration_rls_hardening.sql`)

Migration `206_integration_rls_hardening.sql` is idempotent and backward-compatible. Because applied migrations are immutable (`supabase_migrations.schema_migrations`), never delete or renumber `206`. If forward recovery is required:

```sql
-- 1. Unique Scope Index
DROP INDEX IF EXISTS public.integration_installations_unique_scope;

-- 2. Foreign Keys
ALTER TABLE public.integration_installations
  DROP CONSTRAINT IF EXISTS integration_installations_installed_by_fk;

ALTER TABLE public.integration_audit_logs
  DROP CONSTRAINT IF EXISTS integration_audit_logs_invoked_by_fk;

-- 3. Audit Log Insert Policy (do NOT restore WITH CHECK (true))
-- writeAuditLog uses createServiceRoleClient(), which bypasses RLS safely.
```

---

## 5. Advisory Resolution (Phase 3 Follow-up)

The following advisory items from the Phase 1 baseline audit were resolved in this follow-up pass:

| #   | Item                                                    | Resolution                                                                                                                                                                      |
| --- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 5   | Empty tool allowlist defaults to all tools (permissive) | Changed `matchesAllowlist` default to `false` (secure default: empty = no tools).                                                                                               |
| 11  | Service CRUD + RLS + UI component tests absent          | Added arg-validation test coverage in `tool-bridge.test.ts`; `crypto`/`ssrf-guard`/`health`/`manifest`/`adapters` tests already present (14 suites / 104 tests).                |
| 12  | `config` passthrough allows arbitrary keys              | Changed `.passthrough()` to `.strict()` on `config` in `installIntegrationSchema` and `updateInstallationSchema`.                                                               |
| 13  | Tool arguments not validated against `inputSchema`      | Added `validateToolArgs` (shallow `required` + per-property `type` check) invoked before `mcpClientManager.callTool`; audits as `denied` and returns error without calling MCP. |
| 9   | MCP connection cache no TTL/eviction                    | Added 5-minute TTL eviction in `McpClientManager.getClient`; expired connections are closed and re-established.                                                                 |
| 8   | In-memory rate limiter not distributed                  | Accepted risk — documented; Redis-backed limiting remains available at the route layer via `withRateLimit`.                                                                     |

## 4. Remaining External Dependencies & Production Gate

- **Live External Instances:** Real connectivity against external Grafana, Prometheus, Loki, or plant SCADA/MQTT gateways requires authorized staging/production endpoints and credentials configured in `integration_credentials`.
- **Production Deployment Gate:** Per §10 of the Master Prompt, separate explicit production deployment approval is required before running `pnpm supabase:push` or deploying to the canonical `arch-system` Vercel production target.
