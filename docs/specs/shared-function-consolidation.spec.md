# EARS Specification: Codebase Duplication Consolidation & Shared SSoT Extraction

- **Spec ID**: `SPEC-SHARED-CONSOLIDATION-2026-11`
- **Status**: `APPROVED`
- **Created**: `2026-11-09`
- **Author**: `Antigravity Agent`

---

## 1. Objective

Eliminate redundant function, component, hook, and utility implementations across `apps/portal`, `libs/`, `packages/`, and `tools/` by extracting shared Single-Source-of-Truth (SSoT) modules while strictly preserving monorepo boundary rules (`tools/repo/policy-compiler.cjs`), zero circular dependencies (`pnpm cycles`), and zero dead code (`pnpm knip`).

---

## 2. EARS Requirements

### 2.1 Ubiquitous Requirements

- **REQ-001**: The system SHALL maintain a single canonical implementation for repeated server action and API route guards (`assertAdmin`, `assertAccessControlRole`, `authorizeRedisProxyRequest`), CSV export utilities (`sanitizeCsvCell`), and BullMQ workflow queue initialization (`getRedisConnectionOptions`, `getWorkflowQueue`).
- **REQ-002**: The `@repo/ui/Logo` module SHALL export the canonical `ARCH_LOGO_PATH` and `ARCH_LOGO_VIEWBOX` constants consumed across all UI components and telemetry sparkline graphs.
- **REQ-003**: The `@repo/supabase` package SHALL resolve `supabaseUrl` and `supabaseAnonKey` from a single `resolveSupabasePublicConfig()` helper across `middleware.ts`, `proxy.ts`, and `server.ts`.

### 2.2 Event-Driven Requirements

- **REQ-004**: WHEN a department telemetry dashboard (`ControlRoomSummaryGridClient`, `ExcavatorActivityTelemetryOverview`, `MachineOperationsKpiStrip`) renders a golden telemetry sparkline or computes sparkline points, THE system SHALL invoke the shared `<GoldenTelemetrySparkline />` and `buildSparklinePoints()` module.
- **REQ-005**: WHEN an error boundary (`app/error.tsx`, `app/hub/error.tsx`, `app/(departments)/[department]/error.tsx`, `ErrorFallback.tsx`) formats an `Error` or `AppError`, THE system SHALL delegate to the shared `error-display.ts` helpers (`getErrorTitle`, `getErrorMessage`, `getActionLink`).
- **REQ-006**: WHEN client telemetry or HLC comparison is invoked in `apps/portal` or `libs/shared/hooks`, THE system SHALL delegate to `@repo/shared/hooks` (`client-telemetry.ts`) and `@repo/utils/hlc` (`compareHlc`) respectively.

### 2.3 Unwanted Behavior (If-Then) Requirements

- **REQ-007**: IF a module in `packages/ui` is refactored, THEN it SHALL NOT import from `packages/database`, `packages/supabase`, or `apps/portal`.
- **REQ-008**: IF compiler-generated files (`.well-known/workflow/v1/*`) or client/server subpath split modules (`excel.ts` vs `excel.server.ts`) are encountered, THEN the refactoring SHALL NOT merge them.

---

## 3. Acceptance Criteria & Verification

1. `pnpm type-check` passes with 0 errors across all packages.
2. `pnpm lint` (Biome + agent-rules) passes with 0 errors.
3. `pnpm policy:check`, `pnpm cycles`, and `pnpm knip` report 0 boundary violations, 0 circular dependencies, and 0 unused exports.
4. `pnpm agent:verify` passes all 27/27 gates.
