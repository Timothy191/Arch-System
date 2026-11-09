# Spec: Token Distribution & Context Efficiency Optimizations

## 1. Objective

Eliminate redundant tool-output token inflation during task completion by deduplicating back-to-back 27-gate runs in `.husky/pre-push`, silencing verbose `lint-staged` progress logs in `.husky/pre-commit`, and extracting `GIT_PROVENANCE_METRICS` from the monolithic `apps/portal/app/overview/lib/data.ts` into a focused module.

## 2. Scope

- `tools/scripts/agent-verify.sh`: Record `gitTreeHash` (`git rev-parse HEAD^{tree}`) in `.ci-local/agent-verify-evidence.json`.
- `.husky/pre-push`: Verify `.ci-local/agent-verify-evidence.json` before invoking `bash tools/scripts/agent-verify.sh`. If all 27 gates passed (`passedGates === 27 && failedGates === 0`) within the last 15 minutes (`900,000` ms), skip the redundant second execution.
- `.husky/pre-commit`: Pass `--quiet` to `pnpm lint-staged --quiet` so successful pre-commit formatting/type checks do not emit ~18 KB of progress spinners into background task logs.
- `apps/portal/app/overview/lib/provenance-metrics.ts` & `apps/portal/app/overview/lib/data.ts`: Extract `GIT_PROVENANCE_METRICS` into a standalone 35-line module and re-export it from `data.ts` to avoid reading 1,675 lines when inspecting provenance/migration metrics.

## 3. Acceptance Criteria

1. **WHEN** `pnpm agent:verify` completes with `27/27 PASS`, **THE SYSTEM SHALL** write `.ci-local/agent-verify-evidence.json` containing `passedGates: 27`, `failedGates: 0`, `completedAt`, and `gitTreeHash`.
2. **WHEN** `git push` triggers `.husky/pre-push` within 15 minutes of a passing `pnpm agent:verify` run, **THE SYSTEM SHALL** validate `.ci-local/agent-verify-evidence.json` in `<100ms` and skip redundant gate re-execution; otherwise it shall execute `bash tools/scripts/agent-verify.sh`.
3. **WHEN** `.husky/pre-commit` runs on `git commit`, **THE SYSTEM SHALL** execute `pnpm lint-staged --quiet` without verbose task-progress output unless a check fails.
4. **WHEN** `OverviewPage` and `OverviewHeaderVisuals` import `GIT_PROVENANCE_METRICS`, **THE SYSTEM SHALL** resolve the exported object identically via `provenance-metrics.ts` and `data.ts`.

## 4. Constraints & Rollback

- **Constraints**: Never bypass `agent-verify.sh` if `.ci-local/agent-verify-evidence.json` is missing, failed, or older than 15 minutes (`900,000` ms), or if `FORCE_AGENT_VERIFY=1` is set.
- **Rollback**: `git revert` the optimization commit on `main`.
