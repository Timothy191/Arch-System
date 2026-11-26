# Agentic Engineer — Technical Specification

## Purpose and Scope

The Agentic Engineer is the repository's coordination and integration control plane for
agent-content modules. It treats the agent substrate as a product surface with its own
interoperability contract, documentation obligations, and health signal. Scope is limited
to agent-specific content: agent definitions under `.agents/agents/`, A2A registry cards
under `.agents/a2a/registry/`, skills in `.agents/skills/` and `.qoder/skills/`, rules in
`.agents/rules/` and `.cursor/rules/`, `.qoder/agents/`, `.qoder/hooks/`, the root agent
directives (`AGENTS.md`, `GEMINI.md`, `CLAUDE.md`), and the memory-base configuration.
General monorepo infrastructure is explicitly out of scope; the Engineer validates only
the components that agents exchange when they coordinate.

The instance comprises one orchestrator agent definition, one A2A registry card, one
skill, a configuration file, a CLI, and a library of eight modules. Runtime state lives in
`.ci-local/agentic-engineer/` so that transient coordination data never pollutes tracked
content.

## Architecture

The control plane is a layered Node.js program with no runtime dependencies beyond the
standard library:

1. `bin/agentic-engineer.cjs` parses commands and flags, dispatches to library modules,
   maps outcomes to exit codes, and emits ledger entries and bus events.
2. `lib/constants.cjs` merges `.agents/agentic-engineer/config.json` over defaults and
   resolves the state directory, honoring `AGENTIC_ENGINEER_STATE_DIR`.
3. `lib/component-registry.cjs` discovers every agent-content component and returns a
   normalized inventory with counts.
4. `lib/interop-validator.cjs` runs fourteen interoperability checks over that inventory.
5. `lib/a2a.cjs` builds and validates the three typed envelopes and records bus events.
6. `lib/coordination.cjs` owns the prioritized task graph and its state transitions.
7. `lib/docs-governance.cjs` evaluates required documents, renders the catalog, and
   enforces documentation change sync.
8. `lib/monitoring.cjs` writes the hash-chained audit ledger, emits alerts, and computes
   integration health.
9. `lib/git.cjs` derives changed-file sets from the staged index, working tree, or branch
   diff.
10. `lib/util.cjs` provides deterministic JSON, hashing, filesystem, and frontmatter
    helpers.

Every command is read-only toward tracked files except `docs --write` (catalog), `init`
(state bootstrap), `health --write` (health report), and coordination mutations. The watch
mode re-runs the gate on filesystem changes and emits alerts without mutating content.

## Data Contracts

The config file declares instance paths, agent-content roots, runtime excludes, required
documents with mandatory sections, catalog and health-report destinations, thresholds, and
priorities. All other contracts are JSON:

- Task record: `id`, `title`, `priority` (`P0`–`P3`), `status`, `assignee`, `component`,
  `dependsOn`, `targetFiles`, `progress`, `blockedReason`, timestamps.
- Coordination state: `version`, `nextId`, `tasks`, persisted as `tasks.json`.
- Heartbeat: the A2A status-heartbeat envelope plus detected claim conflicts.
- Audit entry: `seq`, `timestamp`, `actor`, `action`, `subject`, `result`, `detailHash`,
  `prevHash`, `hash`. Each hash covers the canonical JSON of the entry without its own
  `hash` field, chaining entries into a tamper-evident ledger.
- Bus event: `eventType`, `sender`, `recipient`, `taskId`, `payloadSummary`, `timestamp`.
- Alert: `severity`, `checkId`, `message`, `timestamp`, appended to `alerts.jsonl`.
- Health snapshot: `status` (`healthy`/`degraded`/`failed`), interoperability summary,
  documentation completeness, deployment state, alert list, and task summary.

The three A2A envelopes (task-handoff, review-verdict, status-heartbeat) are validated by
the shared schema module during roundtrip checks, guaranteeing that producer and consumer
agree on field names and types.

## Interoperability Checks

The validator executes fourteen checks, each scored as a binary pass with collected
failures:

1. `agents.parity` — every agent definition has a registry card and vice versa.
2. `agents.frontmatter` — each definition declares the nine-pillar frontmatter fields.
3. `registry.pillars` — each card implements every A2A pillar.
4. `registry.output_contracts` — output contracts reference resolvable schemas or declare
   a non-empty inline shape.
5. `skills.manifest` — the skills manifest resolves every included skill directory.
6. `skills.validity` — each skill package satisfies the Agent Skills specification.
7. `skills.duplicates` — no skill name appears in more than one root.
8. `rules.integrity` — every rule file is non-empty and discoverable.
9. `schemas.valid` — A2A schemas parse and declare their contracts.
10. `hooks.integrity` — hook commands resolve to existing executable scripts.
11. `coordination.state` — whiteboard claims, canvas, intercom, and event log are readable.
12. `directives.integrity` — root agent directives exist and resolve their references.
13. `a2a.envelope_roundtrip` — handoff, verdict, and heartbeat envelopes interoperate.
14. `memory.integrity` — memory-base configuration files parse.

The score is `passed / total * 100`, and the configured success threshold is 100.

## Failure Modes

- **Parity drift.** Adding an agent without a registry card (or the reverse) fails
  `agents.parity`; the fix is to create the missing counterpart, not to waive the check.
- **Contract drift.** Renaming a schema path breaks `registry.output_contracts`; inline
  contracts are accepted only when non-empty.
- **Duplicate skills.** Copying a skill between roots fails `skills.duplicates`; keep a
  single canonical package and reference it.
- **Unresolvable hooks.** Moving a hook script without updating `hooks.json` fails
  `hooks.integrity` at the next gate.
- **Documentation debt.** An agent-content change without a documentation change fails
  `docs.change_sync`; the pipeline reports the first missing artifact per document.
- **Ledger corruption.** Editing or reordering `ledger.jsonl` fails `audit` verification
  because the recomputed hash chain diverges.
- **Watch storms.** Rapid edits are debounced by 500 ms; sustained failures emit one alert
  per violation per run without blocking the watcher.
