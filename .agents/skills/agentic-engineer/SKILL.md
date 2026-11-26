---
name: agentic-engineer
description: Coordinate agent-content work, validate end-to-end interoperability, and enforce documentation updates with the Agentic Engineer control plane.
---

# Agentic Engineer

Operate the repository's Agentic Engineer: a coordination and integration control plane
for agent-content modules (`.agents/`, `.qoder/agents`, `.qoder/skills`, `.qoder/hooks`,
`.cursor/rules`, and the root agent directives).

## When To Use

- Prioritizing or assigning work across agents and tracking dependencies.
- Changing any agent definition, registry card, skill, rule, hook, or A2A schema.
- Verifying that agent components still interoperate end to end.
- Enforcing that a documentation update accompanies every agent-content change.

## Core Commands

1. `pnpm agent:engineer:status` — combined interoperability, docs, deployment, and task summary.
2. `pnpm agent:engineer:validate` — run the interoperability check matrix.
3. `pnpm agent:engineer:docs:check` — verify required docs and catalog freshness.
4. `pnpm agent:engineer:health` — monitor integration health and emit alerts.
5. `pnpm agent:engineer:gate` — pre-commit gate: validate + documentation change sync.
6. `pnpm agent:engineer:coordinate -- status` — inspect the prioritized task graph.

## Coordination Workflow

1. Add a task: `pnpm agent:engineer -- coordinate add --title "<work>" --priority P1`.
2. Assign an owner: `pnpm agent:engineer -- coordinate assign <id> --assignee <agent>`.
3. Order the queue: `pnpm agent:engineer -- coordinate plan`.
4. Start only when dependencies are done: `pnpm agent:engineer -- coordinate start <id>`.
5. Report progress and completion: `progress <id> --percent 50`, then `complete <id>`.
6. Synchronize with the whiteboard: `pnpm agent:engineer -- coordinate sync`.

## Documentation Contract

Every change under the agent-content roots requires either an updated required document
under `docs/agents/agentic-engineer/` or a regenerated catalog. Run
`pnpm agent:engineer:docs --write` after changing any component, then commit the catalog
with the change.

## Evidence Contract

- Report the measured interoperability score, documentation completeness, and alert count.
- Never claim health without running `pnpm agent:engineer:health`.
- Never bypass `gate`; fix the reported violation instead.
