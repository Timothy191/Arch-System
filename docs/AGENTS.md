# AGENTS.md

> **Agent contract index** — onboarding index: [`CLAUDE.md`](CLAUDE.md). Full detail: [`.claude/guides/operational-handbook.md`](.claude/guides/operational-handbook.md).

## Contract (non‑negotiable)

- Read affected package `AGENT_TRACER.md` before editing; update it after every change.
- Run `pnpm quality` before marking work complete.
- Delegate multi-file exploration to subagents; scope prompts with paths.
- Git: one commit per task, no amend/force-push without permission, never `--no-verify`.

## Workflow phases

| Phase   | When                             | Gate                                   |
| ------- | -------------------------------- | -------------------------------------- |
| Plan    | >3 files or architectural choice | Checker subagent (max 3 iterations)    |
| Execute | Plan verified                    | Atomic commits                         |
| Verify  | Done                             | lint, type-check, test, `pnpm quality` |

Commands: `/spec` (features) · `/fix` (quick bugs) · `/prd` (requirements) — see `.claude/rules/task-workflow.md`.

## Nx enforcement

Run `node 08_developer_tooling/apply-project-tags.cjs` after new projects. Dependency constraints in `nx.json` (`scope:app` → `scope:package`, etc.).

## Modular rules

`.claude/rules/` — architecture, portal, auth, design-system, verification, testing, development-practices, code-review, thought-process.
