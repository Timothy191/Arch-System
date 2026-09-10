# Departments UI (@repo/departments/ui) — Agent Guidelines

## Scope & Purpose

Domain feature package housing departmental UI presentational components, interactive control panels, and operational dashboards for Control Room, Drilling, Engineering, and Production.

## Inner Loop Commands

- **Run all unit tests**: `pnpm turbo run test --filter=@repo/departments/ui`
- **Run targeted component spec**: `pnpm --filter @repo/departments/ui test -- -t "<ComponentName>"`
- **Type-check package**: `pnpm turbo run type-check --filter=@repo/departments/ui`
- **Lint package**: `pnpm turbo run lint --filter=@repo/departments/ui`

## Architectural Invariants

- **Boundary Scope (`scope:feature`)**:
  - Prohibited from importing application code (`apps/*`).
  - Prohibited from direct queries against `@repo/database-internal`.
  - UI components must remain strictly presentational; receive data via component props or TanStack React Query hooks from `@repo/departments/data-access`.
- **Design System Standards**:
  - Light mode only (macOS Sonoma aesthetic). Dark mode is explicitly unsupported.
  - Exclusively use OKLCH design tokens (`accent-blue`, `accent-green`, `accent-amber`, `bg-arch-surface-*`). Do not introduce arbitrary Tailwind color utilities (e.g. `bg-emerald-500`, `bg-slate-100`).
  - Use `font-medium` for text emphasis (never `font-bold` or `font-semibold` in hub/department interfaces).
- **Public API**:
  - All public components and utilities must be exported strictly through `src/index.ts`.

## Agent Tracing

- Log all modifications, context handoffs, and operational rationale in `AGENT_TRACER.md` with an ISO 8601 timestamp.
- Leave inline `// AGENT-TRACE: <explanation>` breadcrumbs for non-obvious UI invariants or edge-case handlers.
