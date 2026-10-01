# Complete Production Overhaul — Outline

**Project:** Arch-System (Plantcor OS) — Vercel production finalization
**Generated:** 2026-09-30
**Branch:** `refactor/backend-simplify-phase-1` (HEAD `5f90e81`, 1 ahead of `main`)
**Live production:** `https://arch-system-theta.vercel.app`
  (deployment `dpl_69LXjDrSVgUeRS5H7GXDoYvqDH2q`, project `prj_5ImVnmeU5jKnLfkVtVfX74ClEYGy`)

---

## 1. Executive Summary

The site is live on Vercel and serving real traffic, but it is **not ready for
daily production use**. Live Vercel logs (fetched 2026-09-30) show four
independent failure classes plus a latent fifth. The refactor branch in the
local working tree contains fixes for some of them but nothing is pushed, and
the live build is running `main`'s code.

**Root causes (verified against source):**

1. **RLS policy gap on `breakdowns`** — migration 077 added engineering-breakdown
   sharing but the SELECT policy (migration 004) never gained the sharing
   clause. Users whose only access is via the sharing table get
   `Database query failed: breakdowns (GET)`. This is the `/engineering` 500.

2. **`fleet` table has no RLS grant for non-access-control roles** — migration
   035 grants SELECT on `fleet` only to `admin` / `access_control` /
   same-department. The `/api/departments/[id]/fleet` route (route.ts:14)
   queries `fleet` with the anon-scoped server client. Department operators
   get a 500. Live log confirms: `fleet (GET) took 917ms ... success:false`.

3. **`departments` table queries take 19 seconds** — four call sites do
   `.from('departments').select('id').eq('name', slug).single()` per request.
   Each is wrapped in a Redis cache read with a 150 ms timeout. On Vercel,
   Redis round-trips routinely exceed 150 ms. The `Promise.race` throws, the
   catch swallows it, and the code falls through to a direct DB query — where
   the RLS policy sub-plan re-scans `employees` with no `auth_id` index.
   Result: 19.4s, 14.5s, 14.9s, 5.0s on cached HIT pages.

4. **`machines` 500** — the `handle_new_user` trigger (migration 001) creates
   an employee row with `full_name` and `role` but does NOT set
   `department_id` or `accessible_departments`. The `machines` RLS policy
   requires `e.department_id = machines.department_id` OR
   `machines.department_id = ANY(e.accessible_departments)`. Both are
   null/empty for a new user, so the policy returns zero rows and PostgREST
   returns a 500. The page query at `machines/page.tsx:15` has no
   `department_id` filter — it asks for ALL machines and relies on RLS.

5. **Vercel env CLI unreachable** — `vercel env ls arch-system` returns
   `Custom Environment not found` (api_error) for every invocation. This
   means environment variables cannot be inspected or managed from the CLI.
   The `.env.vercel.production` file in the repo is a local snapshot with
   `NEXT_PUBLIC_APP_URL="http://localhost:3000"` — if that file is what gets
   uploaded, production redirects to localhost.

6. **Uncommitted local work** — 70 modified + 32 untracked files on the
   refactor branch. The `fix-*.cjs` / `rewrite-*.cjs` scripts are one-off
   patches that need to be folded into real code or deleted. Three new
   Inngest jobs (`outbox-drain.ts`, `shift-closeout-report.ts`,
   `autonomous-scada-simulation.ts`) exist as loose files with no
   registration wiring.

**Verdict:** Fixes #1 and #2 are blocking. #3 is a performance cliff that
becomes a timeout under any real load. #4 blocks verification. #5 blocks
shipping.

---

## 2. The Four-Phase Plan

### Phase 0 — Stabilize (now, 0-2h): stop the bleeding

**0a. Repair Vercel env CLI.** Try in order:
  1. `vercel env ls --team timothyoniel558-9643s-projects arch-system`
  2. `vercel link --yes` (re-link the project, regenerates `.vercel/project.json`)
  3. If still failing, manage env vars from the Vercel dashboard directly:
     Project Settings -> Environment Variables.

**0b. Correct production env values.** The repo's `.env.vercel.production` has:
  - `NEXT_PUBLIC_APP_URL="http://localhost:3000"`  <- WRONG for prod
  - `NEXT_PUBLIC_API_URL="http://localhost:3000/api"` <- WRONG for prod
Set both to `https://arch-system-theta.vercel.app` in Vercel Project Settings.
If the local file is used as the upload source, fix it there too.

**0c. Deploy a hotfix for the `fleet` 500.** Add a migration:
```sql
GRANT SELECT ON public.fleet TO authenticated;
```
The RLS policy already exists and is sufficient. This is the standard
Supabase pattern that migration 164 already applied to `employees` and
`departments`.

**0d. Deploy a hotfix for the `breakdowns` 500.** Add a migration that adds
the migration 077 sharing clause to the SELECT policy. Verify the
`breakdown_sharing` table/column names against migration 077 first.

**0e. Bookmark the rollback target.** `dpl_69LXjDrSVgUeRS5H7GXDoYvqDH2q`
(the 2h-old build). If Phase 1 breaks anything, redeploy that id.