# Architectural & UI Design: Access Control & Security Operations Center (SOC)

## 1. System Architecture & Component Hierarchy

```
+------------------------------------------------------------------------------------------+
|                            Access Control Layout & Tab Bar                                |
|  [Dashboard]  [Perimeter & Gates]  [Print Cards]  [QR & RFID]  [Logs]  [Visitors]  [Muster] [Reports] |
+------------------------------------------------------------------------------------------+
                                             |
                                             v
+------------------------------------------------------------------------------------------+
|                     Security Operations Center (SOC) Main Page                           |
|                                                                                          |
| +--------------------------------------------------------------------------------------+ |
| | TOP: Industrial Emergency & Headcount Command Strip                                  | |
| | • Live On-Site Souls: 142 (88 Employees, 42 Contractors, 12 Visitors, 34 Trucks)     | |
| | • Blast / Evacuation Muster Status: All Clear / Standby                              | |
| | • Quick Actions: [Issue Badge] [Enroll Visitor] [Gate Pulse] [Muster Roll] [Report]  | |
| +--------------------------------------------------------------------------------------+ |
|                                                                                          |
| +--------------------------------------------------------------------------------------+ |
| | PERIMETER BARRIER TELEMETRY HUD                                                      | |
| | • Gate 01: Main North Inbound Boom Gate (ONLINE • 482 cycles today • Auto-Pulse)     | |
| | • Turnstile 01-04: Pit Alpha Pedestrian Lanes (ONLINE • BAC Interlock Active 0.00‰)  | |
| | • Lane 03: Coal Haul Weighbridge RFID Reader (ONLINE • 84 Trucks Cleared)            | |
| | • Portal 05: Explosives Magazine Biometric Lock (LOCKED • Dual-Key Authorization)    | |
| +--------------------------------------------------------------------------------------+ |
|                                                                                          |
| +--------------------------------------------------------------------------------------+ |
| | BENTO KPI METRICS MATRIX                                                              | |
| | • Active Badges (Total Valid Credentials)                                            | |
| | • Active Visitors On-Site (Active checked-in badges)                                  | |
| | • Access Denials & Security Interlocks (BAC, Expired Induction, Tailgating)          | |
| | • Expiring Certifications (Inductions & Red-Ticket Medicals <= 7 Days)               | |
| +--------------------------------------------------------------------------------------+ |
|                                                                                          |
| +--------------------------------------------------------------------------------------+ |
| | ANALYTICS & OCCUPANCY DISTRIBUTION ROW                                               | |
| | • Hourly Inbound/Outbound Throughput (Dynamic Area/Bar Chart)                        | |
| | • Zone Occupancy Breakdown (Pit Alpha, Processing Plant, ROM, Workshop, Admin)        | |
| | • Credential Type Distribution (Personnel, Fleet, Visitors, Contractors)             | |
| +--------------------------------------------------------------------------------------+ |
|                                                                                          |
| +--------------------------------------------------------------------------------------+ |
| | BOTTOM ROW: Real-time Access Event Stream + Induction Compliance Shield              | |
| | • High-density access logs with live status pills (Granted, Denied, Expired, Alert)  | |
| | • Contractor & Personnel induction status table with renewal warnings                 | |
| +--------------------------------------------------------------------------------------+ |
+------------------------------------------------------------------------------------------+
```

## 2. Global Competitor Benchmark Parity Checklist

| Feature | Honeywell Pro-Watch / Gallagher | Legacy Arch-System | Redesigned Arch-System |
| :--- | :--- | :--- | :--- |
| **Real-time Headcount HUD** | Yes (Zone-specific) | Basic static number | Dynamic live count across Employees, Contractors, Visitors & Trucks |
| **Emergency Blast & Evacuation Muster** | Dedicated Muster Station | Missing | Full interactive Muster Roll Call with station check-off & export |
| **Perimeter Barrier Telemetry** | Lane & Barrier HUD | Missing | Real-time barrier status HUD with pulse triggers & cycle counters |
| **Breathalyzer (BAC) & Induction Interlock** | Automated lockout | Partial DB fields | Visual compliance indicators & denial reason taxonomy |
| **Quick Action Command Center** | One-click dispatch | Dispersed in tabs | Persistent SOC action bar for fast operational response |
| **Audit & Regulatory Reports** | DMRE / OSHA export | Missing (404 error) | Dedicated Reports Studio with date filtering & PDF/CSV export |
| **Role Authorization Resilience** | Tiered (View vs Arm) | Hard 403 crash | Tiered: All authenticated staff can monitor; mutations restricted |

## 3. Data Schema & Contracts

### New / Enhanced Actions in `apps/portal/app/(departments)/access-control/actions.ts`:
1. `getLivePerimeterGates()`: Returns status, health, and throughput of all physical access points.
2. `getMusterRollCall(deptId)`: Compiles all currently checked-in personnel and visitors for emergency muster.
3. `markPersonnelMusterStatus(entityId, status, station)`: Check off an individual as "Accounted" at a muster point.
4. `triggerGatePulse(gateId, reason)`: Simulates / triggers barrier pulse with security audit logging.
5. `getAccessReportsData(deptId, startDate, endDate)`: Aggregates security audit data for regulatory reports.
6. Role check update: Split read access (`assertAccessControlViewRole`) and write mutations (`assertAccessControlWriteRole`) to prevent "Try Again" error crashes.

## 4. UI/UX & Design Tokens

- Canvas: `#f3f4f6`
- Card Surfaces: `<GlassCard variant="window">` with backdrop blur and border glass highlights.
- Metric Accents: OKLCH tokens (`--accent-blue`, `--accent-green`, `--accent-amber`, `--accent-red`).
- Data Figures: Monospace font for Badge IDs (`JetBrains Mono`), gate numbers, and timestamps.
- Zero `dark:` classes, zero raw hex values, strict adherence to enterprise design standards.
