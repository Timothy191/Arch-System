# Arch-System — Complete Production Overhaul Plan (cont.)

## 2. Critical Thinking Flow (the "why" behind each fix)

**Why the `fleet` 500 is a design bug, not a config bug.**
The route at `route.ts:14` uses `createServerSupabaseClient()`, which uses the
**publishable** (anon) key. Supabase's PostgREST then enforces RLS. Migration
035's `fleet` SELECT policy is scoped to `admin`, `access_control`, or
`fleet.department_id = e.department_id`. A department operator whose
`department_id` does not match the `fleet` row's `department_id` (fleet rows
are often assigned to a central logistics department, not the requesting
operator's department) gets zero rows, and PostgREST returns a 500 on an
empty result set with certain `Accept` headers. The fix is not to bypass RLS
with the service role — it is to add a `GRANT SELECT ON public.fleet TO
authenticated` so the permission layer is open and the RLS policy does the
filtering. This is the standard Supabase pattern and matches what migration
164 already did for `employees` and `departments`.

**Why the 19s `departments` query is a cache-invalidation problem, not an
index problem.**
Four call sites each do `.from('departments').select('id').eq('name', slug)
.single()`. Each is wrapped in a Redis cache read with a 150 ms timeout. On
Vercel, Redis round-trips to a managed instance routinely exceed 150 ms. The
`Promise.race` throws, the catch swallows it, and the code falls through to a
direct DB query. The DB query itself is fast IF there is an index on
`departments(name)` — migration 041 added `idx_departments_name`, so the
direct query should be sub-10ms. The 19s is the RLS policy sub-plan: the
`employees` table is re-scanned for every `departments` lookup because the
policy correlates on `auth.uid()` and there is no covering index on
`employees(auth_id)`. So the sequence is: Redis timeout -> DB fallback -> RLS
policy -> seq scan on employees -> 19s. Two fixes compound: (a) raise the
Redis timeout to 500 ms so it stops timing out on Vercel, (b) add
`idx_employees_auth_id` so the RLS sub-plan is an index scan, and (c) replace
the per-request lookups with a module-level registry that loads all
departments once per TTL window.

**Why the `machines` 500 is an onboarding bug.**
The `handle_new_user` trigger (migration 001, line 351) creates an employee
row with `full_name` and `role` but does NOT set `department_id` or
`accessible_departments`. The `machines` RLS policy requires
`e.department_id = machines.department_id OR machines.department_id =
ANY(e.accessible_departments)`. Both are null/empty for a new user, so the
policy returns false for every row. The `machines/page.tsx:15` query has no
`department_id` filter — it asks for ALL machines and relies entirely on RLS.
Result: zero rows, PostgREST 500. The fix is in the trigger: populate
`accessible_departments` from `department_id` when it is set, and add an
explicit `department_id` filter to the page query so the RLS policy has a
concrete value to match against.

**Why the refactor branch's untracked jobs are a deployment risk.**
`outbox-drain.ts`, `shift-closeout-report.ts`, and `autonomous-scada-simulation.ts`
each call `inngest.createFunction(...)` at module load. If they are imported
by a route that is bundled into the client bundle, the Inngest client
initialisation will break the build or pull server-only modules into the
client. They must be imported only from the Inngest serve route
(`apps/portal/app/api/inngest/route.ts`), which is server-only. The fact that
they are untracked means they were never committed and therefore never
tested in CI — they need to be committed, wired, and tested before deploy.