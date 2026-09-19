---
name: spec-driven-swarming
description: >-
  Use this skill when you need to decompose complex inputs or goals into EARS specifications and execute autonomous swarming protocols.
---

# Spec-Driven Decomposition & Autonomous Swarming Protocol

**Governing Rule:** `SPE-0 — All user inputs, goals, and complex tasks MUST undergo structured decomposition into EARS specifications and Real-World Quality Score evaluation prior to code mutation.`

---

## 1. Input Ingestion & Phased Breakdown Pipeline

When any task or user input is received:

1. **Decompose Entities**: Identify affected domains (Database/RLS, UI/Components, Contracts/Zod, Security/Audit, Performance/Caching, Testing/QA, DevOps/Tooling).
2. **Generate Phased Docs (`temp/`)**:
   - `temp/outline.md`: Executive vision, real-world Council perspectives, and architectural scope.
   - `temp/requirements.md`: Exact specifications formatted in **EARS** notation (`WHEN ... THE SYSTEM SHALL ...`).
   - `temp/design.md`: Technical architecture, data contracts, sequence diagrams, and rollback strategies.
   - `temp/tasks.md`: Phased execution waves with linked requirements.
3. **Audit Real-World Quality Score**:
   $$\text{Real-World Score} = \frac{\text{Feasibility} + \text{Maintainability} + \text{Security} + \text{Performance} + \text{Reliability}}{5} \ge 90/100$$
   Execution is only unlocked when the composite score reaches $\ge 90/100$.

---

## 2. Dynamic Swarm Topologies & Auto-Dispatch

The Auto-Dispatch Router automatically assigns one of three primary swarm topologies based on domain complexity:

### Topology A: Tiered Context Hierarchy (T0 / T1 / T2+)

- **T0 Orchestrator**: Maintains global state and coordinator logs; never receives raw grep sweeps or multi-thousand line logs.
- **T1 Domain Specialists**: Persistent specialists (Database Architect, UI Engineer, Contract Auditor) executing deep mutations.
- **T2 Disposable Scouts**: Short-lived worker subagents executing wide codebase searches and log indexing.

### Topology B: Writer-Critic Dual Mind

- **Writer**: Implements changes, tests, and documentation.
- **Critic**: Challenges assumptions, verifies edge cases, audits RLS policies, and tests boundary security.

### Topology C: Parallel Specialist Swarm

- Concurrent execution of independent domain specialists with non-overlapping file scopes, logging state to `.a2a/bus/event-log.jsonl`.

---

## 3. Toolchain Access & Permission Matrix

All specialist agents and autonomous loops are granted full permissions to utilize installed CLI toolchains:

- **`ralph`**: Autonomous 1-job -> 1-commit iteration driver with quality-gate rollback.
- **`check-compound-bash`**: AST-based shell command validator and auto-approver.
- **`smart-indexer`**: Cross-session memory and knowledge graph indexer.
- **Domain CLIs**: `metabase`, `openspec`, `dexter`, `quartermaster`, `scholar`, `clihub`, `fresh`, `gitbutler`, `sidekick`, `nexus`, `yazi`.
