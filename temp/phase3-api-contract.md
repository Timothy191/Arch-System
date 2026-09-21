# Phase 3: API Contract Audit — Next.js Monorepo Business Portal

**Date:** 2026-09-21
**Scope:** `apps/portal/app/api/`, `packages/contract/src/schemas/`, `apps/portal/lib/api/`
**Auditor:** Contract Auditor Specialist

---

## 1. COMPLETE API ROUTE MAP

### 1.1 Route Group Directory Inventory (26 entries)

| #   | Directory                         | Routes                                 | Methods          | Handler File |
| --- | --------------------------------- | -------------------------------------- | ---------------- | ------------ |
| 1   | `admin/data/[table]`              | `/api/admin/data/{table}`              | GET, PUT, DELETE | `route.ts`   |
| 2   | `ai/actions`                      | `/api/ai/actions`                      | POST             | `route.ts`   |
| 3   | `ai/metrics`                      | `/api/ai/metrics`                      | GET              | `route.ts`   |
| 4   | `audit`                           | `/api/audit`                           | GET              | `route.ts`   |
| 5   | `auth/login`                      | `/api/auth/login`                      | POST             | `route.ts`   |
| 6   | `c66`                             | `/api/c66`                             | POST, OPTIONS    | `route.ts`   |
| 7   | `codebase-maps`                   | `/api/codebase-maps`                   | GET              | `route.ts`   |
| 8   | `control-room/shift-completeness` | `/api/control-room/shift-completeness` | GET              | `route.ts`   |
| 9   | `control-room/scada-status`       | `/api/control-room/scada-status`       | GET              | `route.ts`   |
| 10  | `csp-violations`                  | `/api/csp-violations`                  | POST             | `route.ts`   |
| 11  | `doc`                             | `/api/doc`                             | GET              | `route.ts`   |
| 12  | `export/fuel-logs`                | `/api/export/fuel-logs`                | GET              | `route.ts`   |
| 13  | `export/machines`                 | `/api/export/machines`                 | GET              | `route.ts`   |
| 14  | `export/production`               | `/api/export/production`               | GET              | `route.ts`   |
| 15  | `export/tires`                    | `/api/export/tires`                    | GET              | `route.ts`   |
| 16  | `feedback`                        | `/api/feedback`                        | POST             | `route.ts`   |
| 17  | `health`                          | `/api/health`                          | GET              | `route.ts`   |
| 18  | `health/cache`                    | `/api/health/cache`                    | GET              | `route.ts`   |
| 19  | `health/fuxa`                     | `/api/health/fuxa`                     | GET              | `route.ts`   |
| 20  | `health/live`                     | `/api/health/live`                     | GET              | `route.ts`   |
| 21  | `health/n8n`                      | `/api/health/n8n`                      | GET              | `route.ts`   |
| 22  | `health/redis`                    | `/api/health/redis`                    | GET              | `route.ts`   |
| 23  | `health/supabase-realtime`        | `/api/health/supabase-realtime`        | GET              | `route.ts`   |
| 24  | `health/warmup`                   | `/api/health/warmup`                   | GET              | `route.ts`   |
| 25  | `inngest`                         | `/api/inngest`                         | GET, POST, PUT   | `route.ts`   |
| 26  | `log`                             | `/api/log`                             | POST             | `route.ts`   |
| 27  | `metabase/embed`                  | `/api/metabase/embed`                  | GET              | `route.ts`   |
| 28  | `metrics`                         | `/api/metrics`                         | GET              | `route.ts`   |
| 29  | `metrics/prometheus`              | `/api/metrics/prometheus`              | GET              | `route.ts`   |
| 30  | `ml/predictive-maintenance`       | `/api/ml/predictive-maintenance`       | GET              | `route.ts`   |
| 31  | `plugins/rust-telemetry`          | `/api/plugins/rust-telemetry`          | POST             | `route.ts`   |
| 32  | `printers`                        | `/api/printers`                        | GET, POST        | `route.ts`   |
| 33  | `printers/[id]`                   | `/api/printers/{id}`                   | DELETE           | `route.ts`   |
| 34  | `printers/scan`                   | `/api/printers/scan`                   | GET              | `route.ts`   |
| 35  | `scada/tags`                      | `/api/scada/tags`                      | GET              | `route.ts`   |
| 36  | `sync/playback`                   | `/api/sync/playback`                   | POST             | `route.ts`   |
| 37  | `telemetry/drilling`              | `/api/telemetry/drilling`              | POST             | `route.ts`   |
| 38  | `telemetry/drilling/stream`       | `/api/telemetry/drilling/stream`       | GET              | `route.ts`   |
| 39  | `telemetry/push`                  | `/api/telemetry/push`                  | POST             | `route.ts`   |
| 40  | `tools/status`                    | `/api/tools/status`                    | GET              | `route.ts`   |
| 41  | `weather`                         | `/api/weather`                         | GET              | `route.ts`   |
| 42  | `webhooks`                        | `/api/webhooks`                        | GET, POST        | `route.ts`   |
| 43  | `webhooks/[id]`                   | `/api/webhooks/{id}`                   | PUT, DELETE      | `route.ts`   |
| 44  | `webhooks/[id]/logs`              | `/api/webhooks/{id}/logs`              | GET              | `route.ts`   |

**Total: 44 route files across 26 directory groups. Note: `codemap.md` is a metadata file, not a route group.**

### 1.2 Method Summary

| Method  | Count | Routes                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GET     | 30    | health (x7), metrics, metrics/prometheus, audit, codebase-maps, doc, ai/metrics, tools/status, control-room/x2, scada/tags, printers, printers/scan, printers/[id], sync/playback, telemetry/drilling/stream, metabase/embed, export/fuel-logs, export/machines, export/production, export/tires, weather, ml/predictive-maintenance, webhooks, webhooks/[id]/logs, control-room/shift-completeness, control-room/scada-status |
| POST    | 15    | auth/login, c66, feedback, csp-violations, inngest, log, ai/actions, telemetry/push, telemetry/drilling, plugins/rust-telemetry, printers, webhooks, sync/playback, export/x4 (GET only)                                                                                                                                                                                                                                       |
| PUT     | 3     | inngest, admin/data/[table], webhooks/[id]                                                                                                                                                                                                                                                                                                                                                                                     |
| DELETE  | 2     | admin/data/[table], printers/[id], webhooks/[id]                                                                                                                                                                                                                                                                                                                                                                               |
| OPTIONS | 1     | c66                                                                                                                                                                                                                                                                                                                                                                                                                            |

---

## 2. SCHEMA COVERAGE MATRIX

### 2.1 All 20 Zod Schemas

| #   | Schema File                       | Schema Name(s)                                                                                                                                                                                                     | Used By Route(s) | Status                                                                                                                                                                                            |
| --- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `access-card.schema.ts`           | `EmployeeProfileUpdateSchema`, `PrintRequestSchema`                                                                                                                                                                | **UNUSED**       | ❌ No route validates with this                                                                                                                                                                   |
| 2   | `access-control.schema.ts`        | `coalTruckScanSchema`, `keyControlAssetSchema`, `keyScanTransactionSchema`, `accessCardMakerSchema`, `rollCallQuerySchema`, `attendanceQuerySchema`, `gateLocationSchema`, `overstayAlertSchema`                   | **UNUSED**       | ❌ No route validates with these                                                                                                                                                                  |
| 3   | `admin.schema.ts`                 | `adminDataQuerySchema`, `adminDataUpdateSchema`, `adminDataDeleteSchema`, `adminAddSiteSchema`, `adminUpdateSiteSchema`                                                                                            | **PARTIAL**      | ⚠️ `adminDataQuerySchema` used implicitly by `admin/data/[table]` but NOT imported/validated; `adminDataUpdateSchema`/`adminDataDeleteSchema` NOT used                                            |
| 4   | `agent-tools.schema.ts`           | `searxngToolParamsSchema`, `wolframToolParamsSchema`                                                                                                                                                               | **UNUSED**       | ❌ No route validates with these                                                                                                                                                                  |
| 5   | `ai.schema.ts`                    | `aiChatSchema`, `aiSafetySchema`, `aiPredictSchema`, `aiHandoffSchema`, `riskAssessmentSchema`, `complianceResultSchema`                                                                                           | **UNUSED**       | ❌ No route validates with these                                                                                                                                                                  |
| 6   | `common.schema.ts`                | `uuidSchema`, `dateSchema`, `dateMonthSchema`, `nonEmptyString`                                                                                                                                                    | SHARED           | ✅ Imported by many schemas as base types                                                                                                                                                         |
| 7   | `compliance-audit.schema.ts`      | `complianceAuditRunSchema`, `createComplianceAuditRunSchema`                                                                                                                                                       | **UNUSED**       | ❌ No route validates with these                                                                                                                                                                  |
| 8   | `control-room.schema.ts`          | `shiftCompletenessSchema`, `controlRoomChecklistItemSchema`, `controlRoomChecklistSchema`, `controlRoomShiftReportSchema`, `shiftCloseoutSchema`, `healthCheckResponseSchema`                                      | **PARTIAL**      | ⚠️ `shiftCompletenessSchema` NOT used by `control-room/shift-completeness` route (manual query params); `healthCheckResponseSchema` used by `health/route.ts` ✅                                  |
| 9   | `drill.schema.ts`                 | `drillOperationSchema`, `drillTelemetryIngestSchema`                                                                                                                                                               | **PARTIAL**      | ⚠️ `drillTelemetryIngestSchema` used by `telemetry/drilling` via `withValidation` ✅; `drillOperationSchema` **UNUSED**                                                                           |
| 10  | `export.schema.ts`                | `exportQuerySchema`                                                                                                                                                                                                | **USED** ✅      | `export/production`, `export/machines`, `export/fuel-logs` all use `exportQuerySchema.safeParse(params)`                                                                                          |
| 11  | `fleet-equipment.schema.ts`       | `fleetSchema`, `equipmentSchema`, `fleetCategoryEnum`, `fleetStatusEnum`, `equipmentStatusEnum`                                                                                                                    | **UNUSED**       | ❌ No route validates with these                                                                                                                                                                  |
| 12  | `form.schema.ts`                  | `dailyLogSchema`, `drillingDailyLogSchema`, `productionDailyLogSchema`, `dozerRollSchema`, `createBreakdownSchema`, `bookOutSchema`, `directCheckoutSchema`, `monthlyReportInputSchema`, `updateMachineSiteSchema` | **PARTIAL**      | ⚠️ `createBreakdownSchema`, `bookOutSchema`, `directCheckoutSchema` used by `ai/actions` ✅; others **UNUSED**                                                                                    |
| 13  | `multi-site-production.schema.ts` | `multiSiteShiftReportSchema` + sub-schemas                                                                                                                                                                         | **UNUSED**       | ❌ No route validates with these                                                                                                                                                                  |
| 14  | `scanner.schema.ts`               | `scannerBadgeSchema`                                                                                                                                                                                               | **USED** ✅      | `c66/route.ts` uses `validateBody(request, scannerBadgeSchema)`                                                                                                                                   |
| 15  | `shift-compilation.schema.ts`     | `machinePerformanceSchema`, `shiftBreakdownSummarySchema`, `shiftTireEventSchema`, `unifiedShiftReportSchema`, `lockAndSignShiftSchema`                                                                            | **UNUSED**       | ❌ No route validates with these                                                                                                                                                                  |
| 16  | `sync.schema.ts`                  | `syncPlaybackSchema`                                                                                                                                                                                               | **USED** ✅      | `sync/playback/route.ts` uses `validateBody(req, syncPlaybackSchema)`                                                                                                                             |
| 17  | `telemetry.schema.ts`             | `telemetryPushSchema`                                                                                                                                                                                              | **PARTIAL**      | ⚠️ `telemetry/push/route.ts` uses `withValidation(telemetryPushSchema, ...)` only for the **direct tag update** path; webhook path (`body.table === "machine_telemetry"`) does NOT use the schema |
| 18  | `tire-management.schema.ts`       | `tireStatusSchema`, `tireConditionSchema`, `tirePositionSchema`, `tireIdSchema`, `tireSchema`, `tireInspectionSchema`, `createTireSchema`, `logTireInspectionSchema`, `replaceTireSchema`                          | **UNUSED**       | ❌ No route validates with these (export/tires does raw SQL, no Zod validation)                                                                                                                   |
| 19  | `webhook.schema.ts`               | `createWebhookSchema`, `updateWebhookSchema`                                                                                                                                                                       | **USED** ✅      | `webhooks/route.ts` uses `validateBody(request, createWebhookSchema)`, `webhooks/[id]/route.ts` uses `validateBody(request, updateWebhookSchema)`                                                 |
| 20  | `common.schema.ts`                | (base types)                                                                                                                                                                                                       | SHARED           | ✅                                                                                                                                                                                                |

### 2.2 Schema Usage Summary

- **Fully validated with Zod (production-ready):** 4 routes (export x3, c66, sync/playback, webhooks x2)
- **Partially validated:** 3 routes (telemetry/push only direct path, ai/actions only write tools, telemetry/drilling)
- **No Zod validation at all:** ~30+ routes (most health checks, admin, audit, feedback, log, csp-violations, weather, plugins, ml, control-room, metabase, metrics, tools, printers, scada, inngest, codebase-maps, etc.)

---

## 3. CONTRACT COMPLIANCE GAPS

### 3.1 CRITICAL GAPS

| #   | Gap                                                         | Severity    | Affected Routes                                                                                                                                                       | Description                                                                                                                                                                           |
| --- | ----------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G1  | **No input validation on most routes**                      | 🔴 CRITICAL | All health, admin, audit, feedback, log, csp-violations, weather, plugins, ml, control-room, metabase, metrics, tools, printers, scada, inngest, codebase-maps routes | These routes accept `request.json()` or query params without any Zod schema validation. This means arbitrary payloads can reach business logic.                                       |
| G2  | **`admin/data/[table]` uses no Zod validation**             | 🔴 CRITICAL | `admin/data/[table]`                                                                                                                                                  | GET/PUT/DELETE operations accept query params and body without `adminDataQuerySchema`, `adminDataUpdateSchema`, or `adminDataDeleteSchema`. The schemas exist but are never imported. |
| G3  | **`feedback/route.ts` has zero validation**                 | 🔴 CRITICAL | `feedback`                                                                                                                                                            | Accepts `{ type, message, userEmail, metadata }` with no schema. Any payload structure passes through.                                                                                |
| G4  | **`log/route.ts` has zero validation**                      | 🔴 CRITICAL | `log`                                                                                                                                                                 | Accepts `{ level, msg, timestamp, data }` with no schema. Invalid `level` values are silently handled in the default case.                                                            |
| G5  | **`csp-violations/route.ts` has zero validation**           | 🔴 CRITICAL | `csp-violations`                                                                                                                                                      | Parses `req.json()` with no schema. CSP report structure is not validated.                                                                                                            |
| G6  | **`auth/login` has no Zod validation**                      | 🟡 HIGH     | `auth/login`                                                                                                                                                          | Manual `if (!email \|\| !password)` check instead of using a Zod schema. No `auth` schema exists in `@repo/contract` yet.                                                             |
| G7  | **`control-room/shift-completeness` has no Zod validation** | 🟡 HIGH     | `control-room/shift-completeness`                                                                                                                                     | Manual query param checks instead of using `shiftCompletenessSchema` from `control-room.schema.ts`.                                                                                   |
| G8  | **`weather/route.ts` has no validation**                    | 🟡 HIGH     | `weather`                                                                                                                                                             | Uses `cache()` and `fetchWeather()` with no input schema.                                                                                                                             |
| G9  | **`tools/status` has no validation**                        | 🟡 HIGH     | `tools/status`                                                                                                                                                        | No query param validation despite `EXTERNAL_TOOLS` config.                                                                                                                            |

### 3.2 MEDIUM GAPS

| #   | Gap                                                | Severity  | Affected Routes             | Description                                                                                                                                                                                             |
| --- | -------------------------------------------------- | --------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G10 | **`export/tires` has no Zod validation**           | 🟡 MEDIUM | `export/tires`              | Unlike `export/production` and `export/machines` which use `exportQuerySchema`, `export/tires` parses query params manually without validation.                                                         |
| G11 | **`telemetry/push` webhook path unvalidated**      | 🟡 MEDIUM | `telemetry/push`            | The `body.table === "machine_telemetry"` path bypasses `telemetryPushSchema`. Supabase webhook payloads are not validated against any schema.                                                           |
| G12 | **`ai/actions` has minimal validation**            | 🟡 MEDIUM | `ai/actions`                | Only validates `kind`, `tool`, and `args` structure. The actual `args` are passed to `safeParse()` on tool-specific schemas only for `write` operations. `read` operations have no argument validation. |
| G13 | **`plugins/rust-telemetry` has no validation**     | 🟡 MEDIUM | `plugins/rust-telemetry`    | Parses `{ hours, temp, rpm }` with no schema. Defaults are used but not validated (e.g., negative values possible).                                                                                     |
| G14 | **`printers/route.ts` has no body validation**     | 🟡 MEDIUM | `printers`                  | POST inserts `{ cups_name, name, model, connection_type, vendor_id, product_id, device_path }` without any Zod schema.                                                                                  |
| G15 | **`metabase/embed` has no query param validation** | 🟡 MEDIUM | `metabase/embed`            | `dashboardId` is parsed with `parseInt` but no schema validation. `departmentId` is passed through unchecked.                                                                                           |
| G16 | **`ml/predictive-maintenance` has no validation**  | 🟡 MEDIUM | `ml/predictive-maintenance` | No input validation at all (GET with no params).                                                                                                                                                        |

### 3.3 MINOR GAPS

| #   | Gap                                            | Severity | Affected Routes                                           | Description                                                                                                                                                |
| --- | ---------------------------------------------- | -------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G17 | **`sync/playback` double-parses body**         | 🟢 LOW   | `sync/playback`                                           | Calls `req.json()` twice (`reqClone.json()` then `validateBody(req, ...)`). The first parse is redundant since `validateBody` also calls `request.json()`. |
| G18 | **`ai/metrics` has no validation**             | 🟢 LOW   | `ai/metrics`                                              | Query params `scope` and `departmentId` are parsed manually without schema.                                                                                |
| G19 | **`codebase-maps` has no validation**          | 🟢 LOW   | `codebase-maps`                                           | Query params `log` and `file` are not validated.                                                                                                           |
| G20 | **`audit` route has no validation**            | 🟢 LOW   | `audit`                                                   | Query param `log` is not validated.                                                                                                                        |
| G21 | **`health/fuxa` uses inline interface**        | 🟢 LOW   | `health/fuxa`                                             | Defines `FuxaHealthResponse` inline instead of using `healthCheckResponseSchema` from `control-room.schema.ts`.                                            |
| G22 | **`health/redis` and `health/live` are stubs** | 🟢 LOW   | `health/redis`, `health/live`, `health/supabase-realtime` | Return hardcoded `degraded = false` — no actual health checks performed.                                                                                   |
| G23 | **`health/metabase` route does not exist**     | 🟢 LOW   | —                                                         | `metabase/embed` exists but no dedicated `health/metabase` endpoint was found.                                                                             |

---

## 4. WEBHOOK ASSESSMENT

### 4.1 Webhook Infrastructure Review

#### Migration `017_webhooks.sql`

- ✅ **Tables created:** `webhook_endpoints` and `webhook_delivery_logs` with proper UUID PKs, FKs, and indexes
- ✅ **RLS enabled:** Both tables have Row Level Security with admin/supervisor policies
- ✅ **Indexes:** Proper GIN index on `event_types`, B-tree on `department_id`, `active`, and delivery logs
- ⚠️ **Concern:** RLS policy `supervisors_create_department_webhooks` uses `FOR INSERT WITH CHECK` but the policy checks `auth.uid()` against `employees` table — this assumes `auth.uid()` returns the employee auth_id, which may not match if Supabase Auth and employees table are not properly linked
- ⚠️ **Concern:** `svix_endpoint_id` column exists but Svix integration is not referenced in any route code
- ✅ **Audit triggers:** `webhook_endpoints_audit`, `webhook_delivery_logs_audit`, `webhook_endpoints_updated_at` triggers are defined

#### Migration `018_webhook_triggers.sql`

- ✅ **Triggers created:** For `daily_logs`, `breakdowns`, `safety_incidents`, `production_logs`, `operational_delays`
- ⚠️ **CRITICAL GAP:** Trigger function `queue_webhook_delivery()` **only inserts into `webhook_delivery_logs`** — it does NOT actually send webhooks to external URLs. The delivery logs record "Queued for delivery" but no HTTP POST is made to the webhook URL. The actual delivery mechanism (Svix or custom HTTP client) is **missing**.
- ⚠️ **Deprecated table reference:** Trigger references `operational_delays` table, but migration `069_migrate_operational_delays_to_delay_entries.sql` renamed this to `delay_entries`. The trigger function has a dead branch for `operational_delays`.
- ⚠️ **Missing event types:** The `webhook_endpoints` table supports event types like `daily_log.created`, `breakdown.completed`, `production_log.created`, `operational_delay.created`, but the triggers cover `safety_incident.created` and `safety_incident.resolved` which are NOT listed in `webhook.schema.ts` `event_types` enum.

#### Migration `019_sync_metadata.sql`

- ✅ **Sync columns added:** `sync_status`, `idempotency_key`, `last_synced_at` added to `daily_logs`, `breakdowns`, `safety_incidents`
- ✅ **RPC function:** `get_monolithized_department_dashboard_payload()` created with `SECURITY DEFINER`
- ⚠️ **Concern:** The RPC function is `SECURITY DEFINER` which means it runs with the privileges of the definer, bypassing RLS. This could be a security concern if the definer has elevated permissions.
- ⚠️ **Concern:** `idempotency_key` is `UUID DEFAULT gen_random_uuid()` but the `syncPlaybackSchema` expects `idempotencyKey` as a string. No mapping between the DB UUID and the API string is defined.

#### `packages/contract/src/schemas/webhook.schema.ts`

- ✅ **`createWebhookSchema`:** Validates `url` (URI format, max 2048), `description`, `event_types` (array, min 1, max 20), `department_id` (UUID), `secret` (min 16), `active` (boolean)
- ✅ **`updateWebhookSchema`:** All fields optional, validates URL format and event type array bounds
- ⚠️ **GAP:** `createWebhookSchema` requires `department_id: uuidSchema` (required), but the route handler `webhooks/route.ts` makes `department_id` optional (`department_id || employee.department_id`). The schema should make `department_id` optional to match the route behavior.
- ⚠️ **GAP:** `createWebhookSchema` does NOT include `svix_endpoint_id` field, which exists in the DB table.
- ⚠️ **GAP:** No schema validates webhook delivery payload structure or response format.

### 4.2 Webhook Route Coverage

| Route                         | Schema Used           | Validation        | CORS           | Rate Limit                           |
| ----------------------------- | --------------------- | ----------------- | -------------- | ------------------------------------ |
| `GET /api/webhooks`           | None                  | ❌ None           | ✅ `applyCors` | ✅ `withRateLimit`                   |
| `POST /api/webhooks`          | `createWebhookSchema` | ✅ `validateBody` | ✅ `applyCors` | ✅ `withRateLimit` + `withBodyLimit` |
| `PUT /api/webhooks/[id]`      | `updateWebhookSchema` | ✅ `validateBody` | ✅ `applyCors` | ✅ `withRateLimit`                   |
| `DELETE /api/webhooks/[id]`   | None                  | ❌ None           | ✅ `applyCors` | ✅ `withRateLimit`                   |
| `GET /api/webhooks/[id]/logs` | None                  | ❌ None           | ❌ No CORS     | ✅ `withRateLimit`                   |

---

## 5. RATE LIMITING ASSESSMENT

### 5.1 `rate-limit-middleware.ts` Review

- ✅ **Dual store strategy:** Redis (primary) + MemoryStore (fallback)
- ✅ **Two strategies:** Token Bucket (for `/api/ai/`) + Sliding Window (for all others)
- ✅ **IP whitelist:** `RATE_LIMIT_IP_WHITELIST` env var support
- ✅ **Load-adaptive throttling:** Reduces limits by 50% when CPU load >85%
- ✅ **Response headers:** `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `Retry-After`
- ✅ **Disable capability:** `DISABLE_RATE_LIMIT=true` env var
- ✅ **Internal skip:** `skipForInternal()` with timing-safe comparison
- ⚠️ **Concern:** `TokenBucketStrategy` and `SlidingWindowStrategy` have **identical implementations** — both use simple counter-based increment. Neither implements true token bucket or sliding window semantics. The `TokenBucketStrategy` should use a token bucket algorithm (leaky bucket), and `SlidingWindowStrategy` should use a sliding log or rolling counter.
- ⚠️ **Concern:** `MemoryStore` is **not production-safe** — counters are lost on restart, and there's no cleanup of expired entries.
- ⚠️ **Concern:** `RedisStore.get()` has a hardcoded `resetTime: Date.now() + 60000` instead of using the actual window configuration.
- ⚠️ **Concern:** No distributed rate limiting — if multiple instances are running, each has its own `MemoryStore` fallback, leading to inconsistent limits.

### 5.2 `rate-limit-config.ts` Coverage

| Route Prefix                              | Config     | Window | Max Requests |
| ----------------------------------------- | ---------- | ------ | ------------ |
| `/api/ai/`                                | `ai`       | 60s    | 30           |
| `/api/auth/`, `/login`, `/reset-password` | `auth`     | 15min  | 10           |
| `/api/export/`                            | `export`   | 60s    | 20           |
| `/api/admin/`                             | `admin`    | 60s    | 100          |
| `/api/webhooks/`                          | `webhooks` | 60s    | 200          |
| `/api/c66`                                | `hardware` | 60s    | 10000        |
| All others                                | `general`  | 60s    | 1000         |

- ⚠️ **GAP:** No rate limit configuration for `/api/health/*` endpoints. Health checks have no rate limiting, which could allow DoS via health endpoint flooding.
- ⚠️ **GAP:** No rate limit for `/api/metrics`, `/api/metrics/prometheus` (metrics scraping could be abused).
- ⚠️ **GAP:** No rate limit for `/api/doc` (OpenAPI spec endpoint).
- ⚠️ **GAP:** No rate limit for `/api/csp-violations` (CSP reporting endpoint).
- ⚠️ **GAP:** No rate limit for `/api/weather`, `/api/tools/status`, `/api/scada/tags`.

### 5.3 `body-limit.ts` Review

- ✅ **Content-Length check:** Validates `content-length` header against `maxSize`
- ✅ **Default 1MB limit:** Configurable via `options.maxSize`
- ⚠️ **GAP:** Only checks `content-length` header — does NOT validate actual body size. A client could send a chunked request with a small content-length but large body.
- ⚠️ **GAP:** No JSON-specific size validation — binary uploads with large payloads bypass the limit if content-length is spoofed.

### 5.4 Rate Limit Application Across Routes

| Route                    | Rate Limited | Custom Limit         | Notes                                   |
| ------------------------ | ------------ | -------------------- | --------------------------------------- |
| `auth/login`             | ✅           | 5 req/15min          | Custom limit in handler                 |
| `export/*`               | ✅           | General (1000/60s)   | Uses `withRateLimit` wrapper            |
| `c66`                    | ✅           | Hardware (10000/60s) | Config-based                            |
| `webhooks`               | ✅           | Webhooks (200/60s)   | Config-based                            |
| `webhooks/[id]`          | ✅           | Webhooks (200/60s)   | Config-based                            |
| `webhooks/[id]/logs`     | ✅           | Webhooks (200/60s)   | Config-based                            |
| `admin/data/[table]`     | ✅           | Admin (100/60s)      | Config-based                            |
| `ai/*`                   | ✅           | AI (30/60s)          | Config-based + Token Bucket             |
| `plugins/rust-telemetry` | ✅           | General (1000/60s)   | Config-based                            |
| `metabase/embed`         | ✅           | General (1000/60s)   | Config-based                            |
| `sync/playback`          | ✅           | General (1000/60s)   | Config-based                            |
| `inngest`                | ❌           | —                    | `serve()` handles its own rate limiting |
| **All other routes**     | ❌           | —                    | **No rate limiting at all**             |

**Routes WITHOUT rate limiting:** health/_(x8), audit, codebase-maps, csp-violations, doc, feedback, log, metrics, metrics/prometheus, ml/predictive-maintenance, printers, printers/[id], printers/scan, scada/tags, telemetry/push (has body-limit only), telemetry/drilling/stream, tools/status, weather, control-room/_, metabase/embed (has rate limit), ai/metrics, ai/actions, admin/data/[table] (has rate limit).

---

## 6. CORS ASSESSMENT

### 6.1 `cors.ts` Review

```typescript
export function applyCors(request: Request, response: NextResponse): NextResponse {
  const origin = request.headers.get("origin") || "*";
  response.headers.set("Access-Control-Allow-Origin", origin);
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
  response.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, x-scanner-token, x-scanner-source, x-device-id, apikey, x-client-info",
  );
  return response;
}
```

- ⚠️ **CRITICAL: Origin reflection vulnerability** — `origin || "*"` means if no Origin header is present, it falls back to `"*"`, but if an Origin IS present, it reflects it verbatim. This allows **any origin** to access the API by simply sending its own Origin header. Should validate against a whitelist.
- ⚠️ **Missing headers:** Does not include `x-internal-secret` in allowed headers, which is used by `skipForInternal()`.
- ⚠️ **No `Access-Control-Allow-Credentials`** — If credentials (cookies, auth headers) are used, this should be `true`, but it's not set. This breaks cookie-based auth for cross-origin requests.
- ⚠️ **No `Access-Control-Max-Age`** — Preflight caching is not configured.
- ⚠️ **No `Vary: Origin` header** — This can cause caching issues with CDN/proxies.
- ⚠️ **Inconsistent application:** CORS is applied in some routes (`export/*`, `webhooks/*`, `c66`, `telemetry/*`, `sync/playback`, `scada/tags`, `control-room/scada-status`) but NOT in others (`auth/login`, `admin/data/[table]`, `ai/*`, `health/*`, `metrics`, `doc`, `feedback`, `log`, `csp-violations`, `printers`, `tools/status`, `weather`, `metabase/embed`).

### 6.2 CORS Application Matrix

| Route                                               | CORS Applied | Notes                                                            |
| --------------------------------------------------- | ------------ | ---------------------------------------------------------------- |
| `c66`                                               | ✅           | `applyCors` on OPTIONS and POST                                  |
| `export/*` (tires, machines, production, fuel-logs) | ✅           | `applyCors` on all responses                                     |
| `webhooks`                                          | ✅           | `applyCors` on GET and POST                                      |
| `webhooks/[id]`                                     | ✅           | `applyCors` on PUT and DELETE                                    |
| `webhooks/[id]/logs`                                | ❌           | No CORS                                                          |
| `telemetry/push`                                    | ✅           | `applyCors`                                                      |
| `telemetry/drilling`                                | ✅           | `applyCors`                                                      |
| `telemetry/drilling/stream`                         | ❌           | No CORS (SSE may need special handling)                          |
| `sync/playback`                                     | ✅           | `applyCors`                                                      |
| `scada/tags`                                        | ✅           | `applyCors`                                                      |
| `control-room/scada-status`                         | ✅           | `applyCors`                                                      |
| `auth/login`                                        | ❌           | **No CORS** — may break cross-origin auth                        |
| `admin/data/[table]`                                | ❌           | **No CORS**                                                      |
| `ai/actions`                                        | ❌           | **No CORS**                                                      |
| `ai/metrics`                                        | ❌           | **No CORS**                                                      |
| `health/*` (all)                                    | ❌           | **No CORS**                                                      |
| `metrics`, `metrics/prometheus`                     | ❌           | **No CORS**                                                      |
| `doc`                                               | ❌           | **No CORS**                                                      |
| `feedback`                                          | ❌           | **No CORS**                                                      |
| `log`                                               | ❌           | **No CORS**                                                      |
| `csp-violations`                                    | ❌           | **No CORS** (by design — browser sends CSP reports without CORS) |
| `printers`                                          | ❌           | **No CORS**                                                      |
| `tools/status`                                      | ❌           | **No CORS**                                                      |
| `weather`                                           | ❌           | **No CORS**                                                      |
| `metabase/embed`                                    | ❌           | **No CORS**                                                      |
| `plugins/rust-telemetry`                            | ❌           | **No CORS**                                                      |
| `ml/predictive-maintenance`                         | ❌           | **No CORS**                                                      |
| `control-room/shift-completeness`                   | ❌           | **No CORS**                                                      |
| `inngest`                                           | ❌           | **No CORS**                                                      |
| `codebase-maps`                                     | ❌           | **No CORS**                                                      |
| `audit`                                             | ❌           | **No CORS**                                                      |

---

## 7. RESPONSE FORMATTING ASSESSMENT

### 7.1 `response.ts` Review

```typescript
export async function validateBody<T>(
  request: Request,
  schema: ZodSchema<T>,
): Promise<{ data: T } | NextResponse>;
```

- ✅ **Consistent error format:** Returns `{ error: "invalid request body: ...", details: result.error.issues }` with status 400
- ✅ **JSON parse error handling:** Returns `{ error: "invalid json in request body" }` with status 400
- ✅ **Type-safe:** Generic `T` parameter with Zod inference
- ⚠️ **GAP:** Error message is lowercased via `.toLowerCase()` which may make messages less readable for debugging
- ⚠️ **GAP:** Does not include the field path in the error message in a machine-readable format (the `details` field has this, but the `error` string concatenates everything)

### 7.2 Inconsistent Response Patterns

| Pattern                                                                | Routes Using It             | Issue                                                           |
| ---------------------------------------------------------------------- | --------------------------- | --------------------------------------------------------------- |
| `NextResponse.json({ success: true })`                                 | feedback, log               | No data, no standard error format                               |
| `NextResponse.json({ error: "..." }, { status: 401 })`                 | auth/login, admin, printers | Inconsistent error format vs `{ success: false, error: "..." }` |
| `NextResponse.json({ success: false, error: "..." }, { status: 401 })` | c66, ai/actions             | Different pattern from above                                    |
| `NextResponse.json({ data: ..., count: ... })`                         | admin/data/[table], health  | Admin pattern differs from others                               |
| `new NextResponse(csvContent, { headers })`                            | export/\*                   | CSV responses bypass `applyCors` in some cases                  |
| `new Response(null, { status: 204 })`                                  | csp-violations              | No CORS, no content-type                                        |
| `new Response(body, { headers: { "Content-Type": "text/plain" } })`    | metrics, metrics/prometheus | Plain text responses                                            |
| `NextResponse.json(null, { status: 200 })`                             | weather                     | Returns null on error                                           |
| `NextResponse.json({ webhooks: data })`                                | webhooks                    | Different wrapper pattern                                       |
| `NextResponse.json({ printers: data })`                                | printers                    | Different wrapper pattern                                       |

### 7.3 Response Consistency Issues

- ⚠️ **Mixed success/error patterns:** Some routes use `{ success: boolean, error: string }`, others use `{ error: string }`, others use `{ data: T }`, others use `{ success: true }`.
- ⚠️ **No standardized error envelope:** There is no consistent error response format across routes. The `validateBody` function provides one format, but many routes have their own ad-hoc error responses.
- ⚠️ **Missing `data` wrapper:** Routes like `webhooks` wrap response in `{ webhooks: [...] }` while `admin/data/[table]` wraps in `{ data: [...], count: N }`. No consistent data envelope.
- ⚠️ **HTTP status code inconsistencies:** `health/fuxa` returns 503 for "down" status but 200 for "degraded"; `health/cache` returns 200 even when "degraded"; `health/live` returns 503 when `degraded = true` but always sets `degraded = false`.

---

## 8. SYNC METADATA ASSESSMENT

### 8.1 `019_sync_metadata.sql` Review

- ✅ **Columns added:** `sync_status`, `idempotency_key`, `last_synced_at` on `daily_logs`, `breakdowns`, `safety_incidents`
- ✅ **Constraints:** `sync_status` CHECK constraint (`pending`, `synced`, `failed`)
- ✅ **Unique constraint:** `idempotency_key` is unique
- ⚠️ **GAP:** `sync/playback/route.ts` uses `syncPlaybackSchema` which expects `idempotencyKey` (string), but the DB column is `idempotency_key UUID`. The schema-to-DB mapping is unclear — the API sends a string key, but the DB stores a UUID. There's no explicit mapping or conversion.
- ⚠️ **GAP:** `sync/playback/route.ts` sends data to Inngest with `idempotencyKey: parsed.data.idempotencyKey`, but Inngest's own idempotency mechanism may conflict with the DB-level `idempotency_key`.
- ⚠️ **GAP:** `last_synced_at` defaults to `NOW()` but there's no route that updates this field. The sync playback mechanism queues events but doesn't update `last_synced_at` on the source tables.
- ⚠️ **GAP:** No indexes added on `sync_status` or `idempotency_key` columns, which could make sync queries slow on large tables.
- ⚠️ **GAP:** The `get_monolithized_department_dashboard_payload()` function uses `SECURITY DEFINER` which bypasses RLS — this could expose data to unauthorized users if the definer has elevated permissions.

---

## 9. SUMMARY: CONTRACT COMPLIANCE GAPS

### 9.1 High-Priority Findings

| Priority    | Finding                                                                                            | Count                      |
| ----------- | -------------------------------------------------------------------------------------------------- | -------------------------- |
| 🔴 CRITICAL | Routes accepting requests with **zero input validation**                                           | ~30+ routes                |
| 🔴 CRITICAL | **`admin/data/[table]`** has existing schemas but never uses them                                  | 1 route                    |
| 🔴 CRITICAL | **`webhook_delivery_logs`** records "Queued for delivery" but **no actual HTTP delivery** occurs   | All webhooks               |
| 🔴 CRITICAL | **`cors.ts` reflects any Origin header** — origin reflection vulnerability                         | All CORS-enabled routes    |
| 🔴 CRITICAL | **`operational_delays` trigger** references deprecated table                                       | `018_webhook_triggers.sql` |
| 🟡 HIGH     | **No rate limiting** on health, metrics, doc, feedback, log, csp-violations, and many other routes | ~15 routes                 |
| 🟡 HIGH     | **`auth/login`** has no Zod schema for input validation                                            | 1 route                    |
| 🟡 HIGH     | **`control-room/shift-completeness`** ignores `shiftCompletenessSchema`                            | 1 route                    |
| 🟡 HIGH     | **No `Access-Control-Allow-Credentials`** in CORS                                                  | All CORS-enabled routes    |
| 🟡 MEDIUM   | **`export/tires`** missing `exportQuerySchema` validation                                          | 1 route                    |
| 🟡 MEDIUM   | **`telemetry/push` webhook path** bypasses `telemetryPushSchema`                                   | 1 route                    |
| 🟡 MEDIUM   | **`printers/route.ts`** has no body validation schema                                              | 1 route                    |
| 🟡 MEDIUM   | **`plugins/rust-telemetry`** has no input validation                                               | 1 route                    |
| 🟢 LOW      | **`health/fuxa`** uses inline interface instead of `healthCheckResponseSchema`                     | 1 route                    |
| 🟢 LOW      | **`health/redis`, `health/live`, `health/supabase-realtime`** are stubs                            | 3 routes                   |
| 🟢 LOW      | **`TokenBucketStrategy` and `SlidingWindowStrategy`** have identical implementations               | Infrastructure             |
| 🟢 LOW      | **No indexes** on `sync_status`, `idempotency_key` columns                                         | `019_sync_metadata.sql`    |

### 9.2 Schema-to-Route Coverage Score

```
Total routes:          44
Routes with Zod:       11 (25%)
Routes partially used: 4  (9%)
Routes with NO Zod:    29 (66%)

Schema coverage:       20 schemas
Schemas in use:        6  (30%)
Schemas unused:        14 (70%)
```

### 9.3 Recommendations

1. **Immediate:** Create Zod schemas for `auth/login` input, `feedback`, `log`, `csp-violations`, and add them to all currently unvalidated routes.
2. **Immediate:** Fix `cors.ts` to validate origins against a whitelist instead of reflecting any Origin header.
3. **Immediate:** Fix `018_webhook_triggers.sql` to use `delay_entries` instead of `operational_delays`, and implement actual webhook HTTP delivery.
4. **Short-term:** Apply `adminDataQuerySchema`, `adminDataUpdateSchema`, `adminDataDeleteSchema` to `admin/data/[table]`.
5. **Short-term:** Apply `exportQuerySchema` to `export/tires`.
6. **Short-term:** Add `Access-Control-Allow-Credentials: true` to CORS and configure origin whitelist.
7. **Short-term:** Add rate limiting to health, metrics, doc, and other unguarded routes.
8. **Medium-term:** Replace `TokenBucketStrategy`/`SlidingWindowStrategy` with proper implementations or consolidate to one strategy.
9. **Medium-term:** Add indexes on `sync_status`, `idempotency_key` columns and fix `idempotencyKey` string-to-UUID mapping.
10. **Medium-term:** Standardize response format across all routes (success/error/data envelope).
