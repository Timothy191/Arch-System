# Implementation Plan: Dead-Code Cleanup & `effect` Vulnerability Triage

## Phase 1: Triage & Verify References

- [x] Task: Audit `effect` dependency tree and check for safe upgrade/override
  - [x] Run `pnpm why effect` to identify which dev/non-prod package pulls in `effect`
  - [x] Apply `pnpm.overrides` or update the parent dependency if a patched version is available
- [x] Task: Verify no dynamic/string references to the 11 `knip` findings
  - [x] Search codebase for references to `card-actions-view`, `qr-section`, `gate-heartbeat-probe`, `@flags-sdk/vercel`, `@vercel/analytics`, and the 6 unused exports/types
- [x] Task: Phase Verification & Checkpoint (Refer to `conductor/workflow.md`)

## Phase 2: Prune Dead Code & Unused Dependencies

- [x] Task: Remove unused files and dependencies
  - [x] Delete `apps/portal/app/(departments)/access-control/card-actions/card-actions-view.tsx`, `qr-section.tsx`, and `scripts/gate-heartbeat-probe.mjs`
  - [x] Remove `@flags-sdk/vercel` and `@vercel/analytics` from `apps/portal/package.json` and update `pnpm-lock.yaml` if needed
- [x] Task: Remove or unexport unused exports and types
  - [x] Clean up `bulkPrintCardsForPersonnel`, `getCardTemplates`, `bulkQueueNeo300PrintJobs`, `getTrackedWorkflowStatus`, `TirePosition`, and `TrackedDatabaseTableName`
- [x] Task: Phase Verification & Checkpoint (Refer to `conductor/workflow.md`)

## Phase 3: Full Verification & Track Completion

- [x] Task: Run workspace verification gates
  - [x] Run `pnpm knip --config config/tools/knip.json` (expect 0 findings)
  - [x] Run `node tools/audits/run-audit.cjs --check`
  - [x] Run `pnpm --filter portal type-check`, `pnpm lint`, and `pnpm agent:verify`
- [x] Task: Mark track complete in `plan.md` and `conductor/tracks.md`
