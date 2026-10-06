# Control Room Permanent Remediation Plan

## Goal

Close the remaining Control Room security, data-integrity, and health-reporting gaps so the feature can be considered operationally ready. Preserve the existing shared-fleet behavior and idempotent shift-closeout contract. Do not apply database changes until the required human review is complete.

## Execution status

The user approved implementation after plan review. Migrations 169, 170, and 173 and their rollback-backed RPC test were exercised against the local Supabase stack, but this did not update its migration ledger: direct read-only SQL shows local `schema_migrations` ends at 164 while the closeout/split RPCs exist in the schema. This local schema was modified outside the tracked migration ledger and is not proof of a clean migration replay. Earlier deployment notes also conflict: one says the linked history ended at 164, another says migration 166 is applied. `packages/database/supabase/config.toml` has now been initialized. Supabase CLI login/link are still blocked because no access token is present and interactive login cannot be completed from this runtime. The Postgres MCP launcher now consumes `SUPABASE_DATABASE_URL` from the host environment; its live connection remains unverified.

The user pasted database credentials and a Supabase secret key into the conversation. Treat them as compromised: do not reuse/store them; rotate the database password and revoke/rotate the exposed secret key before connecting. Set the rotated, URL-encoded connection string in the local MCP host environment and restart/reload the MCP server. Target migration history beyond 164 remains unverified.

Migration 166's index target is confirmed absent from the current local schema (`to_regclass('public.smr_latest_tenant_meter')` is null). The committed migration 165 also does not create it: 165 creates `smr_readings` and a materialized view named `smr_latest` with a unique `(tenant_id, meter_id)` index, while 166 targets the different relation `smr_latest_tenant_meter` and columns `(tenant_id, meter_type, recorded_at)`. This confirms the bootstrap mismatch in the checked-in migration history. Do not edit migration 166 because its hosted application state is unknown and earlier reports conflict. Supabase CLI linking/type generation still needs owner authentication. Generated `database.types.ts` still lacks the new RPCs; no hand-edited generated type or incomplete local regeneration was substituted.

At the user's request, 212 path-level worktree changes were staged, including source/config/docs additions, modifications, and deletions; no commit was created. Nine machine-generated index/state files under `.code-index/`, `.codemap/`, `.autohand/`, `.ori/`, and `packages/redis/.code-index/` were deliberately excluded. The full staged whitespace check reports trailing whitespace in archived material and a few modified files; these were not mass-edited as part of staging.

The 2026-10-06 rollout follow-up fixed the current Vercel preflight linkage (0 warnings) and the production dependency blockers found during a fresh audit. The production dependency audit now has zero high/critical findings; one moderate `sprintf-js` advisory has no published fix, and one high `braces` advisory is confined to non-production tooling. The audit runner now uses the report's actual severities rather than treating pnpm's nonzero JSON-audit exit for moderate findings as a high/critical blocker. The eight OpenTelemetry instrumentation findings were resolved by pinning the transitive bundle to its fixed `0.80.0` release.

Vercel project `arch-system` has a Ready production deployment from 2026-10-05 12:41. Its live Realtime endpoint reports `healthy`, but the deployed source still returns a constant healthy value; this is not proof that Realtime is reachable. The worktree's truthful WebSocket probe has not been deployed. Production grants, migration application, generated-type synchronization, migration-166 bootstrap repair, and deployed health-probe verification remain rollout gates.

The archive false-positive is fixed in the agentic auditor. `.agents/skills/.archived` is excluded from active skill discovery; active folders missing `SKILL.md` remain reportable. Three regression assertions pass, and the auditor reports 52 active skills with zero critical violations. A full `pnpm quality` run exits 0 (audit log 139 reports WARN, not a clean audit). That run emits the repository’s legacy migration warnings and explicit non-blocking dependency advisories. A separate production portal build initially found Next.js 16 rejects the Realtime route's redundant `runtime = 'nodejs'` segment setting while Cache Components are enabled. Removing that setting relies on Next's default Node runtime; the portal production build now passes, including all route compilation and type checking.

## 2026-10-06 Follow-up: Core Issue and Revised Plan

### Root cause of the current full-quality failure

`pnpm quality` reached the Agentic Content Audit and failed on exactly one critical finding: `.agents/skills/.archived` was reported as `MISSING_SKILL_MD`. This is a false positive in `tools/audits/audit-agentic-content.cjs`: its skill scan increments and validates every immediate directory returned by `fs.readdirSync()`, without distinguishing active skills from the hidden archive directory.

The archive is intentional repository state, not a malformed skill. `tools/scripts/context-debloat.cjs::archiveSkill()` moves retired skills into `.agents/skills/.archived/<skill-name>`. The repository’s skill registry also separately describes active skill selection. Therefore the core issue is a mismatch between the archive convention and the auditor's directory-discovery rule—not missing skill documentation or a Control Room regression.

### Proven fix options and selection

1. **Add a placeholder `SKILL.md` under `.archived`** — rejected. This would misrepresent the archive container as an activatable skill and conceal the discovery bug.
2. **Move the archive outside `.agents/skills`** — valid only as a coordinated migration. It changes the established cleanup destination and related consumers, increasing scope and risking unrelated archive paths.
3. **Exclude reserved hidden/archive directories from active-skill discovery and test the rule** — selected. Keep validating every active top-level skill directory for its required `SKILL.md` and frontmatter, but do not classify dot-prefixed archive containers as active skills. Add regression coverage proving `.archived` is ignored while an active folder without `SKILL.md` still fails. Do not blindly filter all missing files or suppress the violation type.

This selection follows the official [Agent Skills specification](https://agentskills.io/specification), which defines a skill as a directory containing `SKILL.md`, and matches the repo's existing `archiveSkill()` implementation. The Firecrawl developer-index request timed out; no claims from it are relied upon.

### Revised execution order

1. **Fix and test the false-positive audit** — DONE. `tools/audits/active-skill-directories.cjs` excludes hidden archive containers; three regression tests cover archive, active malformed directories, and non-directory entries. The auditor passes with 52 active skills.
2. **Rerun `pnpm quality` end-to-end** — DONE. Full gate exits 0; audit log 139 records WARN for remaining lower/non-production dependency advisories. `pnpm agent:verify`, database checks, Vercel preflight, focused Control Room/Realtime tests (42 tests), and portal production build pass.
3. **Resolve target migration history before rollout** — BLOCKED by access. Current local history ends at 164, but target evidence conflicts at 164 vs 166. CLI login/link cannot complete without owner authentication; Postgres MCP requires the rotated password configured locally. The Vercel project has production DB environment entries, but the read-only pull returned redacted placeholders, so no connection was attempted with those values. Complete authenticated project linking and an approved read-only history check; do not apply migrations until the ledger and migration-166 history are reconciled.
4. **Repair the migration-166 bootstrap defect** — BLOCKED pending database owner review. `166_harden_legacy_migrations.sql` unconditionally indexes `smr_latest_tenant_meter`, which is absent locally and has no earlier checked-in creator. Migration 166 may already be applied; do not edit it or fabricate that table. Review a forward-only/bootstrap-safe repair against the actual target schema.
5. **Synchronize generated RPC types from a reviewed schema** — BLOCKED by auth. `database.types.ts` omits the new RPC signatures; the official generator needs the authenticated target link. Complete CLI login/link and review the schema before generation; do not hand-edit generated output.
6. **Run target acceptance tests and prepare a narrow release** only after the database gates. Verify grants, closeout idempotency, split rollback, and Realtime status. The worktree has many unrelated changes, so do not deploy it wholesale.
7. **Deploy only after gates 1–6.** Vercel `arch-system` inspection and preflight pass, but the live Realtime `healthy` result is from the previous hard-coded handler; verify deployed source/behavior after the truthful WebSocket probe is included.

### Current gate status

| Gate | Evidence | Status |
|---|---|---|
| Root cause and audit regression | Three tests; agentic audit scans 52 active skills, 0 critical violations | Fixed and verified |
| Vercel linkage/preflight | Project inspected; preflight has 0 warnings | Pass |
| Production dependency high/critical audit | `pnpm audit --prod --audit-level=high`: no high/critical findings | Pass with one moderate `sprintf-js` advisory; no patched version reported |
| Full audit suite | `pnpm quality`, audit log `139(26-10-06)` | Quality command passes; audit status WARN for one moderate production and one high non-production advisory |
| Full repository quality | `pnpm quality` | Pass; historical migration warnings and explicit audit warnings remain |
| Agent verification | Previously passed 100%; latest run stops at workspace lint for `packages/utils/src/openrouter.ts` formatting, unrelated to this MCP configuration change | Current rerun blocked |
| Supabase MCP registration | Corrected project ref; password comes from `SUPABASE_DB_PASSWORD`; `pnpm mcp:verify` | Registration passes; live DB connection not verified (no password/auth) |
| Portal production build | `pnpm --filter portal build` after route config correction | Pass |
| Database unit/static migration checks | `pnpm --filter @repo/database test` | Pass, 92 legacy migration warnings |
| Focused Control Room/health tests | 5 suites, 42 tests | Pass |
| Hosted migration/grants | Supabase CLI linked check requires access token/project link; corrected MCP endpoint lacks DB password; Vercel-pulled production DB values are redacted in this runtime; local history ends at 164 | Blocked / unverified |
| Migration 166 bootstrap | Committed 165 creates `smr_latest (tenant_id, meter_id)` but not `smr_latest_tenant_meter`; 166 indexes the distinct absent relation/columns | Blocked pending hosted history verification and owner-reviewed clean-bootstrap/forward-only repair |
| Canonical RPC types | Generated types omit RPCs; official `supabase gen types --project-id` needs CLI authentication; CLI link/login lacks access token | Blocked / unverified |
| Production Realtime health | HTTP 200 reports healthy, but deployed code is hard-coded healthy | Not verified; probe is not deployed |

## Current evidence and scope

The preceding audit verified these findings:

1. `public.atomic_shift_closeout` is `SECURITY DEFINER`, trusts caller-supplied user, employee, and department IDs, and has no in-function authorization check. Local database metadata showed execution available to `anon` and `authenticated`. Production grants have not yet been independently verified.
2. `splitMachineHourlyLoad` updates/locks existing hourly-load rows and inserts a replacement segment in separate requests. A failure between requests can leave partial state.
3. `/api/health/supabase-realtime` returns a constant healthy result instead of measuring Realtime availability.

Existing API-layer checks and safe SCADA/hourly-load fixes are already in place. Keep unrelated worktree changes untouched. The audit agents previously requested timed out and did not provide findings.

## Required approvals and safety constraints

- Obtain human review and explicit approval before changing database schema, function privileges, RLS, or authentication behavior.
- Confirm production function grants and effective runtime roles through an approved read-only check before claiming the RPC finding exists in production or declaring it resolved.
- Create forward-only migrations using the next available migration number. Never edit an already-applied migration.
- Keep all writes to a split operation inside one database transaction. Preserve existing row scoping and the centrally shared fleet model; machine ownership department is not necessarily the shift department.
- Do not expose service credentials, database errors, or sensitive operational data in health responses or logs.
- If approval or production access is unavailable, stop at the approval gate and report the remaining blocker clearly.
- Never rewrite migration 166: the latest database tracer reports it is applied, but it unconditionally creates an index on `smr_latest_tenant_meter`, which no earlier checked-in migration creates. A clean bootstrap therefore needs a separately reviewed, history-safe repair; do not mask this by adding a later migration that cannot run before 166.
- The local database's migration ledger ending at 164 does not mean later migrations were applied: the closeout/split functions are present despite versions 169/170/173 being absent from that ledger, consistent with direct SQL testing. Do not use that database as a migration replay proof.
- The worktree is broadly dirty and includes unrelated pending changes. Do not deploy it wholesale; deploy only a reviewed, committed release after database history, RPC types/grants, and the realtime health route are reconciled.

## Execution phases

### Phase 1 — Confirm production facts and finalize database design

1. Inspect the current employee/access schema, `atomic_shift_closeout` callers, migration history, RLS policies, grants, and the exact hourly-load split semantics.
2. With approved read-only access, verify production `EXECUTE` grants and function definition without printing secrets.
3. Document the caller identity source and department authorization rule used by the database. Confirm whether the application invokes closeout RPCs using the end-user session or any privileged client.
4. Define acceptance cases for idempotency, authorization failures, replay/conflict behavior, load-row locking, and rollback.
5. Present the migration design and rollback approach for human review. Do not begin database mutations until approval.

**Gate:** the database authorization model, intended function grants, and migration plan are reviewed and approved.

### Phase 2 — Secure atomic shift closeout

1. Add a new migration that replaces the closeout function without changing an already-applied migration.
2. Derive or verify the authenticated user from the database caller context. Reject mismatches between the caller and supplied user/employee identifiers; enforce the approved role and department-access rules in the function itself rather than relying only on the API.
3. Validate any caller-controlled route/idempotency inputs against the intended closeout operation and preserve existing same-request replay and conflicting-request behavior.
4. Revoke function execution from `PUBLIC` and `anon`; grant only the minimum required role after confirming the actual invocation path. Retain a locked-down `search_path` and fully qualified object references.
5. Add database-level tests for unauthenticated/anonymous access, identity spoofing, unauthorized department, permitted closeout, idempotent replay, conflicting replay, and rollback on failed writes.
6. Update the API tests only as needed to ensure the caller context is preserved and failures remain explicit.

**Acceptance:** untrusted roles cannot execute the RPC; authenticated users cannot spoof user/employee/department identity; authorized closeout remains atomic and idempotent.

### Phase 3 — Make hourly-load segment splitting transactional

1. Add a database RPC that performs the current split operation as one transaction. Lock the intended prior row(s), verify the expected scope, close the previous segment, and insert the new segment within that same call. Ensure the unapplied prerequisite migration removes only locally-defined unique constraints; inherited partition constraints must be removed from their parent.
2. Preserve current behavior for a specified `previousLoadId` and for the existing no-ID path. Verify each path’s intended row count and prevent accidental broad updates outside department, machine, date, and shift.
3. Validate the active machine without incorrectly requiring its fleet-owner department to equal the Control Room department.
4. Choose the least-privileged function security mode compatible with required writes and enforce caller authorization inside the database if elevated privileges are necessary.
5. Replace the action’s sequential service-client writes with the single RPC call; surface not-found, scope mismatch, and database errors rather than returning success-shaped responses.
6. Add database-backed tests for successful split, unauthorized scope, missing/inactive machine, missing prior row, duplicate/concurrent split behavior, and forced insert failure proving the earlier segment update rolls back.

**Acceptance:** either every intended split mutation commits, or none do. No failure can leave an old segment locked without its replacement.

### Phase 4 — Implement truthful Supabase Realtime health reporting

1. Determine the supported Realtime readiness probe for the configured Supabase deployment and local stack; do not assume a Postgres health check proves Realtime is serving.
2. Implement a bounded, server-side probe with explicit timeout and a truthful `healthy`/`degraded`/`offline` response. Keep API responses free of credentials and avoid logging tokens or sensitive payloads.
3. Distinguish missing configuration, timeout, and non-success responses in safe reason codes. Ensure probe failures do not make the health route throw or wait indefinitely.
4. Add unit tests for healthy response, non-success response, timeout, missing configuration, and response shape; verify against the local Realtime service when available.
5. Update the health-route codemap and tracer to state exactly what the probe does and does not establish.

**Acceptance:** the endpoint never reports healthy solely because the route executed; known unavailable Realtime states are reported as unhealthy/degraded within the configured time bound.

### Phase 5 — Integration, rollout, and closeout

1. Regenerate database types using the repository’s database workflow when approved migrations change the schema/function contract; commit source migrations and generated types together.
2. Run focused tests for closeout, hourly-load splits, and health reporting; run portal type-check, lint, `pnpm agent:verify`, RLS audit, and policy checks.
3. Apply migrations first to the approved development/test database. Verify grants and execute the negative authorization tests there before requesting production rollout.
4. Roll out using the approved migration procedure, verify the production grants and end-to-end paths, and monitor closeout failures, split failures, and Realtime status after deployment.
5. Update `apps/portal/AGENT_TRACER.md` and relevant codemaps with verified behavior, migration references, operational limits, and rollback instructions.
6. Mark the audit complete only when all acceptance criteria pass in the target environment; otherwise keep the specific blocker open with evidence.

## Verification matrix

| Area | Required proof |
|---|---|
| Closeout authorization | Database tests reject anonymous, spoofed identity, and unauthorized department calls; minimum grants verified in target DB |
| Closeout reliability | Existing valid closeout and idempotency/retry tests pass |
| Hourly-load split | One RPC call; successful split persists all expected rows; injected failure leaves the database unchanged |
| Shared fleet | Control Room can still select centrally registered machines without weakening shift authorization |
| Realtime health | Real probe behavior verified for ready, unavailable, timeout, and misconfiguration cases |
| Repository quality | Focused suites, portal type-check, Biome, `pnpm agent:verify`, `pnpm audit:rls`, and `pnpm policy:check` pass |
| Deployment | Target-environment migration grants and smoke checks verified; no claim based only on local results |

## Rollback strategy

- Database changes are forward-only. Prepare reviewed compensating migrations before production rollout; do not rewrite applied migrations.
- For the RPC security change, rollback must not restore anonymous access or caller-trusted identity. If the new function is faulty, disable the affected RPC or roll forward a corrected secure function while preserving least-privilege grants.
- For split transactions, route callers back only to a safe, explicitly gated path; never restore the known non-atomic path as an unqualified fallback.
- The Realtime probe may be reverted independently to a truthful unavailable/unknown response, but never to a hard-coded healthy response.
- Pause rollout and preserve logs/transaction evidence on any failed acceptance check.

## Out of scope

- Building or hosting a custom database layer.
- Adding machine-specific license data that the current schema does not model.
- Changing scanner hardware addressing or unrelated Control Room workflows.
