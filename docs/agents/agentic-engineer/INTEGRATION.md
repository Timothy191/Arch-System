# Agentic Engineer — Integration Notes

## A2A Bus

The Engineer participates in the append-only A2A bus at `.agents/a2a/bus/`. Every
coordination mutation publishes a typed event whose `eventType` is derived from the
action (`TASK_CREATED`, `TASK_ASSIGNED`, `TASK_STARTED`, `TASK_PROGRESS`, `TASK_COMPLETED`,
`TASK_BLOCKED`, `TASK_FAILED`). `coordinate sync` publishes a `STATUS_HEARTBEAT` built by
the shared envelope module, so the shape matches what other agents already consume. Bus
directory and whiteboard files are runtime state and are excluded from agent-content
change detection; only tracked definitions, cards, skills, rules, and schemas trigger the
documentation contract.

Envelope interoperability is proven every gate by `a2a.envelope_roundtrip`, which builds a
task-handoff from one agent to another, a review-verdict back to the sender, and a
heartbeat, then validates each against its schema and the cross-envelope field rules.

## Hook Wiring

The pre-commit hook calls the gate with `--staged` after the existing guard scripts. The
gate reads the staged file list, so unstaged experiments do not block a commit, while a
staged agent-content change without a staged documentation change does. The hook is
read-only: it never rewrites the index and never regenerates the catalog on the developer's
behalf. Hook scripts referenced from `.agents/hooks.json` are checked for existence and
executable permissions by `hooks.integrity`; moving a script without updating the registry
fails the next gate.

## Gate Wiring

`tools/scripts/agent-verify.sh` runs `gate --ci` as an additional verification step. The
CI mode diffs against `origin/main` when available, falls back to `main`, then to
`HEAD~1`, and evaluates interoperability, documentation, and deployment together. The gate
is deterministic and offline: it performs no network calls and writes nothing except when
`health --write` is invoked separately. The repository test suite
(`pnpm agent:engineer:test`) exercises the same libraries with fixture trees and with the
real repository, so a green gate and a green suite cover both the abstract contract and the
live inventory.

## Documentation Sync

The documentation contract has two layers. First, the change-sync layer: if any changed
file is agent content (per the config roots, minus runtime excludes), at least one changed
file must live under the documentation root or the generated catalog directory. Second, the
completeness layer: all four required documents must exist, exceed 200 characters, and
contain every mandated `##` section (specification, usage, integration, runbook). The
catalog under `documentation/07-agentic-systems/` is regenerated from the live component
inventory by `docs --write`; committing the regenerated catalog together with component
changes keeps the published inventory truthful. A health report under
`documentation/03-audit-reports/` records the latest measured status and alert count.

Because the catalog is generated, never hand-edit it. Change the components, run
`pnpm agent:engineer:docs --write`, and commit the result in the same change set.
