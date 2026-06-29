---
title: Department Features
created: 2026-05-15
updated: 2026-05-15
type: concept
tags: [application, system, concept]
sources: [raw/codebase/department-features.md]
confidence: high
---

# Department Features

The portal supports 8 departments, each with specialized tabs, data entry forms, and real-time views. Department configuration is centralized in `lib/departments.ts`.

## Department List

| Slug                 | Display Name         | Color   | Focus                                       |
| -------------------- | -------------------- | ------- | ------------------------------------------- |
| drilling             | Drilling             | blue    | Drill rig operations & bit depth telemetry  |
| production           | Production           | emerald | Coal yield, tonnage & extraction tracking   |
| access-control       | Access Control       | blue    | Site access, badging & security             |
| engineering          | Engineering          | violet  | Equipment specs, maintenance & CAD          |
| control-room         | Control Room         | red     | SCADA systems & real-time monitoring        |
| safety               | Safety               | blue    | Incident logs, compliance & inspections     |
| training             | Training             | cyan    | LMS, certifications & competency tracking   |
| satellite-monitoring | Satellite Monitoring | indigo  | SAR/InSAR, hyperspectral & high-res imagery |

## Standard Tabs

Most departments share these tabs:

| Tab       | Purpose                                                      |
| --------- | ------------------------------------------------------------ |
| dashboard | Department overview with KPIs and alerts                     |
| daily-log | Shift log entry (machine hours, fuel, production)            |
| machines  | Equipment registry and status                                |
| history   | Historical data view                                         |
| reports   | Report generation and templates                              |
| tools     | External tools (n8n, Flowise, Univer) + productivity widgets |

## Control Room (Specialized)

The control room has the most specialized tab set, optimized for real-time mining operations monitoring:

| Tab                | Data Model                                  | Key Features                                               |
| ------------------ | ------------------------------------------- | ---------------------------------------------------------- |
| dashboard          | Aggregated KPIs                             | Real-time alerts, SCADA panels, activity feed              |
| hourly-loads       | [[hourly-loads]] table                      | 12-hour shift grid, auto-totals, shift toggle              |
| machine-operations | [[machine-operations]] table                | Operator assignment, site tracking, auto hours calc        |
| operational-delays | [[operational-delays]] table                | Categorized delays, impact assessment, recovery tracking   |
| engineering-notes  | [[engineering-notes]] table                 | Issue severity, follow-up flags, resolution workflow       |
| excavator-activity | [[excavator-activity]] table                | Pass/load/cycle tracking, material type, tonnage estimates |
| roll-over          | [[dozer-rolls]] table                       | Dozer roll-over event logging                              |
| machines           | [[machines]] table                          | Full machine database with bin_factor for dumpers          |
| reports            | [[report-templates]], [[generated-reports]] | Template-based report generation                           |
| satellite          | [[monitoring-api]]                          | SAR/InSAR deformation, Copernicus STAC scenes, map tiles   |

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
| tools      | External tools       | n8n, Flowise, Univer                                    |

### Breakdown Workflow

1. **Book In**: Operator logs machine breakdown with fleet_id, reason, date_in, time_in
2. **Book Out**: Operator completes repair with date_out, time_out, repair_notes
3. **Direct Checkout**: For cases where book-in was missed — creates completed record with `missing_book_in = true`
4. **Soft Delete**: Admin-only — sets `deleted_at` timestamp

All operations are audited. See [[breakdowns-actions]] for server action details.

## Safety

| Tab       | Data Model           | Key Features                                  |
| --------- | -------------------- | --------------------------------------------- |
| dashboard | Aggregated KPIs      | Incident severity distribution, LTI-free days |
| daily-log | [[daily-logs]]       | Standard shift logging                        |
| machines  | [[machines]]         | Equipment registry                            |
| history   | [[safety-incidents]] | Incident history with investigation status    |
| reports   | [[report-templates]] | Compliance reports                            |
| tools     | External tools       | n8n, Flowise, Univer                          |

### Safety Incident Workflow

| Status              | Meaning                           |
| ------------------- | --------------------------------- |
| open                | New incident, needs investigation |
| under-investigation | Root cause analysis in progress   |
| resolved            | Corrective action applied         |
| closed              | Final review complete             |

Severity levels: low, medium, high, critical (with weights 1-4).
Categories: Slip/Trip/Fall, Equipment Contact, Vehicle Incident, Hazardous Material, Environmental, Near Miss, Other.

## Satellite Monitoring

| Tab           | Data Source        | Key Features                                      |
| ------------- | ------------------ | ------------------------------------------------- |
| overview      | [[monitoring-api]] | Deformation summary, latest imagery               |
| sar           | Copernicus STAC    | Sentinel-1 SAR scenes, InSAR deformation readings |
| hyperspectral | Copernicus STAC    | Sentinel-2 optical, NDVI composites               |
| highres       | Copernicus STAC    | High-resolution scene browser                     |

Uses `react-map-gl` + `maplibre-gl` for map visualization. Tile layers from EOX WMTS (free, no API key).

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
