# Engineering Department — Specification & Operational Manual

> **Living System Documentation**  
> **Repository**: Plantcor Industrial Operations Portal (`Arch-System`)  
> **Domain**: Equipment Reliability, Maintenance Workflows, Breakdowns & Tire Fleet Lifecycle

---

## 1. Executive Summary

The **Engineering Department** is responsible for plant asset lifecycle reliability, mobile/fixed equipment maintenance, failure diagnosis, breakdown lifecycle management, and fleet wear surveillance (notably heavy vehicle tire telemetry and tread analysis). It provides real-time visibility into machine downtime, Mean Time to Repair (MTTR), repair diagnostics, and planned preventative maintenance to minimize disruption to mining production targets.

---

## 2. Department Overview

| Attribute | Specification |
| :--- | :--- |
| **Primary Function** | Heavy equipment maintenance, breakdown book-in/out, tire fleet tracking, MTTR optimization |
| **Operating Schedule** | 24/7/365 (Shift Mechanics, Maintenance Planners & Workshop Technicians) |
| **Operational Environments** | Heavy Mobile Equipment (HME) Workshop, Field Repair Bays, Central Warehouse & Engineering Office |
| **Core Systems Integrated** | CMMS / Maintenance Logs, Telemetry Diagnostics, SCADA Machine Alerts, Tire Pressure/Tread Scanners, CAD Equipment Schematics |

---

## 3. Key Functions & Workflows

- **Breakdown Management**: Digital book-in and book-out workflow for field equipment failures with timestamps, failure categories, mechanic assignment, and repair notes.
- **Tire Asset Management**: Full lifecycle tracking of giant earthmover tires (size, brand, wheel position, operating hours, tread depth wear curves, scrap reason).
- **Preventative Maintenance Scheduling**: Automated service intervals triggered by operating hours or machine diagnostic codes.
- **Machine Fleet Inventory**: Central registry of machine specs, serial numbers, active statuses, and service histories.
- **Engineering Notes & Logbook**: Technical observation journal with rich failure descriptions and diagnostic attachments.
- **Reliability Metrics (KPIs)**: Tracking MTTR, Mean Time Between Failures (MTBF), fleet availability percentage, and maintenance backlog.

---

## 4. Roles & Responsibilities Matrix

| Role | Key Operational Responsibilities |
| :--- | :--- |
| **Chief Engineer / Engineering Lead** | Strategic maintenance planning, asset capital expenditure, vendor management, and statutory machinery compliance. |
| **Maintenance Planner** | Shift scheduling, parts availability forecasting, planned maintenance work orders, and backlog prioritization. |
| **Workshop Supervisor** | Active bay supervision, breakdown triage, mechanical/electrical team dispatch, and repair sign-off. |
| **Field Mechanic / Technician** | Equipment book-in, diagnosis, repair execution, replacement part logging, and book-out submission. |
| **Tire Specialist / Technician** | Weekly tire pressure audits, ultrasonic tread depth measurements, rotation scheduling, and scrap root-cause analysis. |
| **Reliability Engineer** | Failure modes and effects analysis (FMEA), MTTR/MTBF trend analysis, and root cause failure analysis (RCFA). |

---

## 5. Integrated Architecture & Data Flow

```
+-------------------------------------------------------------------------+
|                       Plantcor Engineering Department                   |
|                                                                         |
|  +--------------------+  +--------------------+  +--------------------+ |
|  |   HME Telemetry    |  | Breakdown Book-In  |  |  Tire Inspection   | |
|  |  (Diagnostic Codes)|  |   (Field Portal)   |  |   (Tread/Pressure) | |
|  +---------+----------+  +---------+----------+  +---------+----------+ |
|            |                       |                       |            |
|            +-----------------------+-----------------------+            |
|                                    v                                    |
|             +---------------------------------------------+             |
|             |        Engineering Hub & UI Layer           |             |
|             |       (Breakdown Tables / Tire Grid)        |             |
|             +----------------------+----------------------+             |
|                                    |                                    |
|       +----------------------------+----------------------------+       |
|       v                                                         v       |
| +-------------------------------+             +-------------------------------+ |
| | PostgreSQL / Supabase RLS     |             | Reliability Analytics Engine  | |
| | (breakdowns, tires, machines) |             | (MTTR, MTBF, Wear Forecasting)| |
| +-------------------------------+             +-------------------------------+ |
+-------------------------------------------------------------------------+
```

---

## 6. Standard Operating Procedures (SOPs)

### Equipment Breakdown Lifecycle
```
[ Machine Breakdown In Field ]
       │
       ▼
[ Book-In: Fleet ID, Failure Category, Date/Time In, Operator ]
       │
       ▼
[ Diagnosis & Bay Allocation (Status: Active) ]
       │
       ▼
[ Repair Execution & Work Log Updates (Repair Notes, Parts) ]
       │
       ▼
[ Quality Check & Inspection ]
       │
       ▼
[ Book-Out: Date/Time Out, Completed By, Status: Completed ]
```

### Tire Inspection & Replacement Protocol
1. **Inspection**: Record tire serial number, machine wheel position, tread depth (mm), and pressure (psi).
2. **Evaluation**: Compare tread wear against statutory safety minimums (e.g. $< 15\text{ mm}$ triggers replacement advisory).
3. **Action**: If condition is `warning`, schedule rotation or remolding; if `critical`, issue immediate lock-out work order.
4. **Scrap Audit**: If tire is decommissioned, record `removed_hours` and `scrapped_reason`.

---

## 7. Performance Targets (KPIs)

| Metric | Target SLA | Evaluation Frequency |
| :--- | :--- | :--- |
| **Mean Time to Repair (MTTR)** | $< 4.0\text{ hours}$ (standard faults) | Weekly aggregate |
| **Fleet Availability Rate** | $\ge 92.5\%$ | Daily shift review |
| **Tire Inspection Compliance** | $100\%$ fleet inspected bi-weekly | Bi-weekly audit |
| **Emergency Breakdown Rate** | $< 5\%$ of total operating hours | Monthly aggregate |
| **Repeat Failure Rate (< 48 hrs)** | $< 2.0\%$ | Continuous audit |
| **Breakdown Data Integrity (Book In/Out)** | $100\%$ complete records | Per breakdown closure |

---

## 8. Operational Checklists

### Daily Workshop Checklist
- [ ] Review all active overnight breakdowns in the Engineering Dashboard.
- [ ] Verify bay mechanics allocation and outstanding high-priority work orders.
- [ ] Check parts inventory status for machines currently in critical repair.
- [ ] Cross-reference SCADA machinery fault alerts with logged breakdown tickets.

### Weekly Reliability Checklist
- [ ] Calculate 7-day rolling MTTR and MTBF per fleet category (Drills, Excavators, Dozers, Dumpers).
- [ ] Inspect critical high-hour machines due for preventative 250h / 500h service intervals.
- [ ] Review tire wear status reports and prioritize wheel rotations.
- [ ] Audit breakdown book-out records for complete mechanic signatures and repair notes.

---

## 9. Current Technical Completeness & Focus Areas

| Feature / Subsystem | Completeness | Technical Implementation State |
| :--- | :--- | :--- |
| **Engineering Hub Dashboard** | 100% | Live breakdown counters, resolved today metrics, recent breakdown feed |
| **Breakdowns Workflow & Drafting** | 100% | Book-in form, book-out modal, interactive data query table, localStorage draft caching, quick-select chips |
| **Tire Management & Regulatory Export** | 100% | Database schema (`0146_tire_management.sql`), RLS, interactive inspection modal, replacement workflow, tread degradation curve chart, CSV/JSON audit exports |
| **Equipment Inventory (Machines)** | 100% | Supabase `machines` integration, specifications lookup, status tracking |
| **Engineering Notes** | 100% | Rich text issue logging, severity tags, filterable shift note history |
| **Reliability Analytics / MTTR & MTBF** | 100% | MTTR vs predictive MTBF comparison chart and automated preventative service triggers |
| **Living Documentation & System Wiki** | 100% | Full operational manual, SOPs, KPIs, checklist matrix (`system-wiki/engineering-department.md`) |
| **Overall Engineering Department** | **100%** | Production-grade completeness across all operational, analytical, and field modules |
