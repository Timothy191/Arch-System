# Arch-System — Real-World Production Readiness & Redis Professional Audit

**Date:** 2026-09-28  
**Author:** Senior Systems & Resilience Engineering  
**Scope:** Repository `Timothy191/Arch-System`, Next.js Portal (`apps/portal`), Shared Packages (`packages/*`), Cloud Supabase, Cloud Redis, Vercel Production Deployment (`arch-system`).

---

## 1. Executive Summary

A comprehensive, evidence-based production readiness and Redis professional-practice audit was conducted on the `Timothy191/Arch-System` monorepo.

### Overall Assessment: `READY WITH CONDITIONS`

The core Next.js application, TypeScript contracts, PostgreSQL/Supabase schema with Row Level Security (RLS), and testing suites are mature and well-tested (134 test suites passed, 882 unit/integration tests passing). However, significant operational gaps exist in the Redis integration and telemetry data ownership:

1. **Critical Redis Gap (Resolved in Audit):** The SCADA tag source `/api/scada/tags` previously used the blocking Redis `KEYS` command (`redis.keys('telemetry:last:*')`), which blocks the single-threaded Redis engine. This was replaced with non-blocking numeric `redis.scan()`.
2. **Telemetry Data Ownership Conflict:** In `apps/portal/app/api/telemetry/push/route.ts`, Redis is designated as the sole system of record for telemetry data polled by FUXA SCADA without PostgreSQL persistence or durability replication (`Reverse-flow ingest (D2-a) — Redis is the system of record`). If Redis restarts or evicts keys, current equipment telemetry is permanently lost until the next push.
3. **Vercel Serverless Redis Connectivity:** On the Vercel production deployment (`https://arch-system-8yvcwpkdr-timothyoniel558-9643s-projects.vercel.app`), the live `/api/health/redis` probe returns `degraded` and `/api/scada/tags` returns `Redis connection failed` because serverless lambdas in AWS `iad1` cannot reach the configured private/local `REDIS_URL`. The application cleanly degrades (503/500 without crashing), but cloud-accessible Redis (e.g. Upstash or AWS ElastiCache with TLS) must be provisioned.
4. **Permanent Rules Installed:** The 19-section persistent engineering rules have been codified in `.agents/rules/permanent-engineering-rules.md` to govern all future engineering subagents.

---

## 2. Actual System Architecture

### Monorepo Topology

- **Root**: `pnpm` workspace with Turborepo orchestration.
- **Applications**:
  - `apps/portal`: Next.js 16.2.6 (Turbopack, App Router, React 19) — the single canonical production web application.
- **Packages**:
  - `@repo/contract`: Zod runtime schemas, TypeScript DTOs, API validation middleware.
  - `@repo/database`: Database types and migration verification.
  - `@repo/redis`: Two-tier caching (L1 in-memory LRU + L2 Redis), stampede prevention via X-Fetch probabilistic early expiration, tag invalidation.
  - `@repo/rate-limiter`: Sliding-window and token-bucket strategies with memory and Redis stores.
  - `@repo/supabase`: SSR client, service-role client, cookie proxy, read-replica routing.
  - `@repo/logger`: Structured logging using Pino with PII redaction.
  - `@repo/theme`: Style Dictionary design tokens, OKLCH color spaces, strict light-mode background.
  - `@repo/ui`: Shared UI primitives and Storybook components.
  - `@repo/utils`: Inngest background job client, client fetcher, offline IndexedDB storage.
  - `@repo/errors`: RFC 7807 compliant problem details and custom error hierarchies.

### Infrastructure & Deployment

- **Web / API Layer**: Vercel (`arch-system` canonical project, region `iad1`).
- **Durable Database**: Supabase PostgreSQL (`mrwhtxbhrzyttlsyuofc.supabase.co`) with Row Level Security, RPC functions, and read replica capabilities.
- **Cache & Telemetry Transit**: Redis (`node-redis` v4.7.1).
- **Background Jobs**: Inngest (`arch-portal`) with 11 registered durable functions.

---

## 3. Redis Architecture

### Client Lifecycle

- Defined in `packages/redis/src/client.ts`.
- **Singleton pattern**: Reuses a single active connection across the Node.js runtime process; in-flight connection promise is shared to prevent thundering-herd connection storms.
- **Reconnection Strategy**: Bounded exponential backoff with max 3 retries: `Math.min(retries * 50, 500)`.
- **Socket Options**: Updated during audit to include `connectTimeout: 5000` to prevent indefinite socket hangs during network partitions.
- **Subscriber Duplication**: `createRedisSubscriber()` calls `baseClient.duplicate()` to avoid blocking command channels.

### Key Namespaces and TTL Registry

Managed via `packages/redis/src/registry.ts`:
| Namespace / Category | Pattern | L1 TTL | L2 TTL | Data Type | Source of Truth | Ownership |
|---|---|---|---|---|---|---|
| `AUTH` | `arch:auth:<id>` | 60s | 3,600s | String (JSON) | PostgreSQL | `CACHE` |
| `METRICS` | `arch:metrics:<dept>:<type>` | 15s | 300s | String (JSON) | PostgreSQL | `CACHE` |
| `SHIFT` | `arch:shift:<dept>:<date>` | 30s | 120s | String (JSON) | PostgreSQL | `CACHE` |
| `AI_MEMORY` | `arch:ai_memory:<session>` | 10s | 60s | String (JSON) | PostgreSQL | `CACHE` |
| `DEPARTMENT` | `arch:dept:<slug>` | 60s | 43,200s (12h) | String (UUID) | PostgreSQL | `CACHE` |
| `EQUIPMENT` | `arch:equipment:<id>` | 30s | 300s | String (JSON) | PostgreSQL | `CACHE` |
| `RATE_LIMIT` | `ratelimit:<identifier>` | N/A | Dynamic window | String / Int | Redis | `TEMPORARY` |
| `TAG_INDEX` | `arch:__tags__:<tag>` | N/A | Key lifetime | Set | Redis | `DERIVED` |
| `SCADA_STATE`| `control-room:scada:state` | Memory | 60s | String | Control Probe | `TEMPORARY` |
| `TELEMETRY` | `telemetry:last:<tag>` | Local Map | 86,400s (24h) | String (Num) | **Redis Only (Risk)** | `MUST PERSIST` |

---

## 4. Redis Professional-Practice Review

| Area                          | Current System State                                                                                                             | Professional Best Practice                                                                                       | Gap / Risk                                                                                      | Recommendation                                                                                                |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Tag Scanning**              | Replaced `redis.keys()` with `redis.scan(cursor, ...)`                                                                           | Redis official docs mandate `SCAN` over `KEYS` in production to prevent blocking the single-threaded event loop. | **Resolved**: Previously blocked entire Redis instance on every FUXA poll.                      | Use `SCAN` with `COUNT: 100` and numeric cursor.                                                              |
| **Telemetry Persistence**     | `telemetry:last:*` keys have 24h TTL with no PostgreSQL dual-write.                                                              | Telemetry used for operational decision-making must either be durable or clearly flagged as ephemeral.           | If Redis is restarted or evicted under memory pressure, all live SCADA state is lost.           | Implement dual-write: write to Supabase `machine_telemetry` table and populate Redis as a read-through cache. |
| **Cache Stampede Prevention** | `XFetchWrapper` with probabilistic early expiration algorithm: $-b \cdot \delta \cdot \ln(\text{rand}()) > \text{ttlRemaining}$. | Vitter's / Optimal Cache Replacement / X-Fetch (Vattani et al., 2015).                                           | High adherence: already implemented in `packages/redis/src/xfetch.ts` and `cacheWrap`.          | Maintain current implementation.                                                                              |
| **L1/L2 Invalidation**        | Tag-based sets (`arch:__tags__:<tag>`) using `SSCAN` and non-blocking `UNLINK`.                                                  | Redis core guidance: avoid `DEL` on large sets or keys; use `UNLINK`. Avoid `SMEMBERS` on high-cardinality tags. | High adherence: `packages/redis/src/invalidation.ts` uses non-blocking `UNLINK` and `SSCAN`.    | Maintain current implementation.                                                                              |
| **Rate Limiter Scripting**    | Token bucket and sliding window using Redis `EVAL` with Lua atomic increments.                                                   | Distributed rate limiting requires atomic check-and-decrement.                                                   | Implemented via `packages/rate-limiter/src/strategies/`.                                        | Maintain current Lua scripts.                                                                                 |
| **Failure Tolerance**         | `getRedisClientSafe()` swallows errors, falling back to L1 in-memory cache and DB.                                               | Cache-aside should fail open; operational/control writes should fail closed.                                     | Route `/api/scada/tags` fails with 500 when Redis is down; cache helpers fail open to database. | Good separation of concerns.                                                                                  |

---

## 5. Security Audit

- **Authentication & RBAC**:
  - Authenticated sessions handled via `@supabase/ssr` with HttpOnly cookies.
  - Role-based access control (RBAC) enforced server-side via `employees` table check in server actions and API routes (e.g. `assertAdmin()` in `/api/admin/data/[table]`).
  - Middleware proxy (`apps/portal/proxy.ts`) gates non-exempt routes and enforces CSP with dynamic cryptographic nonces (`'nonce-${nonce}'`).
- **Secret Scanning**:
  - Verified no plaintext passwords, JWT private keys, or API tokens committed in source.
  - Secret scanning actively enforced via `gitleaks` in `.github/workflows/ci.yml`.
  - Logging layer (`@repo/logger`) explicitly redacts `authorization`, `cookie`, `x-api-key`, `password`, `token`, and `secret`.
- **API Security Vulnerability (Requires Action)**:
  - `/api/telemetry/push`: Unauthenticated endpoint. Accepts both direct telemetry writes and Supabase database webhook payloads without signature verification. Anyone with network access can forge machine RPM, engine temperature, or tire pressure.
  - `/api/scada/tags`: Unauthenticated endpoint returning all active SCADA tags. Polled by FUXA. Requires network-level protection (mTLS, IP whitelist, or internal VPC).

---

## 6. Reliability & Failure Testing

- **Tested Scenarios**:
  - **Redis Unavailable**: `/api/health/redis` returns HTTP 503 `status: degraded`. `/api/scada/tags` returns HTTP 500 `{"error":"Redis down"}`. Application does not crash; L1 cache and database fallback continue serving core portal traffic.
  - **Empty Telemetry Cache**: `/api/scada/tags` returns HTTP 200 with empty array `[]` without error.
  - **Non-Numeric Tag Values**: `/api/scada/tags` falls back gracefully to `type: "string"` for string or status tags (e.g. `"RUNNING"`).
  - **Idempotency & Circuit Breaking**: Control room shift closeout (`/api/control-room/shift-closeout`) enforces `Idempotency-Key` headers and executes atomic PostgreSQL RPC `atomic_shift_closeout`.
  - **SCADA Outbox Drain**: `/api/cron/outbox-drain` uses exponential backoff (2s, 4s, 8s, 16s) with a maximum of 5 retry attempts before shunting to Dead Letter Queue (`failed`).

---

## 7. Observability Audit

- **Prometheus Metrics**:
  - Implemented in `apps/portal/lib/observability/metrics.ts` via `prom-client`.
  - Metrics collected: `shiftCloseoutDuration`, `machineStatusUpdateTotal`, `scadaConnectionStatus`, `hourlyLoadsUpdateDuration`, `xFetchTriggersTotal`, and `xFetchLatency`.
  - Exposed via `/api/metrics/prometheus` with optional `METRICS_SCRAPE_TOKEN` bearer validation.
- **OpenTelemetry Tracing**:
  - Configured in `apps/portal/lib/observability/tracing.ts` with span creation and status tracking (`withAsyncSpan`).
- **Health Probing**:
  - `/api/health/live`: General liveness.
  - `/api/health/redis`: Real Redis `PING` probe returning 200 (healthy) or 503 (degraded).
  - `/api/health/cache`: Cache statistics, hit rates, and L1/L2 breakdown.
  - `/api/health/fuxa`: FUXA SCADA connectivity probe.

---

## 8. Testing & CI/CD Audit

- **Automated Test Suite**:
  - Jest 30 in workspace.
  - **134 test suites passed**, 1 skipped.
  - **882 tests passed**, 14 skipped, 0 failed.
  - Jest `--runInBand --detectOpenHandles` passes cleanly on critical routes without memory or handle leaks.
- **CI/CD Pipelines**:
  - `.github/workflows/ci.yml`: 11 distinct quality gates including Knip (dead code), Syncpack (dependency lint), Policy Check (monorepo boundaries), Gitleaks (secret scan), Trivy (CVE scanner), CodeQL (static AST security), DeepEval (AI compliance), and Playwright E2E.
  - `.github/workflows/deploy.yml`: Quality check gating deployment to Vercel production or Docker on-premises.

---

## 9. Deployment Audit

- **Canonical Architecture Verified**:
  $$\text{Timothy191/Arch-System} \longrightarrow \text{Vercel} \longrightarrow \text{arch-system} \longrightarrow \text{apps/portal}$$
- **Redundant Projects**: Verified `arch-system-portal` project was removed; only canonical `arch-system` exists.
- **Production Status**:
  - Production deployment `dpl_5xriwtXF2Ssm8uyzVjqJAGJ3WJvb` is `READY`.
  - Production aliases: `https://arch-system-8yvcwpkdr-timothyoniel558-9643s-projects.vercel.app` and `https://arch-system-theta.vercel.app`.
  - Vercel Deployment Protection is active (HTTP 401 on unauthenticated external curl; verified working via `vercel curl`).

---

## 10. Production Readiness Scorecard

| Category              | Status                  | Fact-Based Rationale                                                                                                                                                                                        |
| --------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Architecture**      | `READY`                 | Clean monorepo separation, strict dependency direction, Turborepo pipeline caching.                                                                                                                         |
| **Security**          | `READY WITH CONDITIONS` | Strong RLS and session cookie security; but `/api/telemetry/push` lacks webhook authentication.                                                                                                             |
| **Authentication**    | `READY`                 | Server-side Supabase SSR authentication, token refresh proxy, CSRF origin verification.                                                                                                                     |
| **Authorization**     | `READY`                 | Server-side RBAC verified on mutations and table administrative actions.                                                                                                                                    |
| **PostgreSQL**        | `READY`                 | Schema migrations, Row Level Security, parameterized queries, atomic RPC procedures.                                                                                                                        |
| **Redis**             | `REQUIRES ACTION`       | Code upgraded to non-blocking SCAN and bounded timeouts; however, production Vercel lambdas currently lack network connectivity to a cloud Redis instance. Telemetry is Redis-only without durable backing. |
| **APIs**              | `READY`                 | Zod validation via `@repo/contract`, standard RFC 7807 error envelopes, body size limits.                                                                                                                   |
| **SCADA Integration** | `READY WITH CONDITIONS` | FUXA WebAPI reverse-flow pull architecture working; SCAN non-blocking fix deployed.                                                                                                                         |
| **Observability**     | `READY`                 | Prometheus metrics, OpenTelemetry spans, structured Pino logger with PII masking.                                                                                                                           |
| **Reliability**       | `READY`                 | Bounded retries, exponential backoff, circuit breakers on SCADA probes, 5000ms socket timeouts.                                                                                                             |
| **Testing**           | `READY`                 | 882 passing tests; `--detectOpenHandles` verified clean on Redis/SCADA routes.                                                                                                                              |
| **CI/CD**             | `READY`                 | Comprehensive multi-stage GitHub Actions with static security and regression gates.                                                                                                                         |
| **Deployment**        | `READY`                 | Single canonical Vercel project deployed and building cleanly with Next.js 16 / Turbopack.                                                                                                                  |

---

## 11. Prioritized Action Matrix

| Priority | Finding                                      | Evidence                                                                                                                       | Risk                                                                                   | Recommended Change                                                                                                    | Destructive? | Approval Required?                         |
| -------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------ | ------------------------------------------ |
| **P0**   | Vercel production cannot reach Redis server  | `vercel curl /api/health/redis` returns `{"status":"degraded"}` and `/api/scada/tags` returns `Redis connection failed`.       | Live SCADA tags cannot be served on Vercel deployment; cache layer drops to L1 and DB. | Provision Cloud Redis (e.g. Upstash Redis or AWS ElastiCache) and update `REDIS_URL` in Vercel environment variables. | No           | **YES** (Vercel env var mutation)          |
| **P1**   | Redis is sole system of record for telemetry | Code comment in `apps/portal/app/api/telemetry/push/route.ts`: `"Reverse-flow ingest (D2-a) — Redis is the system of record"`. | Complete telemetry loss upon Redis restart or eviction.                                | Modify `/api/telemetry/push` to write through to Supabase `machine_telemetry` table and populate Redis cache.         | No           | **YES** (Architecture change)              |
| **P1**   | `/api/telemetry/push` lacks authentication   | Inspected `apps/portal/app/api/telemetry/push/route.ts` — no header or bearer token validation.                                | Rogue actor can push arbitrary equipment readings.                                     | Require `x-telemetry-secret` or Supabase webhook signature validation.                                                | No           | **YES** (Breaking change for edge pushers) |
| **P2**   | `/api/scada/tags` lacks access control       | Inspected `apps/portal/app/api/scada/tags/route.ts` — open GET route returning all telemetry tags.                             | Public exposure of industrial process metrics.                                         | Restrict via IP allowlist, VPN, or WebAPI secret token configured in FUXA.                                            | No           | **YES** (May break FUXA polling)           |
| **P2**   | Static asset / OTEL build warnings           | Build log outputs `WARNING: OTEL_EXPORTER_OTLP_ENDPOINT is not set at build time`.                                             | Telemetry traces not exported during production build phases.                          | Add valid OTEL collector endpoint to Vercel build environment.                                                        | No           | **YES** (Configuration change)             |

---

## 12. Changes Implemented in this Audit

1. **Installed Permanent Engineering Rules:**
   - Created `.agents/rules/permanent-engineering-rules.md` (19 persistent rules covering production reality, evidence-first, Redis policies, Git safety, and approval boundaries).
2. **Eliminated Redis Blocking Call (`KEYS` $\to$ `SCAN`):**
   - Modified `apps/portal/app/api/scada/tags/route.ts` to replace `redis.keys('telemetry:last:*')` with `redis.scan(cursor, { MATCH: 'telemetry:last:*', COUNT: 100 })` using numeric cursor looping.
   - Updated `apps/portal/app/api/scada/tags/route.test.ts` to mock and assert non-blocking `scan` execution with numeric cursor.
3. **Bounded Redis Socket Timeout:**
   - Modified `packages/redis/src/client.ts` to add `connectTimeout: 5000` to prevent indefinite socket connection hanging during network partitions.
4. **Replaced Fake Health Stub with Real Redis Probe:**
   - Replaced static `degraded = false` in `apps/portal/app/api/health/redis/route.ts` with real `redis.ping()` probe returning HTTP 200 (`healthy`) or HTTP 503 (`degraded`).
   - Updated `apps/portal/app/api/health/redis/route.test.ts` to verify both reachable (200) and unreachable (503) states.
5. **Full Validation & Production Deployment:**
   - Ran `pnpm --filter portal exec jest --runInBand --detectOpenHandles app/api/scada/tags/route.test.ts` (0 open handles, 4/4 passed).
   - Executed full suite: 134 test suites passed, 882 tests passed.
   - Verified zero Biome lint errors and zero TypeScript errors.
   - Deployed canonical project `arch-system` to Vercel production (`dpl_5xriwtXF2Ssm8uyzVjqJAGJ3WJvb`).
   - Verified live endpoints via `vercel curl`.

---

## 13. Actions Requiring Explicit Approval

Per Section 2 (Mandatory Approval Boundary) and Section 15 (Destructive Action Rule), the following actions require explicit user approval before execution:

1. **Provisioning and Updating Production `REDIS_URL`:** Changing Vercel environment variables to point to a cloud-hosted Redis instance (e.g. Upstash).
2. **Modifying Telemetry System of Record:** Changing `/api/telemetry/push` to write directly to PostgreSQL `machine_telemetry` table in addition to Redis.
3. **Enforcing Ingest Authentication on `/api/telemetry/push`:** Requiring authorization tokens that will break any unauthenticated edge devices or Supabase webhooks until reconfigured.
4. **Enforcing Auth on `/api/scada/tags`:** Adding authentication to the SCADA tag polling endpoint, which will break FUXA if FUXA is not configured with matching authentication headers.
