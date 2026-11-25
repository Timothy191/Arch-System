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
5. **Verify Empirically**: Run `pnpm agent:verify:fast` (or `pnpm agent:verify` for full/release changes) and confirm all checks pass without weakening assertions.
6. **Safe Commit & Clean-Git Closure**: Run `pnpm agent:finish -- --message "<type>(<scope>): <summary>" --merge` (runs checklist verification, `pre-commit-guards.cjs`, standard `git commit` with Husky hooks, safe `--ff-only` local merge into `main`, deletes the merged branch, and leaves `git status` clean). Never pass `--no-verify` or force-merge. Remote `git push origin main` and `pnpm deploy:vercel:prod` still require explicit user approval.
