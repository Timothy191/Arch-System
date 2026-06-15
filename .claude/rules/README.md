# Claude Rules

Modular rules loaded every session. Each file covers a specific domain.

## Workflow & Process

| Rule                       | Scope                                                                                              |
| -------------------------- | -------------------------------------------------------------------------------------------------- |
| `verification.md`          | Evidence before claims, live-target probe, E2E mandatory, failure modes self-check                 |
| `testing.md`               | Parsimonious testing, TDD with escapes, contra-variance, test strategy                             |
| `development-practices.md` | Systematic debugging, defense-in-depth, constraint classification, git safety                      |
| `code-review.md`           | Six-step response sequence, YAGNI check, forbidden responses, pushback guidelines                  |
| `task-workflow.md`         | `/spec` `/fix` `/prd` commands, task-first discipline, tool parameter exactness, complexity triage |
| `thought-process.md`       | Deliberation limits, pre-declaration, brief progress updates, boundary-only validation             |

## Project Architecture

| Rule               | Scope                                                                                           |
| ------------------ | ----------------------------------------------------------------------------------------------- |
| `architecture.md`  | Monorepo structure, apps, packages, dependency versioning, database, AI orchestration           |
| `portal.md`        | Portal config, path aliases, route groups, global shell, data fetching, testing, CI order       |
| `auth.md`          | Proxy/middleware, auth resolution flow, RLS, restricted routes, Server Action auth patterns     |
| `design-system.md` | Light-only theme, OKLCH colors, glass pattern, shadow tokens, typography, animation constraints |

These rules complement `CLAUDE.md` "Agent Contracts" section (agent contracts + quality gates).
