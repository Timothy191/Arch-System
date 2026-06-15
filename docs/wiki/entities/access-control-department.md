---
title: Access Control Department
created: 2026-05-16
updated: 2026-05-17
type: entity
tags: [department]
sources: [raw/articles/arch-systems-project-overview.md]
confidence: high
---

# Access Control Department

The Access Control department in Arch-Systems handles site access, badging, and security for mining operations.

## Tabs

- dashboard — Access control KPI dashboard
- daily-log — Access control shift log
- machines — Security equipment tracking
- history — Historical access records
- reports — Access reports and audits
- tools — Badging and access management tools

## Key Features

- **Site Access Management**: Track personnel on-site (currently 142)
- **Badging System**: Digital badge issuance and tracking
- **Security Monitoring**: Site perimeter and access point monitoring
- **Visitor Management**: Temporary access passes and tracking

## Dashboard KPIs

- **On-Site Personnel**: Current headcount on site
- **Access Events**: Badge scans per shift
- **Pending Approvals**: Access requests awaiting review
- **Security Alerts**: Active security incidents

## Database Tables

| Table        | Purpose                                       | Key Columns                                                    |
| ------------ | --------------------------------------------- | -------------------------------------------------------------- |
| `daily_logs` | Shift-level access log                        | `department_id`, `log_date`, `shift`                           |
| `machines`   | Security equipment (cameras, gates, scanners) | `name`, `machine_type`, `serial_number`, `active`              |
| `employees`  | Personnel registry with site access           | `full_name`, `role`, `department_id`, `accessible_departments` |
| `audit_logs` | All access events (inserts, updates, deletes) | `action`, `table_name`, `record_id`, `performed_by`            |

Access control data is doubly protected: RLS policies scope by `department_id`, and the `audit_logs` table captures every mutation.

## Current Completeness Status

| Feature                    | Status  |
| -------------------------- | ------- |
| Dashboard                  | 80%     |
| Forms (daily-log)          | 75%     |
| Tables (machines, history) | 85%     |
| Charts                     | 65%     |
| Real-time updates          | 60%     |
| AI Assistant               | 75%     |
| Mobile responsiveness      | 60%     |
| **Overall**                | **71%** |

**Mobile:** Access gate scanning and badge management workflows need touch-optimized form redesign for field officers. See [[mobile-pwa]].

## Related

- [[arch-systems]] — parent system
- [[rls-policy]] — security policies protecting access data
- [[auth-middleware]] — portal-level auth enforcement (complements access control dept)
- [[design-system]] — UI conventions used in access control forms
- [[database-schema]] — employees and audit_logs table schemas
- [[mobile-pwa]] — mobile responsiveness roadmap
