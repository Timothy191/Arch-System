# Arch-System — Complete Production Overhaul Plan (cont.)

## 1. Phased Remediation (cont.)

### Phase 2 — Ship (6-10h): push the refactor branch and deploy

**2a. Run the quality gate on the current branch before anything else.**
```
pnpm quality
```
This runs turbo lint + type-check + test + tokens + CSS + knip + policy:check
+ audit:compliance + html:check + verify:gates. The refactor branch has 70
modified files; some of them will fail. Fix until green. Do NOT push a red
build — Vercel will deploy it and the live site is already fragile.

**2b. Triage the 32 untracked files.** Decision matrix:

| File | Action |
|---|---|
| `apps/portal/lib/jobs/outbox-drain.ts` | KEEP — wire into Inngest |
| `apps/portal/lib/jobs/shift-closeout-report.ts` | KEEP — wire into Inngest |
| `apps/portal/lib/jobs/autonomous-scada-simulation.ts` | KEEP — wire into Inngest |
| `libs/shared/hooks/src/useOfflineQueue.ts` | KEEP — restore (was deleted in refactor, needs re-integration) |
| `packages/supabase/src/auth.ts` | KEEP — new module, needs export wiring in `index.ts` |
| `fix-actions.cjs`, `fix-image.cjs`, `fix-layout.cjs`, `fix-redis.cjs`, `fix-setup.sh`, `fix-tests.sh`, `fix_ts.py`, `revert-hero.cjs`, `rewrite-hero.cjs`, `check-func.cjs`, `query-departments.cjs`, `query-rpc.cjs`, `update-route.cjs`, `update_*.py` | DELETE — one-off patches, not production code |
| `temp/lighthouse-report.{html,json}` | DELETE — build artifact, already in `.gitignore` |
| `apps/portal/features/departments/components/control-room/*` | KEEP — new UI, needs import wiring |
| `apps/portal/app/api/sync/fallback/route.ts` | KEEP — needs registration |
| `apps/portal/features/admin/tabs/actions.ts` | KEEP |

**2c. Wire the three Inngest jobs.** They are defined but not registered. Each
calls `inngest.createFunction(...)` at module load. They need to be imported
from a single registration module that Inngest's dev server / production
runner picks up. Check `packages/utils/src/inngest.ts` for the existing
`inngest` client and the pattern used by other functions. Create
`apps/portal/lib/jobs/index.ts` that exports all three, and import it from the
Inngest serve route (`apps/portal/app/api/inngest/route.ts`).

**2d. Merge to main and push.**
```
git checkout main
git merge refactor/backend-simplify-phase-1
git push origin main
```
Resolve any conflicts. The refactor branch is 1 commit ahead of main plus
uncommitted work, so the merge should be fast-forward-ish but the untracked
files need to be committed or stashed first.

**2e. Deploy to production.**
```
pnpm deploy:vercel:prod
```
This runs `tools/scripts/vercel-deploy.sh --prod`, which runs
`vercel-preflight.cjs` first, then `npx vercel deploy --prod --yes`.
Watch the build log for the DB query warnings — if the Phase 1 fixes are in,
the `departments` and `fleet` errors should be gone.

**2f. Verify on the live site.** After deploy, hit these endpoints with
`vercel curl` (anonymous curl hits the Vercel SSO wall):
- `GET /api/health` — should be 200
- `GET /control-room` — should be 200 with data, no DB errors in logs
- `GET /engineering` — should be 200, breakdowns query succeeding
- `GET /api/departments/{id}/fleet` — should be 200, not 500
- `GET /machines` — should be 200, not 500
Then `vercel logs <new-deployment-url> --json` and grep for
`Database query failed` and `Slow database query` — both should be at zero.