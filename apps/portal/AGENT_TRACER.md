# Portal Agent Tracer

## 2026-06-25 - ⚡ Bolt: Memoize loadsByMachine Map in HourlyLoadsGrid

- **Purpose**: Optimize `HourlyLoadsGrid.tsx` to prevent unnecessary re-renders of the heavy `DataGrid` (RevoGrid) component and fix CI pipeline issues.
- **Changes**:
  - Wrapped `loadsByMachine` Map creation in `useMemo` with `hourlyLoads` and `selectedShift` as dependencies.
  - Implemented shift-based filtering during Map construction to ensure lookup callbacks only access data for the active shift.
  - Stabilized `getHourValue`, `getMachineTotal`, and `getMaterialType` callbacks by removing `selectedShift` from their dependency arrays.
  - Updated pnpm version to `9.15.9` in all GitHub workflows to resolve version mismatch errors.
  - Added `@types/node` to several packages to resolve Node.js global type errors (e.g., 'process') in CI.
  - Fixed Reviewdog ESLint installation by pinning glob version and ensuring build runs before type-check.
  - Fixed Accessibility Audit by using `npx --yes` for `serve` and `wait-on`.
  - Documented the "Memoize Derived Data in Render" performance pattern in `.jules/bolt.md`.
- **Next agent**: `loadsByMachine` is now shift-aware and stable. Ensure pnpm versions in workflows remain aligned with the root `packageManager` field.

## 2026-06-25 - Follow-up: metrics imports, Outfit font, observability paths

- **Purpose**: Fix broken `@repo/shared/data-accessmetrics` imports; load Outfit via next/font.
- **Changes**:
  - All portal jobs/reports/metrics routes → `@/lib/observability/metrics`.
  - `app/layout.tsx`: `Outfit` font with `--font-outfit` CSS variable on `<html>`.
- **Next agent**: Metrics module lives at `apps/portal/lib/observability/metrics.ts` only.

## 2026-06-25 - Alignment remediation: middleware → proxy + design tokens

- **Purpose**: Wire full auth stack and fix cross-package misalignments from alignment audit.
- **Changes**:
  - `middleware.ts`: Delegates to `server/proxy.ts` (session refresh, RBAC, dept isolation, Redis slug cache).
  - `server/proxy.ts`: Fixed broken metrics import (`@/lib/observability/metrics`).
  - Portal/UI: Replaced forbidden `shadow-lg/md/xl` with `shadow-window`, `shadow-diffusion-*`, `shadow-glow-*`.
- **Next agent**: Role/dept gating is live at the edge again; run `proxy.test.ts` after auth changes.

## 2026-06-25 - Phase 3 CSS cascade @layer verification

- **Purpose**: Confirm portal consumes consolidated `@layer` architecture via `@repo/ui/globals.css` (no portal-local globals.css).
- **Changes**: None in portal source — portal `app/layout.tsx` imports `@repo/ui/globals.css` which declares layer order and hosts all shared component/utility layers.
- **Next Steps**: Run `pnpm nx run portal:build` and manual QA on MacMenuBar, focus-mode, RevoGrid tables, modals.

## 2026-06-24 - Fix OpenTelemetry instrumentation build

- **Purpose**: Resolve portal build failure — `BatchSpanProcessor` was imported from undeclared `@opentelemetry/sdk-trace-node`.
- **Changes**:
  - `instrumentation.ts`: Import `BatchSpanProcessor` from `@opentelemetry/sdk-trace-base` (matches exporter peer dependency at 2.7.x).
  - `package.json`: Added explicit `@opentelemetry/sdk-trace-base` dependency.
- **Next Steps**: Re-run `pnpm nx run portal:build` after `pnpm install`.
