# Complete Production Overhaul — Tasks

## Phase 0 — Stabilize (now, 0-2h)

### Task 0.1: Repair Vercel env CLI
- [ ] Run `vercel env ls --team timothyoniel558-9643s-projects arch-system`
- [ ] If still failing, run `vercel link --yes` to re-link the project
- [ ] If still failing, go to Vercel dashboard: Project Settings -> Environment Variables
- [ ] Verify: `vercel env ls` returns a list of env vars, not `Custom Environment not found`

### Task 0.2: Correct production env values
- [ ] Set `NEXT_PUBLIC_APP_URL` to `https://arch-system-theta.vercel.app`
- [ ] Set `NEXT_PUBLIC_API_URL` to `https://arch-system-theta.vercel.app/api`
- [ ] If using `.env.vercel.production` as upload source, fix the local file too
- [ ] Verify: env values in Vercel dashboard match the production domain

### Task 0.3: Hotfix `fleet` 500
- [ ] Create migration `packages/database/migrations/167_fleet_grant_select.sql`
- [ ] Content: `GRANT SELECT ON public.fleet TO authenticated;`
- [ ] Apply to production Supabase: `psql $SUPABASE_DATABASE_URL -f 167_fleet_grant_select.sql`
- [ ] Verify: `GET /api/departments/{id}/fleet` returns 200 with data

### Task 0.4: Hotfix `breakdowns` 500
- [ ] Read migration 077 to confirm `breakdown_sharing` table/column names
- [ ] Create migration `packages/database/migrations/168_breakdowns_select_sharing.sql`
- [ ] Apply to production Supabase
- [ ] Verify: `GET /engineering` returns 200 with breakdowns data

### Task 0.5: Bookmark rollback target
- [ ] Record `dpl_69LXjDrSVgUeRS5H7GXDoYvqDH2q` as the current known-good deployment
- [ ] Test rollback path: `vercel rollback dpl_69LXjDrSVgUeRS5H7GXDoYvqDH2q --yes`

## Phase 1 — Fix (2-6h)

### Task 1.1: Add performance indexes
- [ ] Create migration `packages/database/migrations/169_performance_indexes.sql`
- [ ] Add `idx_employees_auth_id`, `idx_employees_department`, GIN on `accessible_departments`, `idx_departments_name`
- [ ] Apply to production Supabase
- [ ] Verify: `EXPLAIN ANALYZE` on a typical `departments` lookup shows index scan, not seq scan

### Task 1.2: Create department registry
- [ ] Create `apps/portal/lib/dept-registry.ts` with module-level Map, 5-min TTL
- [ ] Update `apps/portal/server/proxy.ts:138` to use `getDeptId`
- [ ] Update `apps/portal/lib/dept-context.ts:30` to use `getDeptId`
- [ ] Update `apps/portal/lib/prewarm-cache.ts:24` to use `getDeptId`
- [ ] Update `apps/portal/lib/hub-departments.ts:33` and 6 more call sites in jobs/
- [ ] Verify: `departments` queries are under 200ms p95

### Task 1.3: Fix Redis timeout race
- [ ] Update `packages/supabase/src/auth.ts`: raise `CACHE_TIMEOUT_MS` from 150 to 500
- [ ] Update `packages/supabase/src/auth.ts`: on timeout, resolve null instead of reject (no DB fallback)
- [ ] Update `apps/portal/server/proxy.ts:301-316`: same change
- [ ] Verify: no `Slow database query detected: departments` warnings in Vercel logs

### Task 1.4: Fix `handle_new_user` trigger
- [ ] Create migration `packages/database/migrations/170_handle_new_user_accessible.sql`
- [ ] Update the trigger to populate `accessible_departments` from `department_id`
- [ ] Apply to production Supabase
- [ ] Verify: new user can query `machines` without 500

### Task 1.5: Fix `machines` page query
- [ ] Update `apps/portal/app/(departments)/[department]/machines/page.tsx:15`
- [ ] Add `.eq('department_id', deptId)` filter
- [ ] Verify: `GET /machines` returns 200 with correct counts

### Task 1.6: Run audit suite
- [ ] Run `pnpm audit:rls` — verify no missing RLS policies
- [ ] Run `pnpm audit:rls-matrix` — verify RLS coverage matrix
- [ ] Run `pnpm audit:drift` — verify contract/schema sync
- [ ] Fix any findings before proceeding