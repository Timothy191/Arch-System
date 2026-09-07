# apps/portal/app/api/auth/

<!-- Route group: apps/portal/app/api/auth -->

Current known route: `login/route.ts` → `POST /api/auth/login`.

## Responsibility

- Provide portal authentication API surface under `/api/auth`.
- For `login`, accept email/password, enforce request-shape and origin/content-type guards, delegate auth to Supabase, and return minimal JSON outcomes.
- Keep session handling server-side via Supabase cookies; responses do not expose tokens.

## Design

- Next.js App Router route handler exporting `POST`.
- Security layering: content-type check → production-only CSRF origin/referer validation → IP-based rate limiting → Supabase auth call.
- Rate limiting via `withRateLimit` with a custom per-route window: 5 requests per 15 minutes per IP.
- Error mapping normalizes upstream failures, rate limits, invalid credentials, malformed JSON, and network/timeout errors into stable HTTP status codes.

## Flow

1. Reject non-`application/json` requests with `415`.
2. In production, validate `Origin`/`Referer` against `NEXT_PUBLIC_APP_URL`; reject mismatches with `403`.
3. Apply rate limit; reject excess attempts with `401` messaging from the limiter path.
4. Parse JSON body and require `email` and `password`; missing fields return `400`.
5. Call `supabase.auth.signInWithPassword({ email, password })`.
6. Map Supabase errors:
   - upstream/network/auth-service failures → `503`
   - rate-limit signals → `429`
   - invalid credentials → `401`
7. On success, return `{ success: true, redirectTo: "/" }` with `200`; Supabase sets session cookies server-side.
8. Unhandled exceptions become `400` for malformed JSON or `503`/`500` for network/internal failures.

## Integration

- Depends on `@repo/supabase/server` for `createServerSupabaseClient()`.
- Depends on `@repo/redis` indirectly through `withRateLimit` for IP-rate state.
- Connected to portal auth UX: successful login is intended to redirect to `/`.
- Tests mock Supabase and Redis to cover content-type, missing fields, success, invalid credentials, rate limiting, upstream 500, and network failure paths.
