# Departments UI Agent Tracer

## 2026-08-25 - Workspace Dependency Link

**Purpose**: Declare the shared hooks package imported by the departments UI.

**Changes**: Added `@repo/shared/hooks` as a pnpm workspace dependency.

**Handoff**: The departments UI hook import now resolves through an explicit workspace link.

## Session 2026-08-21 (Satellite Monitoring Dashboard Presentation-Only Refactor)

- **Purpose**: Remove fake/mock data generation from the Satellite Monitoring dashboard so it becomes a presentational component that receives real readings and scenes from Server Components in `apps/portal`.
- **Changes**:
  - `src/satellite/SatelliteMonitoringDashboard.tsx`: Converted to a presentational component accepting `readings`, `s1Scenes`, `s2Scenes`, `latestS2Pass`, and `defaultTab` props. KPIs, alert counts, and zone cards now derive from `readings`. Wired `SARLayerPanel` to `s1Scenes`, `HyperspectralLayer` to `s2Scenes`, and `HighResPanel` to `s2Scenes`. Replaced the fake "live S2 pass" badge with an honest timestamp or "no recent cloud-free pass" fallback. Added an empty-state banner when no InSAR readings exist.
  - `package.json`: Added missing dependency on `@repo/shared/data-access` for shared deformation types and mapping.
- **Verification**:
  - `pnpm nx type-check features-departments-ui` ✅
- **What the Next Agent Should Know**: `SatelliteMonitoringDashboard` no longer generates its own data. All five call sites in `apps/portal/app/(departments)/[department]/` and its sub-pages now fetch via `getSatelliteMonitoringData()` and pass props down.
