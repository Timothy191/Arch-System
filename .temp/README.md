# .temp/README.md — Complete Production Overhaul Plan Index

**Project:** Arch-System (Plantcor OS) — Vercel production finalization
**Generated:** 2026-09-30
**Branch:** `refactor/backend-simplify-phase-1` (HEAD `5f90e81`, 1 ahead of `main`)
**Live production:** `https://arch-system-theta.vercel.app`
  (deployment `dpl_69LXjDrSVgUeRS5H7GXDoYvqDH2q`, project `prj_5ImVnmeU5jKnLfkVtVfX74ClEYGy`)

---

## Document Index

| File | Purpose | Audience |
|---|---|---|
| `outline.md` | Executive outline: what's broken, why, and the 4-phase plan at a glance | Executives / anyone needing the 5-minute version |
| `requirements.md` | EARS-style functional + non-functional requirements for the overhaul | Engineers implementing |
| `spec.md` | Technical specification: exact code changes, SQL migrations, config diffs | Senior engineers / DBAs |
| `design.md` | Architecture & data-flow design: how the fixed system fits together | Architects |
| `tasks.md` | Ordered, actionable task checklist with verification steps | Implementers |
| `risks.md` | Risk register: what can go wrong, probability, impact, mitigation | SRE / reviewers |
| `verification.md` | Post-deploy verification checklist: commands, expected outputs, pass/fail criteria | QA / on-call |

---

## The Five Failure Classes (verified against live Vercel logs + source)

1. **`breakdowns` RLS gap** — migration 077 added engineering-breakdown sharing but
   the SELECT policy (migration 004) never gained the sharing clause.
   Symptom: `/engineering` returns `Database query failed: breakdowns (GET)`.

2. **`fleet` no RLS grant for non-access-control roles** — migration 035 grants
   SELECT only to `admin` / `access_control` / same-department. The route at
   `route.ts:14` uses the anon-scoped server client.
   Symptom: `/api/departments/{id}/fleet` returns HTTP 500.

3. **`departments` 19s queries** — Redis 150ms timeout race in `proxy.ts` +
   `auth.ts` falls through to DB; RLS policy sub-plan seq-scans `employees`
   (no `auth_id` index). Four call sites do per-request `.single()` lookups.
   Symptom: `departments (GET) took 19409ms`, `14503ms`, `14856ms`.

4. **`machines` 500** — `handle_new_user` trigger doesn't set
   `accessible_departments`; RLS policy requires it; page query has no
   `department_id` filter.
   Symptom: `Database query failed: machines (GET)`.

5. **Vercel env CLI unreachable** — `vercel env ls` returns
   `Custom Environment not found` (api_error) for every invocation.
   Symptom: cannot inspect or manage environment variables from CLI.

---

## Phase Summary

| Phase | Name | Duration | Exit criteria |
|---|---|---|---|
| 0 | Stabilize | 0-2h | Live site returns 200 on all critical endpoints; env CLI working |
| 1 | Fix | 2-6h | `pnpm audit:rls` clean; `departments` queries < 200ms; no `Database query failed` in logs |
| 2 | Ship | 6-10h | Refactor branch merged to `main`, pushed, deployed, verified on live |
| 3 | Harden | 10-16h | CI auto-deploys on `main` push; rollback automated; daily verification cron active |

**Rollback target:** `dpl_69LXjDrSVgUeRS5H7GXDoYvqDH2q` (current production, 2h old)