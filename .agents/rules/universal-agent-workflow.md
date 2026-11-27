---
name: universal-agent-workflow
description: Mandatory cross-agent workflow enforcing atomic [ ] checklist breakdown, branch isolation, propagated closure, empirical verification, and safe commit/merge for clean git state
paths:
  - '**/*'
alwaysApply: true
---

# Universal Cross-Agent Execution & Clean-Git Workflow

Applies to **all** AI coding agents and CLI assistants (`Antigravity`, `Claude Code`, `Cline`, `Command Code`, `Cursor`, `Qoder`, `OpenCode`, `GitHub Copilot`).

## Mandatory 6-Step Execution Flow

1. **Assess Request Empirically**: Inspect target source files, `@repo/contract` schemas, imports (`rg`), and `git status` before proposing or editing.
2. **Atomic `[ ]` Checklist (1 Task = 1 Checkbox)**: Decompose every primary task, setup step, downstream propagation (imports, exports, types, tests, docs, audit reports, `AGENT_TRACER.md`), and recommendation into individual `- [ ]` checkboxes (`pnpm agent:start -- --branch <type>/<scope> --task "<summary>" --items "step1|step2|..."` tracks active items in `.ci-local/active-checklist.md`).
3. **Create Isolated Task Branch**: Branch off `main` (`git checkout -b <type>/<scope>` or `pnpm agent:start`) before editing any file — never commit unbranched work directly to `main`.
4. **Complete All Primary, Related & Recommended Actions**: Work sequentially until **zero `- [ ]` items remain** (`pnpm agent:checklist check <n>`). Complete all coupled updates (setups, imports, re-exports, configs, unit tests, `AGENT_TRACER.md`) before stopping.
5. **Verify Empirically**: Run the verification floor for your change type (below). `pnpm agent:verify:fast` is an inner-loop smoke check only; it skips gates 16–23 (build, performance budgets, E2E, observability, accessibility). Never merge or push on fast-only evidence for UI, theme, CSS, migration, contract, or deployment changes.
6. **Safe Commit & Clean-Git Closure**: Run `pnpm agent:finish -- --message "<type>(<scope>): <summary>" --merge` (runs checklist verification, `pre-commit-guards.cjs`, standard `git commit` with Husky hooks, safe `--ff-only` local merge into `main`, deletes the merged branch, and leaves `git status` clean). Never pass `--no-verify` or force-merge. Once `pnpm agent:verify` passes and the `--ff-only` merge into `main` succeeds, autonomously run `git push origin main` and `pnpm deploy:vercel:prod`.

## Verification floor by change type

| Change                                                 | Minimum before commit or merge                          |
| :----------------------------------------------------- | :------------------------------------------------------ |
| Theme, `packages/ui`, app CSS, portal UI, build config | `pnpm agent:verify` (gates 18–19: build + perf budgets) |
| Migrations, contracts, auth/RBAC, Redis capabilities   | `pnpm agent:verify`                                     |
| Docs, agent content, non-runtime config                | `pnpm agent:verify:fast`                                |

- Adding CSS also requires `pnpm lint:css-perf` after your **final** edit: it sums every file under `packages/{theme,ui}/src/**/*.css` against the 115 KB budget. Editing more CSS after a green run invalidates the result; re-run it.
- A green fast run is never evidence that a UI or deployment change is safe. If you are unsure which floor applies, run the full suite.

## Resource utilization (mandatory)

- Structure first: query CodeGraph (`codemap context`, `codemap show`, `impact`) instead of grepping blind, and load the matching skill before domain work.
- Recall before re-deriving: ask `memory-gateway-mcp` (`search_unified_memory`, `get_session_onboarding`) and the repo skills instead of re-reading the repository.
- Parallelize independent investigation with subagents; never repeat in the main thread a search you delegated.
- UI work is verified in a real browser (`pnpm dev:quick` plus Chrome DevTools or Playwright), not only by unit tests.

## Dispatched workers (Orca / Paradev)

A dispatched worker reports `worker_done` only with measured evidence: the verification floor above, the exact commands run, and any residual risk. Never cherry-pick a worker's commits into `main` without the full suite, and never push, deploy, or relax a gate on the worker's behalf.
