---
title: Department Features
created: 2026-05-15
updated: 2026-10-29
type: concept
tags: [application, system, concept]
sources: [raw/codebase/department-features.md]
confidence: high
---

# Department Features

The portal supports core operational modules on `/hub` (operational departments plus Plant & Processing, Plant Inventory, System Overview, and Database), each with specialized tabs, data entry forms, and real-time views. Department configuration is centralized in `libs/features/departments/data-access/src/departments.ts`.

## Operational Modules List

| Slug             | Display Name       | Color   | Focus                                                              |
| ---------------- | ------------------ | ------- | ------------------------------------------------------------------ |
| drilling         | Drilling           | blue    | Drill rig operations & bit depth telemetry                         |
| production       | Production         | emerald | Coal yield, tonnage & extraction tracking                          |
| plant-processing | Plant & Processing | emerald | Wash plant telemetry, 12-hour DMS hourly input sheet & seam blends |
| plant-inventory  | Plant Inventory    | amber   | Wash plant equipment registry, critical spares & stock levels      |
| access-control   | Access Control     | blue    | Site access, badging, QR verification & muster roll call           |
| engineering      | Engineering        | violet  | Equipment specs, breakdowns, tire management & maintenance         |
| control-room     | Control Room       | red     | SCADA systems, hourly loads, fleet overview & real-time monitoring |
| system-overview  | System Overview    | cyan    | React Flow architecture diagrams, codebase maps & audits           |
| database         | Database           | indigo  | Live Supabase PostgreSQL 17 schema explorer & metrics              |

## Standard Tabs

Most departments share these tabs:

| Tab       | Purpose                                                 |
| --------- | ------------------------------------------------------- |
| dashboard | Department overview with KPIs and alerts                |
| daily-log | Shift log entry (machine hours, fuel, production)       |
| machines  | Equipment registry and status                           |
| history   | Historical data view                                    |
| reports   | Report generation and templates                         |
| tools     | External tools (Flowise, Univer) + productivity widgets |

## Control Room (Specialized)

The control room has the most specialized tab set, optimized for real-time mining operations monitoring:

| Tab                | Data Model                                  | Key Features                                                                                               |
| ------------------ | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| dashboard          | Aggregated KPIs                             | Real-time alerts (`AlertPanel` single-pass horizons), SCADA panels, activity feed                          |
| hourly-loads       | [[hourly-loads]] table                      | 12-hour shift grid, auto-totals, shift toggle                                                              |
| machine-operations | [[machine-operations]] table                | Operator assignment, Dozer `Roll Over` (`250 BCM/h`) vs `Other`, Drill Rig sync, breakdown auto-carry-over |
| operational-delays | [[operational-delays]] table                | Categorized delays, impact assessment, recovery tracking                                                   |
| engineering-notes  | [[engineering-notes]], [[delay_entries]]    | 20-column Fleet Overview Ledger (`12.0h` cap), 3-Step Quick Delay Logger, automatic breakdown carry-over   |
| excavator-activity | [[excavator-activity]] table                | Pass/load/cycle tracking, instant optimistic `Waste / Coal` toggle, dumper assignments                     |
| roll-over          | [[dozer-rolls]] table                       | Dozer roll-over event logging                                                                              |
| machines           | [[machines]] table                          | Full machine database with bin_factor for dumpers                                                          |
| reports            | [[report-templates]], [[generated-reports]] | Template-based report generation                                                                           |

## Plant & Processing (`/plant-processing`)

| Route                            | Key Features                                                                                                                                                                                                                                        |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/plant-processing`              | Wash Plant Telemetry Dashboard (ROM Scale, Product Yield, Product Ash, Running Density, Live Production Pulse Graph, Production Mix Pie Chart)                                                                                                      |
| `/plant-processing/hourly-sheet` | 12-Hour Wash Plant Input Matrix (`DMS-MOD-1` / `DMS-MOD-2`) with coal seam selectors (`Seam 2 Lower`, `Seam 4 Upper`, `4#Lower`, `2#Lower`, `2#Upper`, `5#Seam`, `ROM Blend A`, `High-Ash Stockpile`) and auto-calculated hourly variance (`Δ Var`) |
| `/plant-processing/delays`       | Plant circuit downtime book-in / book-out, quick-add equipment, and delay pareto analytics                                                                                                                                                          |
| `/plant-processing/history`      | Monthly, Daily, and Hourly wash plant rollup database and CSV export                                                                                                                                                                                |

### Control Room Data Entry Forms

Forms use the four-state pattern (`idle`/`submitting`/`success`/`error`) with `createBrowserSupabaseClient()` and `router.refresh()` for revalidation.

## Engineering (Breakdowns)

| Tab        | Data Model           | Key Features                                            |
| ---------- | -------------------- | ------------------------------------------------------- |
| dashboard  | Aggregated KPIs      | Pending breakdowns count, fleet status                  |
| breakdowns | [[breakdowns]] table | Book-in/book-out workflow, direct checkout, soft delete |
| daily-log  | [[daily-logs]]       | Standard shift logging                                  |
| machines   | [[machines]]         | Equipment registry                                      |
| history    | [[audit-logs]]       | Audit trail for breakdown changes                       |
| reports    | [[report-templates]] | Report generation                                       |
| tools      | External tools       | Flowise, Univer                                         |

### Breakdown Workflow

1. **Book In**: Operator logs machine breakdown with fleet_id, reason, date_in, time_in
2. **Book Out**: Operator completes repair with date_out, time_out, repair_notes
3. **Direct Checkout**: For cases where book-in was missed — creates completed record with `missing_book_in = true`
4. **Soft Delete**: Admin-only — sets `deleted_at` timestamp

All operations are audited. See [[breakdowns-actions]] for server action details.

## System Overview & Database Modules

- **System Overview (`/overview`)**: Interactive React Flow architecture topology across Overview, Architecture, Database, Dependencies, Flows, Security, Performance, and Codebase Maps tabs.
- **Database (`/database`, `/database/schemas`)**: Live Supabase PostgreSQL 17 telemetry, schema explorer (`public`, `auth`, `storage`, `realtime`, `supabase_migrations`, `extensions`), and backup history.

## Productivity Tools (Hub)

Available on the hub page for all authenticated users:

| Tool         | Purpose                        |
| ------------ | ------------------------------ |
| Tasks        | Daily to-do list               |
| Documents    | Shared files & templates       |
| Schedule     | Site-wide shift calendar       |
| Calculations | Operational formulas           |
| Notes        | Personal and shared site notes |

## Adding a New Department

1. Add department to `DEPARTMENTS` array in `lib/departments.ts`
2. Add tab configuration for the new department (or use standard tabs)
3. Create route folder: `app/(departments)/[department]/<new-dept>/`
4. Write a migration in `packages/database/migrations/` to insert the department row
5. Push migration: `cd packages/database && pnpm supabase:push`
6. Verify in Supabase Studio and the portal UI

Related pages: [[portal-app-architecture]], [[database-schema]], [[monitoring-error-tracking]]
