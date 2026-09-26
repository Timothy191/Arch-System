# Seeds Package Agent Tracer

## Session 2026-08-24 (Operational Department Seed Generators & CLI Orchestration)

- **Purpose**: Implement modular, deterministic database seed generators for operational mining departments (Drilling, Production & Processing, Geology & Satellite Monitoring, Control Room).
- **Changes**:
  - `seed.ts`: Re-architected as a centralized orchestrator supporting multi-department execution and CLI argument filtering (`-- control-room`, `-- drilling`, `-- production`, `-- geology`). Improved `.env` discovery across monorepo root and `apps/portal`.
  - `generators/control-room.ts`: Extracted and structured 12-hour day-shift `hourly_loads` and `machine_operations` generation.
  - `generators/drilling.ts`: Added generation for `drill_operations` (meters drilled, hole counts, delay minutes) and streaming `machine_telemetry` snapshots (RPM, bit depth, torque, hydraulic pressure).
  - `generators/production.ts`: Added daily extraction yield generators for `daily_logs`, `production_logs` (coal vs. waste tonnes), and `material_density` calibrations.
  - `generators/geology.ts`: Added satellite InSAR interferometry deformation records (`satellite_deformations`) covering highwall and tailings dam displacement sensors.
- **Verification**:
  - `pnpm --filter scripts-seeds run seed` ✅
  - `pnpm --filter scripts-seeds run type-check` ✅
  - `pnpm --filter @repo/departments/data-access run type-check` ✅
- **What the Next Agent Should Know**: Each generator safely uses upsert or constraint checks to prevent duplicate records or unbounded row ballooning on subsequent executions.
