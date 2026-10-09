# (departments)/access-control/components/

**Kind:** module · **Files:** 9

## Responsibility

Supporting module directory for (departments)/access-control/components.

## Design

- Client components ("use client"): DashboardChartsRow.tsx, HeadcountMusterBanner.tsx, HourlyAccessChart.tsx, PerimeterGateHUD.tsx, QRStatusDistributionChart.tsx, QuickActionHub.tsx
- Hooks referenced: useState
- Exports:
  - `DashboardActivityFeed.tsx` → DashboardActivityFeed, default
  - `DashboardChartsRow.tsx` → DashboardChartsRow, default
  - `DashboardEntityStatus.tsx` → DashboardEntityStatus, default
  - `DashboardKPIGrid.tsx` → DashboardKPIGrid, default
  - `HeadcountMusterBanner.tsx` → HeadcountMusterBanner
  - `HourlyAccessChart.tsx` → HourlyAccessChart, default
  - `PerimeterGateHUD.tsx` → PerimeterGateHUD
  - `QRStatusDistributionChart.tsx` → QRStatusDistributionChart, default
  - `QuickActionHub.tsx` → QuickActionHub

## Flow

Imported by the parent route; exposes the exports listed above.

- Local imports consumed: actions

## Integration

- Cross-check against `codebase-maps/latest/` for the current architectural snapshot.
