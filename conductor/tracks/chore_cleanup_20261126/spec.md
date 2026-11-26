# Specification: Dead-Code Cleanup & `effect` Vulnerability Triage (`chore_cleanup_20261126`)

## Overview

Address the concrete static-analysis and security audit findings surfaced in the codebase health scan:

1. **Non-Production Dependency Vulnerability**: Triage and resolve (or document/override if transitive) the high-severity `effect` ReDoS vulnerability (`Schema.TemplateLiteral` compiled regex) flagged by `node tools/audits/run-audit.cjs --check`.
2. **Dead Code & Unused Dependencies (`pnpm knip --config config/tools/knip.json`)**: Verify no dynamic/string references exist and prune the 11 unused items:
   - **Unused files (3)**:
     - `apps/portal/app/(departments)/access-control/card-actions/card-actions-view.tsx`
     - `apps/portal/app/(departments)/access-control/card-actions/qr-section.tsx`
     - `scripts/gate-heartbeat-probe.mjs`
   - **Unused dependencies (2)** in `apps/portal/package.json`:
     - `@flags-sdk/vercel`
     - `@vercel/analytics`
   - **Unused exports (4)**:
     - `bulkPrintCardsForPersonnel` (`apps/portal/app/(departments)/access-control/card-actions/actions.ts`)
     - `getCardTemplates` (`apps/portal/app/(departments)/access-control/card-actions/actions.ts`)
     - `bulkQueueNeo300PrintJobs` (`apps/portal/app/(departments)/access-control/print-cards/actions.ts`)
     - `getTrackedWorkflowStatus` (`apps/portal/lib/jobs/workflow-runner.ts`)
   - **Unused exported types (2)**:
     - `TirePosition` (`apps/portal/app/(departments)/[department]/tire-management/tire-constants.ts`)
     - `TrackedDatabaseTableName` (`apps/portal/app/(departments)/database/department-database-catalog.ts`)

## Acceptance Criteria

- `pnpm knip --config config/tools/knip.json` reports 0 unused files, dependencies, exports, and exported types.
- `node tools/audits/run-audit.cjs --check` passes without high/critical `effect` vulnerability warnings (or has a documented, minimal pnpm override/resolution if transitive).
- `pnpm --filter portal type-check`, `pnpm lint`, and `pnpm agent:verify` pass.
- `conductor/tracks/chore_cleanup_20261126/plan.md` and `conductor/tracks.md` are updated to `[x]` upon completion.
