# apps/portal/app/api/auth/

<!-- Route group: apps/portal/app/api/auth -->

Current known route: `login/route.ts` → `POST /api/auth/login`.

## Responsibility

- Provide the portal authentication API surface under `/api/auth`.
- For `login`, accept email/password, enforce request-shape and origin/content-type guards, delegate authentication to Supabase, and return minimal JSON outcomes.
- Keep session handling server-side via the Supabase SSR client and cookies; responses never expose access tokens, refresh tokens, or the complete session object.

## Design

- Next.js App Router route handler exporting `POST`.
- Security layering: content-type check → production-only CSRF origin/referer validation → IP-based rate limiting → Supabase auth call.
- Rate limiting via `withRateLimit` with a custom per-route window: 5 requests per 15 minutes per IP.
- Error mapping normalizes upstream failures, rate limits, invalid credentials, malformed JSON, and network/timeout errors into stable HTTP status codes.
- Credential values are type-checked before authentication and are never logged.

## Flow

1. Reject non-`application/json` requests with `415`.
2. In production, validate `Origin`/`Referer` against `NEXT_PUBLIC_APP_URL`; reject mismatches with `403`.
3. Apply rate limiting before the Supabase authentication call.
4. Parse JSON and require string `email` and `password`; missing or invalid fields return `400`.
5. Call `supabase.auth.signInWithPassword({ email, password })`.
6. Map Supabase errors:
   - upstream/network/auth-service failures → `503`
   - rate-limit signals → `429`
   - invalid credentials → `401`
7. On success, return only `{ success: true, redirectTo: "/" }` with `200`. Supabase SSR writes the authenticated session to server-side cookies.
8. Never serialize `access_token`, `refresh_token`, or the Supabase `session` object into the response.
9. Unhandled exceptions become `400` for malformed JSON or `503`/`500` for network/internal failures.

## Integration

- Depends on `@repo/supabase/server` for `createServerSupabaseClient()`.
- Depends on `@repo/redis` indirectly through `withRateLimit` for IP-rate state.
- Connected to portal auth UX: successful login returns a safe redirect instruction; browser authentication state remains cookie-based.
- Logout is implemented separately as the `logout()` server action in `apps/portal/app/actions.ts`, which calls `supabase.auth.signOut()` and redirects to `/login`.
- Tests cover request validation, credential failures, rate limiting, upstream/network failures, and the invariant that successful login responses never contain session tokens.

## Session security contract

See `docs/security/session-management-spec.md` for the full session lifecycle, cookie, authorization, reauthentication, invalidation, caching, redirect-safety, observability, and test requirements.
