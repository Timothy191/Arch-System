---
title: Drilling Department
created: 2026-05-16
updated: 2026-05-17
type: entity
tags: [department]
sources: [raw/articles/arch-systems-project-overview.md]
confidence: high
---

# Drilling Department

The Drilling department in Arch-Systems handles drill rig operations and bit depth telemetry for mining operations.

## Tabs

- dashboard — Drilling-specific KPI dashboard
- daily-log — Drilling shift log with depth tracking
- machines — Drill rig inventory and specs
- history — Historical drilling data and trends
- reports — Drilling reports and analysis
- tools — Drilling tools and calculators

## Key Features

- **Bit Depth Telemetry**: Real-time depth monitoring from drill rigs
- **Rig Inventory**: Track all drill rigs with serial numbers and active status
- **Depth Metrics**: Current depth at 1,240m with historical trends

## Dashboard KPIs

- **Current Depth**: Active drill depth in metres
- **Daily Progress**: Metres drilled per shift
- **Rig Utilization**: Percentage of rigs actively drilling
- **Bit Wear**: Estimated remaining bit life

## Database Tables

| Table           | Purpose                       | Key Columns                                        |
| --------------- | ----------------------------- | -------------------------------------------------- |
| `daily_logs`    | Shift-level drilling log      | `department_id`, `log_date`, `shift`, `machine_id` |
| `machines`      | Drill rig inventory           | `name`, `machine_type`, `serial_number`, `active`  |
| `machine_hours` | Per-rig utilization per shift | `machine_id`, `shift_date`, `hours_worked`         |
| `fuel_logs`     | Fuel consumption per rig      | `machine_id`, `shift`, `litres_used`               |

All tables use `department_id`-scoped RLS policies. See [[rls-policy]] for the policy template.

## Current Completeness Status

| Feature                    | Status  |
| -------------------------- | ------- |
| Dashboard                  | 80%     |
| Forms (daily-log)          | 75%     |
| Tables (machines, history) | 85%     |
| Charts                     | 70%     |
| Real-time updates          | 60%     |
| AI Assistant               | 75%     |
| Mobile responsiveness      | 60%     |
| **Overall**                | **72%** |

**Mobile:** Current mobile layout is desktop-first. Field operators on tablets need responsive form improvements. See [[mobile-pwa]] for the improvement roadmap.

## Related

- [[arch-systems]] — parent system
- [[rls-policy]] — security policies protecting drilling data
- [[design-system]] — UI conventions used in drilling forms
- [[database-schema]] — drilling-related table schemas
- [[mobile-pwa]] — mobile responsiveness roadmap
- [[analytics-reporting]] — planned advanced reporting for drilling KPIs
