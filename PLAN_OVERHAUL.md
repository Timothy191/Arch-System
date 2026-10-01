# Arch-System — Complete Production Overhaul Plan (cont.)

## 1. Phased Remediation

### Phase 0 — Stabilize (now, 0-2h): stop the bleeding

**0a. Repair Vercel env CLI.** `vercel env ls` returns `Custom Environment not
found` for every invocation. Try in order:
  1. `vercel env ls --team timothyoniel558-9643s-projects arch-system`
  2. `vercel link --yes` (re-link the project, regenerates `.vercel/project.json`)
  3. If still failing, manage env vars from the Vercel dashboard directly:
     Project Settings -> Environment Variables. This is blocking because you
     cannot verify what env vars production actually has until it works.

**0b. Correct production env values.** The repo's `.env.vercel.production` has:
  - `NEXT_PUBLIC_APP_URL="http://localhost:3000"`  <- WRONG for prod
  - `NEXT_PUBLIC_API_URL="http://localhost:3000/api"` <- WRONG for prod
Set both to `https://arch-system-theta.vercel.app` in Vercel Project Settings.
If the local file is used as the upload source, fix it there too.

**0c. Deploy a hotfix for the `fleet` 500.** The route at
`apps/portal/app/api/departments/[departmentId]/fleet/route.ts:14` queries
`fleet` with the anon-scoped server client. Migration 035 grants SELECT on
`fleet` only to `admin` / `access_control` / same-department. Department
operators get a 500. Two options, pick one:
  - (A) Add a migration: `GRANT SELECT ON public.fleet TO authenticated;` and
    rely on the existing RLS policy for row filtering. Minimal blast radius.
  - (B) Switch the route to `createServiceRoleClient()` and add a
    `department_id` filter. More secure but bypasses RLS, so audit carefully.
Option A is the correct fix — the RLS policy already exists and is sufficient.

**0d. Deploy a hotfix for the `breakdowns` 500.** Migration 077 added
engineering-breakdown sharing but the SELECT policy (migration 004) never
gained a clause for it. Add a migration:
```sql
DROP POLICY IF EXISTS "breakdowns_select_department" ON breakdowns;
CREATE POLICY "breakdowns_select_department"
  ON breakdowns FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM employees e WHERE e.auth_id = auth.uid()
      AND (e.role = 'admin'
        OR e.department_id = breakdowns.department_id
        OR breakdowns.department_id = ANY(e.accessible_departments)
        OR breakdowns.department_id IN (
          SELECT department_id FROM breakdown_sharing
          WHERE employee_id IN (SELECT id FROM employees WHERE auth_id = auth.uid())
        )
      ))
  );
```
Verify the `breakdown_sharing` table/column names against migration 077 first.

**0e. Bookmark the rollback target.** `dpl_69LXjDrSVgUeRS5H7GXDoYvqDH2q`
(the 2h-old build). If Phase 1 breaks anything, `pnpm deploy:vercel:prod`
with `--rollback` or redeploy that id.