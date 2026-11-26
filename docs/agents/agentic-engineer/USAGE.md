# Agentic Engineer — Usage Guide

## Quick Start

Run the combined status to confirm the deployed instance is healthy:

```bash
pnpm agent:engineer:status
```

Typical first output shows the interoperability score, documentation completeness, whether
the agent definition and registry card are registered, and the task summary. To bootstrap
runtime state explicitly, run `pnpm agent:engineer:init`. All commands accept `--json` for
machine-readable output and `--root <path>` for a standalone checkout.

The Engineer is also available as a skill named `agentic-engineer`; invoke it before
touching any agent definition, registry card, skill, rule, hook, or A2A schema.

## CLI Commands

| Command                     | Purpose                                                        |
| :-------------------------- | :------------------------------------------------------------- |
| `agent:engineer:init`       | Create runtime state and verify the deployment registration.   |
| `agent:engineer:validate`   | Run the fourteen interoperability checks.                      |
| `agent:engineer:docs`       | Check required documents and documentation change sync.        |
| `agent:engineer:docs:check` | Alias of `docs` for CI readability.                            |
| `agent:engineer:health`     | Compute integration health, write a snapshot, emit alerts.     |
| `agent:engineer:gate`       | Read-only gate combining validation, docs, and deployment.     |
| `agent:engineer:coordinate` | Manage the prioritized task graph.                             |
| `agent:engineer:watch`      | Re-run the gate on agent-content changes (use `--once` in CI). |
| `agent:engineer:test`       | Execute the integration test suite.                            |

Exit codes are stable: `0` success, `1` failure, `2` degraded health, `3` usage error.
The gate supports `--staged` for the pre-commit hook and `--ci` for the verification
suite; both are read-only.

## Coordination Workflow

1. Queue work with an explicit priority and optional component:

   ```bash
   pnpm agent:engineer -- coordinate add --title "Refresh reviewer card" --priority P1 \
     --component registry --depends-on ae-0001
   ```

2. Assign an owner: `coordinate assign ae-0002 --assignee critique-council-reviewer`.
3. Inspect the order: `coordinate plan` performs a priority-tiered topological sort and
   refuses cycles or tasks whose dependencies are unfinished.
4. Start only after dependencies complete: `coordinate start ae-0002`.
5. Track progress: `coordinate progress ae-0002 --percent 60`, then `complete ae-0002`.
6. Block or fail with a reason when handoffs stall: `coordinate block ae-0002 --reason "awaiting schema"`.
7. Synchronize: `coordinate sync` writes a heartbeat, appends a bus event, and reports
   claim conflicts against `.agents/a2a/whiteboard/claims.json`.
8. Validate the graph: `coordinate validate` rejects missing dependencies, unknown owners,
   and cycles.

Every mutation appends a ledger entry and a typed bus event, so coordination history can
be reconstructed from the audit trail.

## Health and Alerts

`pnpm agent:engineer:health` returns `healthy`, `degraded`, or `failed`. Health is
`healthy` only when interoperability is 100% and documentation completeness is 100%;
degraded means major-severity failures or partial documentation; failed means a critical
interoperability check failed or the deployment is unregistered. Alerts are appended to
`.ci-local/agentic-engineer/alerts.jsonl`; setting `AGENTIC_ENGINEER_ALERT_WEBHOOK` also
posts each alert to that endpoint with a three-second timeout. Use `health --write` to
refresh `documentation/03-audit-reports/agentic-engineer-health.md` and `audit` to verify
the ledger hash chain.
