---
title: Engineering Department
created: 2026-05-16
updated: 2026-05-17
type: entity
tags: [department]
sources: [raw/articles/arch-systems-project-overview.md]
confidence: high
---

# Engineering Department

The Engineering department in Arch-Systems handles equipment specifications, maintenance tracking, and CAD integration. It includes a specialized breakdowns workflow for equipment book-in/book-out.

## Tabs

- dashboard — Engineering KPI dashboard & maintenance hub
- breakdowns — Equipment breakdown book-in/book-out workflow
- tire-management — Fleet tire inspections, pressure, tread depth & replacement lifecycle
- daily-log — Engineering shift log
- machines — Equipment inventory and specs
- history — Historical maintenance records
- reports — Engineering reports and analysis
- tools — Engineering tools and calculators

## Key Features

- **Breakdown Management**: Book-in/book-out workflow via `breakdowns` table with status tracking (`active`/`completed`), date/time tracking, and soft delete support
- **Tire Fleet Management**: Serial tracking, tread depth wear monitoring, psi pressure telemetry, wheel position mapping, and replacement audit logs (`tires` & `tire_inspections` tables)
- **Equipment Inventory**: Machine specs, serial numbers, and active status per department
- **Maintenance Tracking**: Repair notes, failure reasons, and completion records
- **Pending Work**: Currently 12 pending items

## Breakdown Workflow

1. **Book-in**: Record `date_in`, `time_in`, `fleet_id`, `machine_type`, and `reason`
2. **Investigation**: Add `repair_notes` during diagnosis and repair
3. **Book-out**: Set `date_out`, `time_out`, mark `status = 'completed'`
4. **Audit**: `created_by` and `completed_by` track who performed each step

## Dashboard KPIs

- **Active Breakdowns**: Currently open equipment issues
- **MTTR**: Mean time to repair
- **Pending Work**: Items awaiting attention
- **Completed Today**: Breakdowns resolved this shift

## Current Completeness Status

| Feature                                | Status   |
| -------------------------------------- | -------- |
| Dashboard & Maintenance Hub            | 100%     |
| Breakdowns (Book In / Out & Drafting)  | 100%     |
| Tire Management (Modals, Curves, Logs) | 100%     |
| Fleet Audit Exports (CSV / JSON API)   | 100%     |
| Equipment Tables (Machines, Specs)     | 100%     |
| Reliability & Predictive MTBF Engine   | 100%     |
| Real-time Telemetry & Service Triggers | 100%     |
| Living System Documentation & SOPs     | 100%     |
| **Overall**                            | **100%** |

**Status**: Verified complete. Production-ready asset maintenance, tire life-cycle tracking, and offline field mechanic drafting workflows.

## Related

- [[arch-systems]] — parent system
- [[rls-policy]] — security policies protecting engineering data
- [[design-system]] — UI conventions used in engineering forms
- [[database-schema]] — breakdowns table schema
- [[mobile-pwa]] — mobile responsiveness roadmap (field breakdown reporting)
- [[analytics-reporting]] — MTTR trends and predictive maintenance ML model
