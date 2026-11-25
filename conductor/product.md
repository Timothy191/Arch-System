<!-- cspell:ignore Plantcor GenOffice CHPP pinnable -->

# Product Definition — Arch-System (Plantcor / Arch OS)

## Overview

**Arch-System** (**Plantcor / Arch OS**) is a production industrial mining-operations portal built on **Next.js 16 App Router + React 19**. It unifies multi-departmental field operations, live SCADA telemetry, shift compilation and closeout workflows, engineering breakdown tracking, plant beneficiation, stock control, site access security, and executive analytics under a single, audit-logged RBAC platform.

## Target Users

- **Control Room Operators**: Capture hourly hauler loads, excavator assignments, equipment operators, Stop SMR readings, shift delays, and closeout packets across Day (`06:00–17:00`) and Night (`18:00–05:00`) shifts.
- **Field & Machine Operators**: Log shift operations, drilling production metrics, dozer roll-overs, and pre-start inspections.
- **Shift Supervisors & Managers**: Review cross-department shift completeness, approve closeouts, monitor 12-hour shift delay budgets, and track OEE targets.
- **Engineering & Maintenance Teams**: Manage equipment breakdowns, workshop logs, tire management, and fleet readiness shared in real time with Control Room.
- **Access Control Officers**: Monitor gate movements (`IN` / `OUT`), alcohol breathalyzer diagnostics, personnel badging, QR/RFID credentials, and muster attendance registers.
- **Plant & Inventory Controllers**: Track CHPP wash plant hourly throughput, yields, delays, and equipment-level consumable stock.
- **Office, Database & Executive Leadership**: Operate GenOffice AI workflows, cross-department PostgreSQL 17 schemas and readiness reports, executive reconciliation dashboards, and investor briefing decks.
- **System Administrators**: Configure sites, fleet machinery, shift/daily/monthly operational targets, users, roles, department clearances, integrations, and audit logs.

## Core Departmental Modules

- **Central Hub (`/hub`)**: Operations launchpad featuring the interactive `Department Hero Highlights` 3D carousel (`HeroRotator`) and filterable/pinnable module grid (`CoreOperationalModules`).
- **Control Room (`/control-room`)**: Core live telemetry and operational capture hub (`ScadaPanel`, Hourly Loads Sheet, Machine Operations, Excavator Activity, Operational Delays, Shift Compilation, Shift Closeout, Reports).
- **Production (`/production`)**: Coal and waste extraction tracking, daily targets, and yield analytics.
- **Drilling (`/drilling`)**: Drill rig operations, meters/holes drilled, block tracking, and bit depth penetration rates.
- **Plant Processing (`/plant-processing`)**: Wash plant dense media separation, crusher throughput, hourly matrices, and recovery tracking.
- **Plant Inventory (`/plant-inventory`)**: CHPP equipment-level spares, consumables, and reagent inventory ledgers.
- **Engineering (`/engineering`)**: Breakdown tracking (automatically enforcing shared 12-hour shift budget constraints with Control Room) and tire management.
- **Availability & Utilization (`/availability-utilization`)**: Fleet mechanical availability, equipment utilization, 30-day activity ledgers, and monthly SMR summaries.
- **Access Control (`/access-control`)**: Real-time gate entry/exit logs, multi-month attendance registers, badge lifecycle management, and QR/RFID codes.
- **Office (`/office`)**: GenOffice AI workspace, artifact studio, metallurgical cost modeling, and multi-format exports.
- **Executive Dashboard (`/hub/executive`) & Presentation (`/presentation`)**: Cross-department production reconciliation, executive KPIs, and interactive briefing decks.
- **System Overview (`/overview`), Database (`/database`), & Administration (`/admin`)**: System topology, codebase/compliance readiness maps, PostgreSQL 17 ER schemas, and platform governance.

## Non-Negotiable Product Invariants

1. **Production Data Integrity**: All views must read and mutate live cloud **Supabase (PostgreSQL 17)** and **Redis** data via authenticated Server Components, Server Actions, and Realtime CDC subscriptions — zero mock or simulated operational data.
2. **Cross-Department Synchronization**: Operational captures flow across modules automatically (e.g., Hourly Loads `Operator` and `Stop SMR` persist to `machine_operations` and auto-populate `Log Machine Operation`; Engineering active breakdowns constrain and carry over Control Room opening `Start SMR`).
3. **Shift Accountability & Auditability**: Shift Hours Worked are strictly derived as `Shift Stop SMR - Start SMR`, delay entries enforce the combined 12-hour cross-department shift budget, and sensitive actions record actor attribution and audit logs.
4. **Offline & Intermittency Resilience**: Client mutations support TanStack Query persistence, IndexedDB offline queues, and local form draft recovery for field reliability.
