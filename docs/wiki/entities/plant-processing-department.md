---
title: Plant & Processing Department
created: 2026-10-29
updated: 2026-10-29
type: entity
tags: [department, system, workflow]
sources: [apps/portal/features/departments/components/plant-processing/types.ts]
confidence: high
---

# Plant & Processing Department

The Plant & Processing (`plant-processing`) department in [[arch-systems|Arch-Systems]] manages Dense Medium Separation (DMS) wash plant hourly input sheets, circuit throughput, product yield, cyclone relative density (RD), and plant stoppage/delay tracking across Day (`06:00–17:00`) and Night (`18:00–05:00`) shifts.

## Tabs & Sub-Routes

- `dashboard` — Plant KPI overview, hourly ROM vs. Clean Coal throughput, yield percentage, and recent circuit delays (`PlantHourlyRollupSection`)
- `hourly-sheet` — 12-hour shift matrix for **DMS Module 1 (`DMS-MOD-1`)** and **DMS Module 2 (`DMS-MOD-2`)** (`PlantHourlySheetClient`, `PlantHourlyMatrixSection`)
- `delays` — Plant circuit stoppage, reduced throughput, and single-circuit bypass event logging (`PlantDelaysClient`, `PlantDelaysAnalyticsSection`, `PlantDelaysWrapupSection`)
- `history` — Historical shift sheets, daily/monthly rollups, and CSV/JSON export (`PlantHistoryDatabaseClient`)
- `equipment` — Quick-add plant circuit and unit registry (`quickAddPlantEquipment`)

## Key Features

- **12-Hour Shift Input Matrix**: Tracks hourly `ROM Feed (t)`, `Plant Feed (t)`, `Cyclone Feed (t)`, `Product Scale (t)`, `Clean Coal (t)`, `Discard (t)`, auto-calculated `Yield %`, `Product Ash %`, `Cyclone RD`, `Moisture %`, and `Run Minutes` (0–60 min).
- **Seam & Material Source Selector (`PLANT_SEAM_OPTIONS`)**: Both the header-level `Circuit & Unit Material` selector (`#circuit-unit-header-material`) and row-level seam selectors support:
  - `Seam 2 Lower`
  - `Seam 4 Upper`
  - `4#Lower`
  - `2#Lower`
  - `2#Upper`
  - `5#Seam`
  - `ROM Blend A`
  - `High-Ash Stockpile`
- **Plant Circuit Registry (`PLANT_CIRCUIT_OPTIONS`)**: Standardized wash plant circuits including `Primary Jaw Crusher (CR-101)`, `Secondary Sizing Screen (SC-201)`, `DMS Cyclone Module 1 (DM-301)`, `DMS Cyclone Module 2 (DM-302)`, `Fine Coal Spirals (SP-401)`, `Tailings Thickener & Press (TH-501)`, `Clean Coal Loadout Conveyor (CV-601)`, and `ROM Feed Bunker & Apron Feeder (AF-100)`.
- **Circuit Delay Classification**: Categorizes delays under `Mechanical`, `Electrical & PLC`, `Process / Density Excursion`, `Chute Blockage / Spillage`, `No ROM Feed / Starvation`, and `Planned Maintenance` with impact levels (`Full Plant Stoppage`, `Reduced Throughput`, `Single Circuit Bypass`).
- **Parallel RSC Data Fetching & Local Draft Persistence**: `getPlantProcessingWorkspaceData` executes parallel Supabase queries (`Promise.all`) for `plant_hourly_logs` and `plant_delays`, backed by local draft storage (`storage.ts`) for resilient pit/plant connectivity.

## Dashboard KPIs

- **ROM Feed Tonnes**: Total run-of-mine tonnes fed into `DMS-MOD-1` and `DMS-MOD-2`
- **Clean Coal Tonnes**: Washed product coal output
- **Plant Yield (%)**: Weighted `Clean Coal / ROM Feed` recovery percentage
- **Average Cyclone RD & Ash (%)**: Separation cut-point density and product quality metrics
- **Plant Availability (%)**: Run hours vs. total shift hours after circuit delays

## Database Tables

| Table               | Purpose                                                   | Key Columns                                                                                                                                              |
| ------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `plant_hourly_logs` | 12-hour shift matrix records per DMS module               | `id`, `operation_date`, `shift`, `module_id`, `operator_name`, `rows` (JSONB), `updated_at`                                                              |
| `plant_delays`      | Circuit stoppage and throughput reduction events          | `id`, `delay_date`, `shift`, `circuit`, `category`, `impact_type`, `start_time`, `end_time`, `duration_minutes`, `reason`, `corrective_action`, `status` |
| `machines`          | Plant circuit equipment registry (`department_id` scoped) | `id`, `department_id`, `name`, `machine_type`, `serial_number`, `active`                                                                                 |

All tables enforce `department_id`-scoped Row Level Security (RLS) policies and dual-tier cache invalidation (`cacheInvalidateTags(['plant-processing', 'department:plant-processing'])`).

## Related

- [[arch-systems]] — parent system
- [[department-features]] — cross-department feature architecture
- [[plant-inventory-department]] — companion wash plant reagents, dense medium (magnetite), and wear spares inventory
- [[production-department]] — upstream ROM coal extraction feeding the wash plant
- [[control-room-department]] — central SCADA and shift coordination
- [[database-schema]] — PostgreSQL schema and migration catalog
- [[rls-policy]] — Row Level Security standards
