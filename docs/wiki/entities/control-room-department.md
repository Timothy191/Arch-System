---
title: Control Room Department
created: 2026-05-16
updated: 2026-10-29
type: entity
tags: [department]
sources: [raw/articles/arch-systems-project-overview.md]
confidence: high
---

# Control Room Department

The Control Room department is the operational nerve center of Arch-Systems, providing SCADA systems integration and real-time monitoring across all mining operations. It has the most specialized tabs (11) of any department.

## Tabs

- dashboard — Real-time operational overview
- hourly-loads — 12-hour shift grid for load counting (Day: 06:00–18:00, Night: 18:00–06:00)
- machine-operations — Detailed operational tracking with calculated hours, Dozer activity (`Roll Over` at `250 BCM/h` vs `Other`), Drilling production auto-sync, and end-of-shift breakdown auto-carry-over
- operational-delays — Delay tracking with categories and durations
- engineering-notes — 20-column Full Fleet Shift SMR, Delays, Availability & Utilization Overview Ledger (`EngineeringOverviewTable`), 3-Step Guided Quick Delay Logger (`QuickDelayLoggerPanel`), automatic end-of-shift breakdown carry-over into the new shift, and Engineering Notes & Breakdowns feed
- excavator-activity — Excavator cycle tracking with dumper assignments and instant optimistic `Waste / Coal` material switching
- shift-coverage — Shift personnel coverage tracking
- roll-over — Shift rollover and handoff management
- machines — Machine database and inventory
- reports — Operational reports and analysis
- satellite — Satellite monitoring integration

## Key Features

- **Hourly Load Grid**: 12-column grid (`hour_01` through `hour_12`) with auto-calculated `total_loads`
- **Machine Operations**: Track `start_smu`, `end_smu`, auto-calculated `hours_worked`, Dozer `Roll Over` (`250 BCM/h` synced to `dozer_rollover_logs`) vs `Other` activity presets, and end-of-shift breakdown auto-carry-over
- **Engineering Overview Ledger**: 20-column shift ledger enforcing the `12.0h` shift cap (`SMR Worked + Delays <= 12.0h`), `2.4h` editable standard allowances, 3-Step Guided Quick Delay Logger, and automatic carry-over of breakdown machines into the next shift (`day` -> `night`, `night` -> `day`) until booked out (`Book Out`)
- **Excavator Activity**: Passes, loads, cycle times, instant optimistic `Waste / Coal` material toggles, and dumper assignments via `excavator_dumper_assignments`
- **Single-Pass Alert & Target Horizon Aggregation**: `AlertPanel` computes `shift`, `daily`, and `monthly` actuals vs targets in a single $O(N)$ pass
- **Shift Closeout**: Structured shift handoff workflow with supervisor PIN verification (migration 015)

## Database Tables

| Table                          | Purpose                                            |
| ------------------------------ | -------------------------------------------------- |
| `machine_operations`           | Shift-level machine activity with calculated hours |
| `hourly_loads`                 | 12-hour load grid per machine per shift            |
| `excavator_activity`           | Excavator cycles, passes, loads, material tracking |
| `excavator_dumper_assignments` | Dumper-to-excavator assignments with BCM           |
| `operational_delays`           | Delay logging with categories and durations        |
| `engineering_notes`            | Rich text technical notes                          |
| `dozer_rolls`                  | Dozer rollover records                             |

## Dashboard KPIs

- **Active Alerts**: Real-time operational alerts (currently 0)
- **Machines Operating**: Count of active machines
- **Total Loads**: Aggregate loads across all machines
- **Delay Minutes**: Total delay time this shift

## Current Completeness Status

| Feature                                | Status   |
| -------------------------------------- | -------- |
| Dashboard & Live Telemetry             | 100%     |
| Hourly Loads 12-Hour Grid              | 100%     |
| Machine Operations & Delay Entries     | 100%     |
| Engineering Notes & Rich Logging       | 100%     |
| Excavator Activity & Dumper Tracking   | 100%     |
| Operational Shift Checklist & Handover | 100%     |
| Database Migrations & RLS Policies     | 100%     |
| Living System Documentation & Specs    | 100%     |
| **Overall**                            | **100%** |

## Related

- [[arch-systems]] — parent system
- [[rls-policy]] — security policies protecting control room data
- [[design-system]] — UI conventions used in control room interfaces
- [[database-schema]] — control room table schemas
- [[department-features]] — control room capabilities overview
- [[control-room-department]] — living system documentation and SOPs
