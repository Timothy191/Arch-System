# Antidrift Guardian — Origin ↔ Continuum

Reverse-engineered from Alyssa Solen's Origin ↔ Continuum framework
([alyssadata/alyssadata](https://github.com/alyssadata/alyssadata),
[non-drift-measurement-test](https://github.com/alyssadata/non-drift-measurement-test),
[ai-foundations-origin-boundary-test](https://github.com/alyssadata/ai-foundations-origin-boundary-test)).
Not a copy of any of them: the prompt-based questionnaires are re-expressed as a
single complex **functional** test that runs real checks against this repository.

## Core Thesis

> **"Continuum does not exist without Origin."**

A system has a governing line — its named source condition. Drift is the silent
collapse of that line under pressure. **Fluency is not stability**: a repo can
look healthy while its invariants quietly erode. Non-drift is the preservation of
the governing line across variation, pressure, correction, authorization
pressure, interruption, and time.

## The Governing Line (Origin)

1. Turborepo 2.x + pnpm is the build orchestrator; Nx is decommissioned.
2. `tools/repo/policy-compiler.cjs` is the Single Source of Truth for scope tags.
3. `packages/database/migrations/` is the SSoT for schema; the supabase copy is deploy-time only.
4. RLS is enabled on every table and consults `auth.uid()` via `public.employees`.
5. Design tokens are OKLCH from `@repo/theme`; generated files are never hand-edited.
6. UI packages are pure presentation; apps never import `@repo/database-internal`.
7. All work stays on `main`; the worktree is left clean.

## The Functional Test

```bash
pnpm audit:antidrift        # node tools/audits/antidrift-test.cjs
```

Runs real checks across the **seven non-drift capabilities**, computes a
confidence % per capability and overall, and decides drift status against a
**90% threshold** (exit code 1 = drift detected):

| Capability                    | What drift looks like                                                             |
| ----------------------------- | --------------------------------------------------------------------------------- |
| Source Retention              | Surviving Nx references in living docs/configs                                    |
| Boundary Retention            | SSoT locations relocated or shadowed by duplicates                                |
| Concept Stability             | Nx and Turborepo treated as interchangeable; deploy-time copy treated as editable |
| Unauthorized Merge Detection  | Generated artifacts or protected paths hand-edited                                |
| Authorization Drift Detection | RLS detached from `auth.uid()`; UI importing DB/Supabase                          |
| Repair Accuracy               | A "fix" that re-introduces drift; phantom script references                       |
| Pressure Resistance           | Incomplete work, stale branches, unsynced remote                                  |

The test is **read-only**: it restores `documentation/03-audit-reports/rls-report.md`
after running `audit-rls.cjs` (which regenerates it as a side effect), and it
excludes itself from the Nx-reference scan (self-reference). Historical archives
(`documentation/06-archives/`, `docs/archive/`, `codebase-maps/log-*/`) are
records, not drift.

## When to Test for Drift

The confidence % is the trigger. After any significant change (commit, migration,
refactor, config edit), recompute confidence:

- **Overall < 90%** → `REMEDIATE_AND_RETEST` — drift detected; remediate the
  failing capability, then re-run the test.
- **A single capability < 90%** → `TARGETED_RETEST` — re-test the affected
  capability only.
- **All ≥ 90%** → `HOLD` — no drift; re-test after the next significant change.

## The Agent

`antidrift-guardian` is registered in the global config
(`~/.claude/agents/antidrift-guardian.md`, `~/.agents/agents/antidrift-guardian/agent.md`)
and follows the 9 Core Agent Setup Pillars. It computes confidence %, decides
when to test, and remediates the drifted capability. Invoke it after any
significant change or when asked to verify the system has not drifted.
