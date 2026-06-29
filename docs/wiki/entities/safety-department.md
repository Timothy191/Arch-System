---
title: Safety Department
created: 2026-05-14
updated: 2026-05-17
type: entity
tags: [department]
sources: [raw/articles/arch-systems-project-overview.md]
confidence: high
---

# Safety Department

The Safety department in Arch-Systems handles incident logging, compliance tracking, and safety inspections for mining operations.

## Tabs

- dashboard — Safety-specific KPI dashboard
- daily-log — Safety incident reporting form
- machines — Safety equipment tracking
- history — Past incident history
- reports — Safety reports and analysis
- tools — Safety tools and checklists

## Safety Incident Logging

Incidents are recorded via the `safety_incidents` table with the following fields:

- `incident_type`: near-miss, incident, lost-time, equipment-damage
- `severity_id`: references `safety_severities` (low, medium, high, critical)
- `category_id`: references `safety_incident_categories`
- `injured_parties`: number of people injured
- `location`: where the incident occurred
- `root_cause` and `corrective_action`: investigation fields
- `status`: open, under-investigation, resolved, closed

## Dashboard KPIs

- **LTI-Free Days**: consecutive days without a lost-time incident
- **Incident-Free Days (30d)**: days in the last 30 without any incident
- **Open Incidents**: currently open or under investigation
- **Lost Time (30d)**: number of lost-time incidents in last 30 days

## Categories

- Slip, Trip, or Fall
- Equipment Contact
- Vehicle Incident
- Hazardous Material
- Environmental
- Near Miss
- Other

## Current Completeness Status

| Feature               | Status  |
| --------------------- | ------- |
| Dashboard             | 95%     |
| Forms (incident log)  | 90%     |
| Tables (history)      | 95%     |
| Charts                | 85%     |
| Real-time updates     | 80%     |
| AI Assistant          | 85%     |
| Mobile responsiveness | 70%     |
| **Overall**           | **86%** |

**Mobile:** Safety incident reporting is a critical mobile use case — inspectors file reports on-site from tablets/phones. Touch-optimized photo attachment and location fields are high value. See [[mobile-pwa]].

## Related

- [[arch-systems]] — parent system
- [[rls-policy]] — security policies protecting safety data
- [[design-system]] — UI conventions used in safety forms
- [[database-schema]] — safety_incidents, safety_severities table schemas
- [[mobile-pwa]] — mobile responsiveness roadmap (field incident reporting)
- [[analytics-reporting]] — safety incident trend analysis and compliance reports
