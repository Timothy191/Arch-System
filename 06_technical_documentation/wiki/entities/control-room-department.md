---
title: Control Room Department
created: 2026-05-16
updated: 2026-05-16
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
- machine-operations — Detailed operational tracking with calculated hours
- operational-delays — Delay tracking with categories and durations
- engineering-notes — Technical notes with rich text editing
- excavator-activity — Excavator cycle tracking with dumper assignments
- shift-coverage — Shift personnel coverage tracking
- roll-over — Shift rollover and handoff management
- machines — Machine database and inventory
- reports — Operational reports and analysis
- satellite — Satellite monitoring integration

## Key Features

- **Hourly Load Grid**: 12-column grid (`hour_01` through `hour_12`) with auto-calculated `total_loads`
- **Machine Operations**: Track `start_time`, `end_time`, auto-calculated `hours_worked` via generated column
- **Excavator Activity**: Passes, loads, cycle times, material types, and dumper assignments via `excavator_dumper_assignments`
- **Delay Tracking**: Categorized delays with `delay_minutes` and `delay_category_id`
- **Shift Closeout**: Structured shift handoff workflow (migration 015)

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

## Related

- [[arch-systems]] — parent system
- [[rls-policy]] — security policies protecting control room data
- [[design-system]] — UI conventions used in control room interfaces
- [[database-schema]] — control room table schemas
- [[department-features]] — control room capabilities overview
