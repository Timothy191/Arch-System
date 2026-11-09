# Spec: Real-World 27-Gate & Zero-Mock Data Remediation

## 1. Objective

Upgrade `Arch-System` verification gates (`tools/scripts/agent-verify.sh`), version/metadata synchronization, data-access layers, and runtime resilience hooks (`useOfflineQueue`, `useSupabaseRealtime`, `/api/health`) to eliminate synthetic fallback curves, stale hardcoded version/migration counts, unmonitored spelling/style drift, and poison-pill offline retry loops.

## 2. Scope

- **Gate & Toolchain Hardening**:
  - `tools/scripts/agent-verify.sh`: Wire `pnpm lint:spelling` (`cspell`) and `pnpm lint:styles` (`stylelint`) into Gate 2.
  - `config/tools/cspell.json`: Add verified industrial and codebase terms (`unlogged`, `sparklines`, `tensioner`, `faststart`) so `pnpm lint:spelling` passes with zero errors across all 1,660+ files.
  - `tools/repo/generate-codebase-maps.cjs`: Dynamically count SQL migrations in `packages/database/migrations` instead of hardcoding `189 Applied Immutable Migrations`.
- **Versioning & Architecture Count Synchronization**:
  - `apps/portal/lib/version.ts`, `apps/portal/lib/integrations/mcp-client-manager.ts`, `packages/ui/src/components/GlassCard.stories.tsx`: Replace stale `'1.5.1'` fallback versions with `'1.6.2'`.
  - `apps/portal/app/overview/page.tsx`, `apps/portal/app/overview/lib/codebase-maps-data.ts`, `apps/portal/app/overview/sections/TechStack.tsx`, `apps/portal/app/overview/sections/BackendArchitecture.tsx`: Replace stale `"213 Migrations"` / `"213 SQL"` and `"8 Modules"` with accurate repository counts (`168 Migrations`, `13 Modules`).
- **Real-World Telemetry & Zero-Mock Data**:
  - `apps/portal/app/api/health/route.ts`: Probe `process.env.FUXA_URL` when configured instead of blindly cloning `redisStatus` and `redisLatencyMs`.
  - `libs/features/departments/data-access/src/department-live-metrics.ts`: Remove fabricated 8-point static prefix arrays (`[78, 80, 82, ...]`, `[42500, 43800, ...]`, `[22, 28, 31, ...]`) and arbitrary `+ 4` / `48200 +` arithmetic, returning real database-derived metrics.
  - `apps/portal/app/(departments)/access-control/components/DashboardKPIGrid.tsx`: Replace hardcoded static trend strings (`'+23 this week'`, `'Down from 7'`, etc.) with live status descriptors derived from `stats`.
  - `apps/portal/app/hub/page.tsx` & `apps/portal/app/hub/executive/page.tsx`: Query real open breakdown/incident counts rather than hardcoding `0`.
- **Runtime Resilience Hooks**:
  - `libs/shared/hooks/src/useOfflineQueue.ts`: Add `retryCount`, `MAX_RETRIES = 3`, and `deadLetterQueue` to prevent infinite poison-pill retry loops on 4xx client errors or permanently failing mutations.
  - `libs/shared/hooks/src/useSupabaseRealtime.ts`: Handle `CHANNEL_ERROR` status explicitly and support an `onReconnect` callback when recovering from `TIMED_OUT` / `CHANNEL_ERROR` / `CLOSED` back to `SUBSCRIBED`.

## 3. Acceptance Criteria

1. **WHEN** `pnpm lint:spelling` and `pnpm lint:styles` are executed, **THE SYSTEM SHALL** exit `0` with zero unknown words or CSS violations, and both checks shall run inside Gate 2 of `tools/scripts/agent-verify.sh`.
2. **WHEN** `/overview` or `codebase-maps/latest/*` are inspected, **THE SYSTEM SHALL** report the actual SQL migration file count (`168`) and module count (`13`), with zero stale `'1.5.1'` version strings remaining.
3. **WHEN** `/api/health` is queried, **THE SYSTEM SHALL** evaluate Fuxa SCADA via `FUXA_URL` (if configured) or report degraded/fallback status explicitly without cloning Redis latency.
4. **WHEN** `useOfflineQueue` processes a queued mutation that returns a non-retryable 4xx HTTP status or exceeds `MAX_RETRIES` (`3`), **THE SYSTEM SHALL** move the request out of the active queue into `deadLetterQueue` rather than retrying indefinitely.
5. **WHEN** `useSupabaseRealtime` receives a `CHANNEL_ERROR` event from Supabase Realtime, **THE SYSTEM SHALL** transition `status` to `'CHANNEL_ERROR'`, record `lastError`, and invoke `onReconnect` upon subsequent recovery to `'SUBSCRIBED'`.
6. **WHEN** `pnpm agent:verify` is executed, **THE SYSTEM SHALL** pass all 27 gates (`27/27 PASS`).

## 4. Constraints & Risks / Rollback

- **Constraints**: Preserve backward compatibility with existing Jest unit test contracts in `apps/portal`, `libs/shared/hooks`, and `libs/features/departments/data-access`, updating tests to verify the new real-world behavior.
- **Rollback**: `git revert` the remediation commit on `main`.
