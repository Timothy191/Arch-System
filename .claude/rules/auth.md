# Auth & Authorization

## Proxy (Middleware)

`apps/portal/proxy.ts` handles session refresh, department slug → UUID resolution (cached in Redis), and role-based route restrictions.

- **Proxy matcher**: `matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]` — static assets and `_next` internals bypass the proxy entirely.
- **Hardware API exemption**: `/api/c66` endpoints are exempt from authentication in `proxy.ts`.

## Auth Resolution Flow

Supabase session → `employees` table lookup (`role`, `department_id`, `accessible_departments`) → role/department gating. The `employees` table is the source of truth for authorization, not Supabase Auth metadata.

## Server Actions

Import auth via `@repo/supabase/server` (`createServerSupabaseClient`). Always validate the user at the top of every Server Action.

## Server Components

Use `getUserSafely()` from `@repo/supabase/server` instead of raw `supabase.auth.getUser()`. It catches refresh-token errors gracefully and returns `null` rather than throwing, preventing Server Component crashes on stale sessions.

## Row-Level Security

RLS must be enabled on every new Supabase table. No exceptions.

## Restricted Routes

Roles like `control_room_operator`, `admin`, and `supervisor` gate access to specific routes. See `RESTRICTED_ROUTES` in `proxy.ts`.
