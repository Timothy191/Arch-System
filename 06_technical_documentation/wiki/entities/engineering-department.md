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

- dashboard — Engineering KPI dashboard
- breakdowns — Equipment breakdown book-in/book-out workflow
- daily-log — Engineering shift log
- machines — Equipment inventory and specs
- history — Historical maintenance records
- reports — Engineering reports and analysis
- tools — Engineering tools and calculators

## Key Features

- **Breakdown Management**: Book-in/book-out workflow via `breakdowns` table with status tracking (`active`/`completed`), date/time tracking, and soft delete support
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

| Feature                    | Status  |
| -------------------------- | ------- |
| Dashboard                  | 90%     |
| Forms (breakdowns)         | 85%     |
| Tables (machines, history) | 95%     |
| Charts                     | 80%     |
| Real-time updates          | 75%     |
| AI Assistant               | 85%     |
| Mobile responsiveness      | 70%     |
| **Overall**                | **83%** |

**Mobile:** Breakdown book-in/book-out is filed by mechanics in the field. Touch-optimized fleet ID lookup and repair notes entry are key improvements. See [[mobile-pwa]].

## Related

- [[arch-systems]] — parent system
- [[rls-policy]] — security policies protecting engineering data
- [[design-system]] — UI conventions used in engineering forms
- [[database-schema]] — breakdowns table schema
- [[mobile-pwa]] — mobile responsiveness roadmap (field breakdown reporting)
- [[analytics-reporting]] — MTTR trends and predictive maintenance ML model
