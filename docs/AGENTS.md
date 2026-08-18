# AGENTS.md

> **Agent contract index** — onboarding index: [`CLAUDE.md`](CLAUDE.md). Full detail: [`.claude/guides/operational-handbook.md`](.claude/guides/operational-handbook.md).

## Contract (non‑negotiable)

- Read affected package `AGENT_TRACER.md` before editing; update it after every change.
- Conclude every turn/response with: Summary of Actions Taken, Token Metrics (Tokens Used, Tokens Cached, Tokens Reused from cached, Tokens Saved), and Suggested Next Steps (3 options).
- Apply token-saving strategies: bounded file slicing (`StartLine`/`EndLine`), `grep_search` symbol lookup, and surgical contiguous diffs.
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

Run `node tools/apply-project-tags.cjs` after new projects. Dependency constraints in `nx.json` (`scope:app` → `scope:package`, etc.).

## Modular rules

`.claude/rules/` — architecture, portal, auth, design-system, verification, testing, development-practices, code-review, thought-process.

<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

## General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax

<!-- nx configuration end-->
