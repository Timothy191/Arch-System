# Session Management Security Specification

**Status:** Proposed implementation baseline  
**Owner:** Jules  
**Scope:** Arch-System portal authentication, session lifecycle, authorization boundaries, cookies, logout, recovery, and session-related testing.

## 1. Purpose

Define one authoritative session-management contract for the Next.js portal and Supabase Auth integration. The goal is to keep authentication state server-controlled, minimize credential/session exposure, make lifecycle behavior explicit, and provide testable security requirements.

## 2. Current architecture

- Next.js App Router portal.
- Supabase Auth provides the authenticated identity and token lifecycle.
- `@supabase/ssr` stores the auth session in cookies through the server client.
- Portal proxy refreshes/verifies the authenticated user before protected navigation and applies role/department authorization.
- Redis is used for login rate limiting and employee/department caching; Redis is not the source of truth for authentication.
- Server actions use the server Supabase client and explicitly sign out through `supabase.auth.signOut()`.

## 3. Session invariants

- [x] The browser must not receive access or refresh tokens in a JSON response.
- [x] Server-side authentication uses the Supabase SSR client and cookies.
- [x] Protected routes must enforce authentication server-side.
- [x] Authorization must be derived from authoritative employee data, not client-provided role values.
- [x] Logout must invalidate the Supabase session and redirect to login.
- [ ] Password changes/recovery must explicitly invalidate or rotate affected sessions according to the selected Supabase Auth policy.
- [ ] High-risk account changes must require reauthentication.
- [ ] Session lifetime policy must be documented against the deployed Supabase Auth configuration.

## 4. Cookie requirements

Session cookies are security credentials and must be treated as sensitive data.

Required production properties:

- `Secure=true` so session cookies are transmitted only over HTTPS.
- `HttpOnly=true` for cookies that do not require browser JavaScript access.
- `SameSite=Lax` as the default portal policy; use `Strict` where compatible with the required login/recovery flows.
- `Path=/` for the host-wide session cookie.
- No broad `Domain` attribute unless cross-subdomain authentication is an explicit requirement.
- Prefer a `__Host-`-style cookie where the underlying auth-cookie implementation permits it without breaking Supabase SSR cookie chunking.
- Explicit expiration/max-age must align with the server-side session policy rather than silently creating an unnecessarily long-lived browser session.

The application must not copy a session token into localStorage, sessionStorage, URL parameters, logs, analytics payloads, or application telemetry.

## 5. Authentication lifecycle

### Login

1. Accept only the intended JSON request shape.
2. Validate the request origin in production.
3. Apply IP/account abuse controls.
4. Authenticate with Supabase Auth.
5. Let the server-side Supabase client establish the session cookie.
6. Return only non-sensitive outcome metadata such as `{ success, redirectTo }`.
7. Never serialize the access token, refresh token, or complete session object into the response.
8. On authentication state elevation, rely on the auth provider's session issuance/rotation rather than reusing a pre-authenticated identifier.

### Normal requests

1. Check for a candidate auth cookie cheaply where appropriate.
2. Validate the authenticated identity server-side.
3. Refresh the session through the SSR client when required.
4. Apply role/department authorization server-side.
5. Never trust client-side navigation state as authorization.

### Logout

1. Call `supabase.auth.signOut()` server-side.
2. Allow the SSR client to clear/revoke the session cookies.
3. Redirect to `/login`.
4. Do not leave a cached authenticated response accessible after logout.
5. Subsequent protected requests must return to login.

### Expiration / invalid refresh token

- Treat invalid or expired refresh credentials as unauthenticated.
- Clear the invalid session through the auth client where possible.
- Evict associated authentication/employee cache entries.
- Redirect to login without exposing token contents or upstream auth errors.

## 6. Authorization boundary

Authentication answers **who is signed in**. Authorization answers **what that identity may access**.

- `auth.uid()` / authenticated user identity is the identity boundary.
- `public.employees.auth_id` maps identity to business role and department data.
- PostgreSQL RLS remains the final data-layer authorization boundary.
- Proxy route gating is a UX and request-routing control, not a replacement for RLS.
- Admin/service-role operations must remain server-only.
- Client-supplied role, department, employee ID, or access flags must never override authoritative server/database state.

## 7. Session lifetime policy

The deployed environment must explicitly document:

- Idle timeout.
- Absolute session lifetime.
- Refresh-token lifetime.
- Rotation behavior.
- Maximum concurrent sessions, if enforced.
- Behavior after password reset/change.
- Behavior after employee deactivation.
- Behavior after role/department changes.
- Behavior after suspected compromise.

Do not invent application-side timeouts that conflict with Supabase Auth. Prefer the identity provider's supported session controls and document the effective configuration.

## 8. Reauthentication triggers

Require a fresh authentication challenge for sensitive actions where the existing session alone is insufficient. Candidate triggers include:

- Password change.
- Email/account identity change.
- MFA/trusted-device changes.
- Privilege elevation.
- Recovery completion.
- Other high-impact administrative operations defined by the business security policy.

After a privilege change, rotate/renew the authenticated session as required by the identity provider to prevent session fixation.

## 9. Session invalidation events

The application must have an explicit policy for:

- User logout.
- Refresh-token failure.
- Account deactivation.
- Password reset/change.
- Employee role change.
- Employee department/access change.
- Suspected session theft.
- Security incident response.

For business authorization changes, RLS must take effect immediately even if an application cache contains stale employee metadata. Authentication/authorization caches therefore require bounded TTLs and explicit invalidation on administrative changes.

## 10. Redirect safety

Post-login and expired-session redirects must:

- Accept only internal relative paths.
- Reject protocol-relative paths (`//...`).
- Reject encoded bypasses after decoding/canonicalization.
- Reject `javascript:`, `data:`, `vbscript:` and external absolute URLs.
- Avoid redirect loops involving `/login`.

The same validation rule should be reused rather than maintaining multiple weaker redirect implementations.

## 11. Error handling and observability

- Use generic credential-failure messages.
- Do not disclose whether a particular account exists.
- Do not log passwords, access tokens, refresh tokens, authorization headers, cookies, or complete Supabase session objects.
- Authentication telemetry may record outcome, latency, route, coarse failure category, and request correlation ID.
- Avoid putting raw upstream authentication error messages into browser-visible responses when they reveal sensitive implementation details.

## 12. Caching rules

- Authentication identity is authoritative at the auth provider.
- Employee role/department data may be cached only with bounded TTL and explicit invalidation paths.
- A cache miss must fail safely to the authoritative database lookup.
- Redis failure must not grant access.
- Cached authorization data must never bypass PostgreSQL RLS.
- Session/token values must not be stored in the general-purpose application cache.

## 13. Required test matrix

### Unit/API

- [x] Wrong content type rejected.
- [x] Missing credentials rejected.
- [x] Invalid credentials return generic `401`.
- [x] Auth-provider rate limiting returns `429`.
- [x] Upstream auth failure returns `503`.
- [x] Malformed JSON returns `400`.
- [ ] Successful login response contains no access token.
- [ ] Successful login response contains no refresh token.
- [ ] Successful login response contains no serialized session object.
- [ ] Production origin validation rejects mismatched origins.
- [ ] Redirect validation rejects encoded/external redirect targets.

### Browser/E2E

- [x] Protected routes redirect unauthenticated users to login.
- [x] Session persists across normal navigation/reload.
- [x] Logout prevents access to protected routes.
- [x] Separate browser contexts do not share session state.
- [ ] Production session cookies are `HttpOnly` and `Secure`.
- [ ] Production session cookies use the intended `SameSite` policy.
- [ ] Session expiration returns the user to login.
- [ ] Invalid refresh credentials cannot retain authenticated access.
- [ ] Sensitive account changes require reauthentication where policy requires it.

## 14. Review gates

Before merging session changes:

- [ ] No credential/session material appears in response bodies.
- [ ] No credential/session material appears in logs or telemetry.
- [ ] Cookie flags are verified from an actual HTTPS response in an integration environment.
- [ ] Auth and authorization are tested independently.
- [ ] RLS remains enabled and is covered by database/security tests.
- [ ] Logout and invalid-refresh paths are covered.
- [ ] Redirect validation has negative tests for encoded bypasses.
- [ ] Typecheck, lint, unit tests, and relevant E2E tests pass.
- [ ] Supabase Auth session configuration has been checked against the deployed environment.
- [ ] Any intentional deviation from this specification is documented in the PR.

## 15. Research basis

This specification follows established guidance from OWASP Session Management and Authentication guidance and current browser cookie security requirements. In particular, session identifiers should be protected with appropriate cookie flags, session identifiers should be renewed after privilege changes, absolute/renewal lifetime controls should be explicit, and high-risk events should trigger reauthentication where appropriate.

References:

- OWASP Session Management Cheat Sheet
- OWASP Authentication Cheat Sheet
- MDN `Set-Cookie` reference and secure cookie implementation guidance
- Supabase SSR/server-side authentication documentation
