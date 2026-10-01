# CLAUDE.md

> **⚠️ Unified Agent System**: All agent behavioral rules, operational guides, skills, and governance have been consolidated into `.agents/`. This file serves only as a Claude Code entry point.

## Quick Start for Claude Code

1. **Read the full operational guide**: [`.agents/GUIDE.md`](./.agents/GUIDE.md)
2. **Read the architecture SSoT**: [`AGENTS.md`](./AGENTS.md)
3. **Read all rules**: `.agents/rules/` (17 permanent rule files)
4. **Engage structured thinking**: `.agents/rules/structured-thinking-mandate.md` (STM-0)

## Agent Configuration Layout

```
.agents/                    ← ALL agent governance lives here
├── GUIDE.md                ← Unified operational guide (commands, conventions, debugging)
├── rules/                  ← Permanent engineering rules (all agents)
├── skills/                 ← 60+ reusable workflow skills
├── agents/                 ← 35+ specialist agent definitions
├── a2a/                    ← Agent-to-Agent protocol & registry
├── memory_base/            ← Cross-session memory & retrospectives
├── corpos/                 ← Autonomous business loops
├── hooks/                  ← Lifecycle hooks (pre/post tool)
└── run-manifests/          ← Reproducibility manifests

AGENTS.md                   ← Architecture, domain, personas, data flow (root SSoT)
GEMINI.md                   ← Gemini/Antigravity-specific directives → .agents/
CLAUDE.md                   ← THIS FILE: Claude Code entry point → .agents/
.cursorrules                ← Cursor IDE entry point → .agents/
.claude/settings.json       ← Claude Code permissions (required at this path)
```

## Claude Code Permissions

Claude Code's tool permissions are managed in `.claude/settings.json` (required by Claude Code at this path — do not move). All behavioral rules are in `.agents/rules/`.

## Environment Notes (This Machine)

- Runtime is **mise-managed** (Node 26.8.1), not Volta. The `volta` field in `package.json` is inert here.
- If a `pnpm` invocation produces no output within seconds, kill it; use `Makefile` targets as fallback.
- `poetry` is not installed, which blocks `packages/eval` (Python/DeepEval).

## Hard Stops (Always In Force)

See `.agents/GUIDE.md` §9 for the complete list. Summary:

- No edits to secrets, credentials, or key material; no production data access from agent context.
- No force-push, history rewrite, or branch deletion.
- No disabling, skipping, or weakening tests, linters, or gates.
- Non-trivial changes require a written plan before code.

## Mandatory Structured Thinking (STM-0)

Before any non-trivial code mutation, engage the 5-phase Mandatory Thinking Protocol:
1. **Situational Comprehension** → 2. **Evidence Gathering** → 3. **Solution Design** → 4. **Pre-Commit Criticism** → 5. **Execution Contract**

Full specification: `.agents/rules/structured-thinking-mandate.md`

Last updated: 2026-09-30
