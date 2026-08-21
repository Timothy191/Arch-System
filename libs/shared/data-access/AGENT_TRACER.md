# Shared Data Access Agent Tracer

## Session 2026-08-21 (Satellite Deformation Adapter + Test Infrastructure)

- **Purpose**: Provide a shared, reusable mapping layer that turns persisted `satellite_deformations` rows into the `DeformationReading` domain model consumed by dashboards, and back that layer with unit tests.
- **Changes**:
  - `src/monitoring-api.ts`: Added `DeformationDbRow` interface matching the Supabase `satellite_deformations` table, and `mapDeformationRowsToReadings()` which groups rows by `location_name`, sorts chronologically, derives LOS velocity from the latest two acquisitions, falls back to persisted `risk_level` for single-acquisition zones, infers tailings/storage pit/wall/open-pit area from location keywords, and builds full chronological history.
  - `jest.config.js` [NEW]: Node-based Jest config using `@swc/jest` and `forceExit: true`.
  - `package.json`: Added `test` script and dev dependencies for `jest`, `@types/jest`, `@swc/jest`.
  - `src/monitoring-api.test.ts` [NEW]: 8 unit tests covering empty input, grouping, velocity derivation, deformation-level classification, risk-level fallback, area inference, chronological history, and the no-fabrication invariant.
- **Verification**:
  - `pnpm nx type-check shared-data-access` ✅
  - `pnpm nx test shared-data-access` ✅ (8/8)
- **What the Next Agent Should Know**: This package now owns the canonical `satellite_deformations` → `DeformationReading` mapping. Any future schema change to `satellite_deformations` must update both `DeformationDbRow` and the test factory in `monitoring-api.test.ts`.
