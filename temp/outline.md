# Phase Outline: Enterprise Access Control & Security Operations Center (SOC) Redesign

## 1. Executive Vision & Competitor Benchmarking
Transform the Arch-System Access Control department into a world-class, industrial-grade Security Operations Center (SOC) adhering to global mining standards (Gallagher Command Centre, Honeywell Pro-Watch, Nedap AEOS, LenelS2 OnGuard):
- **Real-Time On-Site Headcount & Zone Occupancy**: Live tracking of all souls on site (Personnel, Contractors, Visitors, Heavy Vehicle Operators) across mining zones (Pit Alpha, Processing Plant, ROM Pad, Workshop Yard, Administration).
- **Emergency Evacuation & Muster Roll Call System**: Dedicated live muster management station for rapid headcount reconciliation during blast clearances and emergency evacuations.
- **Physical Barrier & Gate Telemetry HUD**: Live status of physical entry barriers (Main Gate Boom, Pit Turnstiles, Coal Truck Weighbridge RFID, Explosives Magazine Interlock) with status indicators and authorized manual override capability.
- **Automated Induction & Medical Compliance Shield**: Real-time enforcement preventing access when safety inductions or Red-Ticket medical clearance have expired.
- **Command & Quick Actions Dispatch**: Instant actions for rapid badge issuance, visitor pre-enrollment, gate pulse/release with audit logs, and one-click regulatory DMRE / Mine Health and Safety compliance export.
- **Dedicated Reports & Regulatory Audit Studio**: Resolve the missing `/access-control/reports` 404 route with comprehensive compliance reporting, gate traffic analytics, and anti-passback violation audit trails.
- **Resilient Role Resolution**: Eliminate the hard 403 "Try Again" crash by allowing broad read permissions for supervisors and site staff while protecting write mutations.

## 2. Target Deliverables
1. **Access Control Layout & Tab Synchronization**:
   - Add Emergency Muster & Roll Call tab.
   - Implement the missing Reports (`/access-control/reports`) suite.
   - Synchronize `ACCESS_CONTROL_TABS` in `@repo/departments/data-access`.
2. **Security Operations Center Dashboard (`/access-control`)**:
   - **Emergency Muster & Evacuation Banner / Live Headcount Bar**: Real-time count of on-site personnel with quick muster trigger.
   - **Perimeter Gate & Lane Status HUD**: Inbound/Outbound boom gates, turnstiles, and weighbridge lane telemetry.
   - **Quick Action Command Center**: Fast Badge Issuance, Register Visitor, Remote Gate Pulse, Muster Station, Export Audit Report.
   - **Bento KPI Matrix**: Active Credentials, Active On-Site Visitors, Gate Denials / Interlocks, Expiring Inductions, Truck RFID Passes.
   - **Live Telemetry & Activity Stream**: Real-time access event log with color-coded violation tags (Anti-Passback, BAC Fail, Expired Induction, Tailgating).
   - **Zone Occupancy & Entity Distribution**: Interactive breakdown of personnel by work area.
3. **Emergency Muster & Roll Call Page (`/access-control/muster`)**:
   - Real-time roll call table of all individuals currently checked in / on-site.
   - Muster point check-off (Mark Safe / Unaccounted) with search and department filtering.
   - Emergency export for rescue crews / mine safety marshals.
4. **Regulatory Reports & Audit Studio (`/access-control/reports`)**:
   - Access volume and peak throughput analytics.
   - Security exceptions & denial reasons breakdown (BAC, Expired Induction, Blacklist).
   - Contractor & visitor time-on-site audit reports for billing and compliance.
5. **Backend Actions & Role Resilience (`actions.ts`)**:
   - Decouple read queries from strict write-only role checks to allow site supervisors and operators to monitor site access without crashes.
   - Add server actions for gate pulses, muster station updates, and audit report generation.
   - Ensure zero-downtime fallback if database RPC or cache misses occur.
