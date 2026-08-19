---
title: Production Department
created: 2026-05-16
updated: 2026-05-17
type: entity
tags: [department]
sources: [raw/articles/arch-systems-project-overview.md]
confidence: high
---

# Production Department

The Production department in Arch-Systems handles coal yield, tonnage, and extraction tracking for mining operations.

## Tabs

- dashboard — Production-specific KPI dashboard
- daily-log — Production shift log with tonnage entry
- machines — Production equipment tracking
- history — Historical production data and trends
- reports — Production reports and yield analysis
- tools — Production calculators and tools

## Key Features

- **Coal Tonnage Tracking**: Daily coal extraction via `production_logs` table
- **Waste Tracking**: Waste tonnage recorded alongside coal for strip ratio
- **Yield Monitoring**: Current yield at 85% with trend analysis
- **Machine Hours**: Equipment utilization linked to production output

## Dashboard KPIs

- **Coal Yield**: Current extraction yield percentage
- **Daily Tonnage**: Coal tonnes extracted per shift
- **Waste Moved**: Overburden tonnes removed
- **Strip Ratio**: Waste-to-coal ratio

## Database Tables

| Table             | Purpose                         | Key Columns                                                           |
| ----------------- | ------------------------------- | --------------------------------------------------------------------- |
| `daily_logs`      | Shift-level production log      | `department_id`, `log_date`, `shift`, `total_tonnage`, `waste_tonnes` |
| `machines`        | Production equipment registry   | `name`, `machine_type`, `serial_number`, `active`                     |
| `machine_hours`   | Equipment utilization per shift | `machine_id`, `shift_date`, `hours_worked`                            |
| `fuel_logs`       | Fuel consumption per machine    | `machine_id`, `shift`, `litres_used`                                  |
| `production_logs` | Detailed extraction records     | `department_id`, `coal_tonnes`, `waste_tonnes`, `shift`               |

All tables use `department_id`-scoped RLS. Strip ratio (`waste_tonnes / coal_tonnes`) is typically computed at query time.

## Current Completeness Status

| Feature                                | Status    |
| -------------------------------------- | --------- |
| Materialized Summary View & Aggregate  | 100%      |
| Hourly Production Trend Engine (RPC)   | 100%      |
| Reconciliation Drift Classifier        | 100%      |
| Regulatory Export Engine (CSV/JSON)    | 100%      |
| Partition Tables & Database Schemas    | 100%      |
| Dashboard & Real-Time Production KPIs  | 90%       |
| Forms (Daily Log & Tonnage Submission) | 88%       |
| Tables (Machines, Fuel Logs, History)  | 95%       |
| Living System Documentation & SOPs     | 100%      |
| **Overall**                            | **94.0%** |

**Mobile:** Tonnage entry forms use touch-friendly numeric step inputs and automated reconciliation drift feedback for field operators. See [[mobile-pwa]].

## Related

- [[arch-systems]] — parent system
- [[rls-policy]] — security policies protecting production data
- [[design-system]] — UI conventions used in production forms
- [[database-schema]] — production table schemas
- [[production-department]] — living system documentation, SOPs, and reconciliation rules
- [[mobile-pwa]] — mobile responsiveness roadmap
- [[analytics-reporting]] — executive KPI dashboard includes production tonnage trends
