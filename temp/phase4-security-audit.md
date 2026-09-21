# Phase 4 Security Audit Report

## Next.js Monorepo Business Portal

**Date:** 2026-09-21
**Auditor:** Security Auditor Specialist
**Scope:** `packages/supabase/src/`, `apps/portal/lib/api/`, `infra/docker/`, `SECURITY.md`, `packages/database/tests/`, `packages/rate-limiter/src/`, `apps/portal/app/api/`

---

## Executive Summary

| Severity | Count |
| -------- | ----- |
| CRITICAL | 4     |
| HIGH     | 6     |
| MEDIUM   | 5     |
| LOW      | 3     |
| INFO     | 2     |

**Overall Assessment:** The codebase has strong foundational security controls (RLS policies, role-based access control, CSP), but contains **critical hardcoded secrets**, **JWT validation pattern deviations**, **service role client misuse in API routes**, and **rate limiter bypass vectors** that require immediate remediation.

---

## 1. Service Role Key Management Analysis

### File: `packages/supabase/src/service-role.ts`

**Finding: PASS (with caveat)**

The `createServiceRoleClient()` function correctly reads `SUPABASE_SECRET_KEY` from server-side environment variables only. The `SUPABASE_SERVICE_KEY` fallback is for backward compatibility and is also server-side only.

```typescript
const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_KEY;
```

**Status:** ✅ `SUPABASE_SECRET_KEY` is never exposed client-side — it reads exclusively from `process.env`.

**Caveat:** The `NEXT_PUBLIC_SUPABASE_URL` fallback on line 14 means if `SUPABASE_URL` is not set, the URL comes from a `NEXT_PUBLIC_` prefixed env var, which IS exposed client-side. While the URL itself is less sensitive than the key, this creates a potential information leak vector.

**Recommendation:** Remove `NEXT_PUBLIC_SUPABASE_URL` fallback or ensure it only contains the public project URL (no sensitive info).

---

## 2. Middleware JWT Validation Correctness

### File: `packages/supabase/src/middleware.ts`

**Finding: MIXED — Documentation correct, implementation deviates**

The file's header comments correctly state the Supabase-recommended pattern:

- ✅ "Use `getClaims()` to verify identity (validates JWT signature locally)"
- ✅ "Never trust `getSession()` for authorization decisions"
- ✅ "Use `getUser()` only when you need fresh user data from Auth server"

**CRITICAL DEVIATION:** The `refreshSession()` function (lines 77-93) uses `supabase.auth.getUser()` instead of `getClaims()`:

```typescript
const { error } = await supabase.auth.getUser(); // Should be getClaims()
```

Per Supabase docs, `getUser()` makes a **network call to the Auth server** and is slower. `getClaims()` validates the JWT signature **locally via WebCrypto API**. While `getUser()` is acceptable for token refresh (it revalidates), the comments explicitly state `getClaims()` should be used.

### File: `packages/supabase/src/proxy.ts`

**Same deviation:** `updateSession()` (line 85) uses `supabase.auth.getUser()` instead of `getClaims()`.

### File: `packages/supabase/src/server.ts`

**Same deviation:** `getUserSafely()` (line 167) uses `supabase.auth.getUser()` instead of `getClaims()`.

**Additional Concern:** The `createServerSupabaseClient()` function in `server.ts` and the middleware/proxy files all use a **hardcoded fallback JWT anon key**:

```typescript
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  ...
  || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlZmF1bHQiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYwMDAwMDAwMCwiZXhwIjoyMDAwMDAwMDAwfQ.nEt4Hfb3DGQtFPofXNRWUBX6zXyTXTJvcb9xLoBGDg";
```

**This is a CRITICAL finding.** This hardcoded JWT is a valid Supabase anon key for the default Supabase project. If this code is deployed and the env vars are not properly set, **anyone can use this key to authenticate as an anonymous user** with full access to the database.

### Files with hardcoded JWT fallback

- `packages/supabase/src/middleware.ts` (line 26)
- `packages/supabase/src/proxy.ts` (lines 42, 122)
- `packages/supabase/src/server.ts` (line 83)

**Severity: CRITICAL**

---

## 3. Access Control Audit

### Files Audited

- `apps/portal/app/(departments)/access-control/actions.ts`
- `apps/portal/app/(departments)/access-control/card-actions/actions.ts`
- `apps/portal/app/(departments)/access-control/qr-codes/actions.ts`
- `apps/portal/app/(departments)/access-control/print-cards/actions.ts`
- `apps/portal/lib/dept-context.ts`

### `assertAccessControlRole()` — Found in 4 action files

All four implementations follow the same pattern:

1. Call `createServerSupabaseClient()` and `supabase.auth.getUser()` to get the user
2. Query `employees` table for the user's role
3. Check `["admin", "access_control"].includes(employee.role)`

**Status:** ✅ Properly implemented role-based access control.

**Finding:** The `assertAccessCardActionsRole()` function in `card-actions/actions.ts` (line 34-55) only selects `role` from employees, not `department_id` — unlike the other `assertAccessControlRole()` functions which select `role, department_id`. This means card actions functions don't have department context available, but this is not a security issue per se.

### `assertAccessControlRole()` in `access-control/actions.ts` (line 56-77)

This function also returns `employee` with `department_id`, which is used to scope operations like `registerVisitor()` (line 465) that sets `department_id: employee.department_id`.

**Status:** ✅ Properly scopes writes to the employee's department.

### `requireDepartment()` in `dept-context.ts` (line 56-61)

```typescript
export function requireDepartment(departmentSlug: string, allowed: string | string[]) {
  const allowedList = Array.isArray(allowed) ? allowed : [allowed];
  if (!allowedList.includes(departmentSlug)) {
    notFound();
  }
}
```

**Status:** ✅ Client-side department validation. Uses `notFound()` from `next/navigation` which throws a 404. This is purely a UX control — it does NOT replace server-side authorization (which is handled by `assertAccessControlRole`).

**Note:** `requireDepartment` is a client-side check only (called in page components). It prevents navigation to wrong department pages but does NOT protect API routes. API routes have their own `assertAccessControlRole` / `assertAdmin` checks.

---

## 4. Privilege Escalation Vectors

### 4.1 Service Role Client Bypassing RLS in API Routes

**CRITICAL — `apps/portal/app/api/admin/data/[table]/route.ts`**

The admin data API route uses `createServiceRoleClient()` (line 291, 353, 403) to directly query and mutate operational tables. The service role client **bypasses all RLS policies**.

```typescript
const serviceRole = createServiceRoleClient();
const query = serviceRole.from(table).select("*", { count: "exact" })...
```

The route does have an `assertAdmin()` check (line 251-268) that verifies the user's role is `"admin"`. However:

1. **The `assertAdmin()` function uses `createServerSupabaseClient()`** — this correctly enforces RLS
2. **But the actual data operations use `createServiceRoleClient()`** — which bypasses RLS entirely
3. **If `assertAdmin()` is somehow bypassed or if there's a logic error**, the service role client would allow unrestricted access to ALL operational tables

**Mitigation:** The `OPERATIONAL_TABLES` whitelist (line 195-227) provides a second layer of defense, limiting which tables can be queried. But a service role client with access to whitelisted tables has full CRUD capabilities without RLS enforcement.

### 4.2 C66 Scanner Endpoint Uses Service Role

**HIGH — `apps/portal/app/api/c66/route.ts`**

Line 174: `const supabase = createServiceRoleClient();`

The C66 hardware scanner endpoint uses a service role client, bypassing RLS entirely. Access control is based on:

- `x-scanner-token` header matching `SCANNER_API_KEY` env var
- `x-scanner-source` header matching `ALLOWED_SCANNER_SOURCES`

**Bypass Vector:** The token comparison uses `!==` (line 160): `if (!expectedToken || token !== expectedToken)`. This is **not a timing-safe comparison**. An attacker could use timing analysis to enumerate the token.

**Recommendation:** Use `timingSafeEqual` (as already used in `rate-limit-middleware.ts` line 276) for the scanner token comparison.

### 4.3 Login Route Exposes Session Tokens

**HIGH — `apps/portal/app/api/auth/login/route.ts`**

Lines 219-235 return the full session object including `access_token` and `refresh_token` in the JSON response:

```typescript
return NextResponse.json({
  success: true,
  redirectTo: "/",
  session: data?.session
    ? {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        ...
      }
    : undefined,
});
```

**Risk:** While this is intended for "client-side cookie preservation in proxied webview environments" (line 104), it exposes tokens in the response body. If the response is logged, cached, or intercepted, tokens could be compromised.

**Recommendation:** Only return session tokens if explicitly needed for the webview proxy flow. Otherwise, rely on HttpOnly cookies set by Supabase.

### 4.4 Audit Route — Path Traversal Potential

**MEDIUM — `apps/portal/app/api/audit/route.ts`**

The `logId` parameter from `searchParams.get("log")` is used directly in a filesystem path:

```typescript
const logDir = logId === "latest" ? path.join(auditRoot, "latest") : path.join(auditRoot, logId);
```

An attacker could potentially use `../` traversal to read arbitrary files if the audit root directory is accessible.

**Mitigation:** The `logId` is only used within `path.join(auditRoot, ...)` and `fs.existsSync` checks. Node.js `path.join` does not allow escaping the base directory with `..` if the base is absolute, so this is likely **low risk** in practice. But input validation would be a defense-in-depth improvement.

---

## 5. OWASP ZAP Status

### File: `infra/docker/compose.security.yml`

**Finding: OWASP ZAP is configured but NOT automatically integrated into CI**

The `compose.security.yml` defines two services:

- `zap-baseline`: Baseline scan against `http://localhost:3000`
- `zap-full`: Full scan against `http://localhost:3000`

Both require the application to already be running (`network_mode: host`). They are manual-only (`profiles: [security]`, `profiles: [security-full]`).

### CI Integration: `.github/workflows/dast.yml`

The `dast.yml` workflow **does** run OWASP ZAP, but uses the `zaproxy/action-baseline@v0.14.0` GitHub Action against `https://staging.arch-system.internal` — **not the compose file**.

**Gap:** The compose file's `zap-full` configuration is never used in CI. The DAST workflow only runs a baseline scan. There is no automated full ZAP scan in the pipeline.

**Also:** The `compose.security.yml` is not referenced in any CI workflow file. It appears to be intended for local/manual use only.

**Recommendation:**

1. Add the full ZAP scan to the DAST workflow or a separate scheduled job
2. Reference `compose.security.yml` from CI or document its manual-only status

---

## 6. Sentry Configuration Audit

### `apps/portal/sentry.client.config.ts`

**Finding: MEDIUM — Uses `NEXT_PUBLIC_SENTRY_DSN`**

Both client and server configs use `process.env.NEXT_PUBLIC_SENTRY_DSN`. Since this is a `NEXT_PUBLIC_` prefixed env var, the Sentry DSN is **exposed to the client**.

For Sentry, the client-side DSN is typically public information (it only allows sending events, not reading them), so this is **not a critical vulnerability**. However, the server config should use a separate, server-only DSN for more sensitive error reporting.

**Good:**

- `beforeSend` in client config filters "password" and "token" in error values
- `beforeSend` in server config scrubs `authorization`, `cookie`, `x-internal-secret` headers
- `tracesSampleRate` is 0.1 in production (10%)
- `replaysSessionSampleRate: 0` (session replays disabled)

**Issues:**

- Both configs use the same DSN
- `environment` in client config uses `NEXT_PUBLIC_VERCEL_ENV` which may leak environment info

---

## 7. Rate Limiter Bypass Vectors

### File: `packages/rate-limiter/src/`

**Finding: 3 BYPASS VECTORS identified**

#### 7.1 `DISABLE_RATE_LIMIT` Environment Variable (HIGH)

In `apps/portal/lib/api/rate-limit-middleware.ts` line 207:

```typescript
if (process.env.DISABLE_RATE_LIMIT === "true") {
  return handler();
}
```

**This completely disables rate limiting** for all requests when the env var is set. If this is accidentally enabled in production, all rate limiting is bypassed.

#### 7.2 IP Whitelist Bypass (MEDIUM)

Line 216-219:

```typescript
const clientIp = getClientIp(request);
if (isIpWhitelisted(clientIp)) {
  return handler();
}
```

The whitelist is configured via `RATE_LIMIT_IP_WHITELIST` env var (default: `127.0.0.1,::1,::ffff:127.0.0.1`). Any IP on this list bypasses all rate limiting. If the whitelist is misconfigured, external IPs could bypass rate limits.

**Additionally:** `getClientIp()` (line 126) trusts the `x-forwarded-for` header:

```typescript
const forwarded = request.headers.get("x-forwarded-for");
const realIp = forwarded?.split(",")[0]?.trim() || ...;
```

**This is spoofable** if the application is behind a reverse proxy that doesn't strip the `x-forwarded-for` header. An attacker can set `x-forwarded-for: 127.0.0.1` to bypass rate limiting.

#### 7.3 `skipForInternal` Timing-Safe Comparison (LOW)

Line 268-280: The `skipForInternal` function compares `x-internal-secret` header with env var using `timingSafeEqual`. However, it first checks `internalSecret.length !== expected.length` which leaks the length of the secret if the attacker can probe the function.

**Also:** The `x-internal-secret` header is compared against an environment variable. If this secret leaks, anyone can bypass rate limiting for "internal" requests.

#### 7.4 Strategy Implementation Issues

**Memory Store (`MemoryStore`):** The `MemoryStore` in `rate-limit-middleware.ts` uses a simple `Map` that is **not shared across server instances**. In a multi-instance deployment, rate limiting would be ineffective.

**Token Bucket Fallback:** In `packages/rate-limiter/src/strategies/token-bucket.ts`, when `store.eval` fails (line 98-99), the code falls back to JavaScript read-modify-write. This fallback is **not atomic** and could be exploited for race conditions.

---

## 8. Security Migrations Audit

### `057_security_p0_fixes.sql` — PASS ✅

- Hardcodes default role to `'operator'` in `handle_new_user()` trigger — prevents role elevation via `raw_user_meta_data.role`
- Creates `enforce_employee_update_constraints()` trigger that locks `role`, `department_id`, `accessible_departments`, `auth_id` for non-admins
- Hardens `employees_update_self_or_admin` RLS policy with `WITH CHECK` clause

**No issues found.**

### `094_security_linter_hardening.sql` — PASS ✅

- Moves `vector` extension from `public` to `extensions` schema
- Hardens function `search_path` to `public, pg_temp` (prevents function hijacking)
- Revokes `EXECUTE` on internal trigger functions (`handle_new_user`, `process_audit_log`) from PUBLIC/anon
- Revokes `EXECUTE` on helper functions (`is_admin`, `has_department_access`, `user_department_id`) from PUBLIC/anon, grants only to `authenticated` and `service_role`
- Hardens RLS insert policies with `WITH CHECK` clauses

**No issues found.**

### `095_optimize_rls_initplan_and_indexes.sql` — PASS ✅

- Wraps `auth.uid()` calls in `SELECT` subqueries for RLS optimization (InitPlan)
- Drops duplicate index on `delay_categories`
- All policies use `SELECT public.is_admin()` and `SELECT public.has_department_access()` pattern for query optimization
- Consistent `WITH CHECK` clauses on all insert/update policies

**No issues found.**

### `043_admin_data_lockdown.sql` — PASS ✅ with minor concern

- Makes most operational tables admin-only for UPDATE/DELETE
- Retains department-based access for `hourly_loads` and `excavator_activity` (operators)
- Keeps reporter-only edit for `safety_incidents` and `documents`
- Strips supervisor access from `webhook_endpoints`

**Minor Concern:** The `employees` table update policy (line 337-343) allows any authenticated user to update their own record. This is intentional but should be monitored for privilege escalation through profile updates.

---

## 9. Secrets Rotation Audit

### `packages/database/migrations/085_secrets_rotation_log.sql`

**Finding: ACCEPTABLE**

- Creates `secrets_rotation_log` table with proper columns
- RLS enabled with `service_can_insert` policy (`WITH CHECK (true)` — allows service_role insert)
- `authenticated_can_read` policy allows all authenticated users to read
- Proper indexes on `secret_name`, `status`, `rotated_at`

**Concern:** The `authenticated_can_read` policy uses `USING (true)` which allows **any authenticated user** to read the secrets rotation log. This may be overly permissive — rotation logs could contain sensitive information about when secrets were rotated. Consider restricting to admin-only or service_role-only read access.

---

## 10. Critical/High Security Vulnerabilities List

### CRITICAL

| #   | Vulnerability                                     | Location                                              | Description                                                                                                                                                                     |
| --- | ------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | **Hardcoded JWT Anon Key**                        | `middleware.ts:26`, `proxy.ts:42,122`, `server.ts:83` | Hardcoded Supabase anon key `"eyJhbGciOiJIUzI1NiIsInR5cCI6..."` serves as fallback when env vars are unset. This key grants anonymous access to the database.                   |
| C2  | **Service Role Client Bypasses RLS in Admin API** | `api/admin/data/[table]/route.ts:291,353,403`         | `createServiceRoleClient()` bypasses all RLS policies. Combined with `assertAdmin()`, this creates a single point of failure where any auth bypass grants full database access. |
| C3  | **Login Response Exposes Session Tokens**         | `api/auth/login/route.ts:219-235`                     | `access_token` and `refresh_token` returned in JSON response body. Could be logged, cached, or intercepted.                                                                     |
| C4  | **C66 Scanner Token Not Timing-Safe**             | `api/c66/route.ts:160`                                | `token !== expectedToken` is not timing-safe. An attacker could use timing analysis to enumerate the scanner API key.                                                           |

### HIGH

| #   | Vulnerability                                                 | Location                                                 | Description                                                                                                 |
| --- | ------------------------------------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| H1  | **Rate Limiter `DISABLE_RATE_LIMIT` Bypass**                  | `rate-limit-middleware.ts:207`                           | `process.env.DISABLE_RATE_LIMIT === "true"` completely disables all rate limiting.                          |
| H2  | **`x-forwarded-for` Spoofing Bypasses Rate Limit**            | `rate-limit-middleware.ts:126-129`                       | IP is extracted from `x-forwarded-for` header without validation. Attacker can spoof IP to whitelist.       |
| H3  | **Middleware/Proxy Use `getUser()` Instead of `getClaims()`** | `middleware.ts:81`, `proxy.ts:85`, `server.ts:167`       | Deviates from documented Supabase pattern. `getUser()` makes network calls instead of local JWT validation. |
| H4  | **Service Role Client in C66 Endpoint**                       | `api/c66/route.ts:174`                                   | `createServiceRoleClient()` bypasses RLS for hardware scanner endpoint.                                     |
| H5  | **Audit Route Path Traversal Potential**                      | `api/audit/route.ts:33`                                  | `logId` from query params used directly in filesystem path.                                                 |
| H6  | **Sentry DSN Exposed Client-Side**                            | `sentry.client.config.ts:4`, `sentry.server.config.ts:4` | Both use `NEXT_PUBLIC_SENTRY_DSN`. Should use separate server-only DSN.                                     |

### MEDIUM

| #   | Vulnerability                                      | Location                             | Description                                                                                    |
| --- | -------------------------------------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------- |
| M1  | **OWASP ZAP Full Scan Not in CI**                  | `compose.security.yml`, `dast.yml`   | Only baseline ZAP scan in CI. Full scan available only manually via compose file.              |
| M2  | **Secrets Rotation Log Read Access Too Broad**     | `085_secrets_rotation_log.sql:26-29` | `authenticated_can_read` allows any authenticated user to read rotation logs.                  |
| M3  | **`requireDepartment` is Client-Side Only**        | `dept-context.ts:56-61`              | Department validation is purely client-side (calls `notFound()`). Does not protect API routes. |
| M4  | **Token Bucket Non-Atomic Fallback**               | `token-bucket.ts:98-99`              | When `store.eval` fails, falls back to non-atomic JavaScript read-modify-write.                |
| M5  | **`getClientIdentifier` Trusts `x-forwarded-for`** | `rate-limit-middleware.ts:183-184`   | Same spoofing issue as H2 but for rate limit identification.                                   |

### LOW

| #   | Vulnerability                                | Location                       | Description                                                                     |
| --- | -------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------- |
| L1  | **`skipForInternal` Length Leak**            | `rate-limit-middleware.ts:272` | `internalSecret.length !== expected.length` leaks secret length.                |
| L2  | **`NEXT_PUBLIC_SUPABASE_URL` Fallback**      | `service-role.ts:14`           | Service role URL can come from `NEXT_PUBLIC_` env var, which is client-exposed. |
| L3  | **Memory Store Not Shared Across Instances** | `rate-limit-middleware.ts:147` | In-memory singleton doesn't work across server instances.                       |

### INFO

| #   | Observation                                         | Location             | Description                                                                                                                                    |
| --- | --------------------------------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| I1  | **CI Uses Dummy Secrets**                           | `ci.yml:168-177`     | CI workflow sets `NEXT_PUBLIC_SUPABASE_ANON_KEY: dummy-anon-key-for-ci` etc. This is acceptable for CI but should never be used in production. |
| I2  | **No `.github/workflows/` YAML for Security Scans** | `.github/workflows/` | DAST, security-audit jobs exist but OWASP ZAP full scan is missing from automated pipeline.                                                    |

---

## Remediation Priority

### Immediate (CRITICAL)

1. **Remove hardcoded JWT fallback keys** from `middleware.ts`, `proxy.ts`, `server.ts`. Fail hard if env vars are missing.
2. **Replace `createServiceRoleClient()` with `createServerSupabaseClient()`** in `api/admin/data/[table]/route.ts` and `api/c66/route.ts` where possible, or add additional authorization checks.
3. **Remove session tokens from login response** or restrict to webview proxy flow only.
4. **Use `timingSafeEqual` for C66 scanner token** comparison.

### Short-term (HIGH)

5. **Remove `DISABLE_RATE_LIMIT` bypass** or add a CI guard to prevent it from being set in production.
6. **Validate `x-forwarded-for`** or use a trusted proxy header library.
7. **Replace `getUser()` with `getClaims()`** in middleware, proxy, and server functions per Supabase docs.

### Medium-term (MEDIUM)

8. **Add OWASP ZAP full scan to CI pipeline** via `zaproxy/action-full-scan@v0.14.0` or reference the compose file.
9. **Restrict `secrets_rotation_log` read access** to admin/service_role only.
10. **Add server-side department validation** to API routes that use `requireDepartment`.

---

_End of Phase 4 Security Audit Report_
