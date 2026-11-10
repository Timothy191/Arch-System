# Specification: SSoT Duplicate Regression Guard, DepartmentFilterToolbar & Control Room Server-Timing Telemetry

**Status:** Implemented & Verified  
**Date:** 2026-11-10

## 1. Objective

Complete all 4 roadmap steps following the 20-cluster shared function/component/hook consolidation:

1. **Step 1 — Automated Duplicate-Symbol Regression Guard (`tools/audits/audit-ssot-duplicates.cjs`)**: Statically audit the monorepo to guarantee the 20 consolidated Single-Source-of-Truth (SSoT) symbols are declared exclusively in their canonical modules and never re-duplicated.
2. **Step 2 — Shared `DepartmentFilterToolbar` Primitive (`@repo/ui`)**: Create a reusable light-mode glass toolbar component (`packages/ui/src/components/DepartmentFilterToolbar.tsx`) for department search, shift/status filtering, date-range selection, and CSV/action slots, exported via `@repo/ui/DepartmentFilterToolbar` and `@repo/ui`, and adopt it in department views.
3. **Step 3 — Live Control Room W3C `Server-Timing` Telemetry Strip**: Create a shared W3C `Server-Timing` header parser (`apps/portal/lib/observability/server-timing-client.ts`) and surface live backend `Server-Timing` latency (`data-testid="scada-server-timing-badge"`) inside `ScadaPanel.tsx` from `/api/control-room/scada-status`, backed by unit tests.
4. **Step 4 — Full 27-Gate Verification, Real-Layer Telemetry Comparison, Branch Sync & Production Release**: Verify 27/27 gates (`pnpm agent:verify`), run `pnpm perf:compare`, merge into `main`, push to `origin/main` (and active remote branches), and confirm Vercel Production deployment.

---

## 2. EARS Requirements

- **REQ-1 (Ubiquitous)**: THE system SHALL enforce via `node tools/audits/audit-ssot-duplicates.cjs` (`pnpm audit:ssot-duplicates`, wired into `pnpm audit:compliance`) that each of the 20 consolidated SSoT functions/components/constants is declared only in its canonical SSoT file.
- **REQ-2 (Event-Driven)**: WHEN a developer or agent declares a duplicate function/const matching a protected SSoT symbol outside its canonical module, THE `audit-ssot-duplicates.cjs` gate SHALL exit with code `1` and report the offending file path and canonical SSoT import path.
- **REQ-3 (Ubiquitous)**: THE `@repo/ui` package SHALL export `DepartmentFilterToolbar` (`@repo/ui/DepartmentFilterToolbar` and barrel `@repo/ui`) adhering to light-mode OKLCH tokens, `<=20` Tailwind utilities per `className`, and `<=2` positional parameters.
- **REQ-4 (Event-Driven)**: WHEN `ScadaPanel` polls `/api/control-room/scada-status`, THE component SHALL parse the HTTP `Server-Timing` response header via `parseServerTimingHeader()` and render a telemetry badge (`data-testid="scada-server-timing-badge"`) displaying the primary server timing duration in milliseconds.

---

## 3. Acceptance Criteria & Verification

- `node tools/audits/audit-ssot-duplicates.cjs` exits `0` across all workspace files.
- `pnpm --filter portal test` passes unit tests for `server-timing-client.test.ts`, `ControlRoomPanels.test.tsx`, and `DepartmentFilterToolbar.test.tsx`.
- `pnpm agent:verify` passes **27/27 gates (`100% PASS`)**.
