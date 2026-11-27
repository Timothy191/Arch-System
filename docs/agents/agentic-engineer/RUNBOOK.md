# Agentic Engineer — Operational Runbook

## Health Checks

Run `pnpm agent:engineer:health` before merging agent-content work and at the start of any
coordination-heavy session. Expected output reports `healthy`, interoperability at 100%,
documentation at 100%, and zero alerts. For a machine-readable snapshot use
`pnpm agent:engineer -- health --json`; to refresh the published report use
`pnpm agent:engineer -- health --write`. Verify the audit trail with
`pnpm agent:engineer -- audit`; it must report a verified hash chain. A scheduled check can
run `pnpm agent:engineer -- watch --once` in CI to catch drift without a long-lived
process.

## Incident Response

1. Identify the failing check from the gate or health output; the check id names the
   component family.
2. For `agents.parity`, add the missing registry card or agent definition — never delete
   the counterpart just to satisfy parity.
3. For `registry.output_contracts`, restore the referenced schema path or supply a
   non-empty inline contract.
4. For `skills.duplicates`, remove the duplicate package and keep one canonical root.
5. For `hooks.integrity`, fix the command path in `.agents/hooks.json` and confirm the
   script is executable.
6. For `docs.change_sync`, update the relevant required document and regenerate the
   catalog; do not waive the gate.
7. If health is `failed`, stop the merge, record the alert id from `alerts.jsonl`, and
   escalate to the orchestrator agent. If a webhook is configured, confirm delivery.

Every incident response appends to the ledger automatically through the next gate or
health run; manual ledger edits are prohibited because they break the hash chain.

## Maintenance

- Add new agent-content roots to the config only after confirming they are agent-specific.
- Extend the required-document list when a new artifact class is introduced, then add the
  matching document with its mandated sections.
- Keep runtime state in `.ci-local/agentic-engineer/`; never commit `tasks.json`,
  heartbeats, alerts, or the ledger.
- Regenerate the catalog after every component change and commit it alongside the change.
- When `AGENT_TRACER.md` is updated alongside portal or library feature deliveries, record or verify the corresponding operational runbook/catalog state so `docs.change-sync` remains at 100%.
- Prune completed tasks with `coordinate list` review; completed records remain useful for
  audit but may be archived with the repository's normal hygiene process.
- Review thresholds quarterly; raising the documentation threshold above 100 is invalid.

## Recovery

If the state directory is lost, run `pnpm agent:engineer:init` to recreate an empty task
graph and ledger; coordination history is not recoverable, but validation, documentation,
and health are stateless and resume immediately. If the ledger is reported corrupt, capture
the first failing sequence number, restore the state directory from a trusted backup, and
re-run `audit`; if no backup exists, start a new ledger and note the discontinuity in the
incident record. If the watch process is orphaned, stop it and run `watch --once` to
confirm current status. If the gate fails due to a git diff unavailable in a shallow
checkout, fetch the base branch or pass `--root` to a full checkout; the gate falls back to
`HEAD~1` but a missing base weakens change-sync coverage.
