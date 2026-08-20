# Control Room Department — Specification & Operational Manual

> **Living System Documentation**  
> **Repository**: Plantcor Industrial Operations Portal (`Arch-System`)  
> **Domain**: Real-Time Operations, Monitoring & Emergency Response

---

## 1. Executive Summary

The **Control Room Department** serves as the central nervous system for monitoring, operational coordination, and emergency response across Plantcor mining operations. Operating 24/7/365, it maintains continuous situational awareness, enforces compliance with Standard Operating Procedures (SOPs), and facilitates low-latency communication among field units, site managers, and external regulatory/emergency agencies.

---

## 2. Department Overview

| Attribute | Specification |
| :--- | :--- |
| **Primary Function** | Real-time monitoring, telemetry surveillance, incident management, and dispatch coordination |
| **Operating Schedule** | 24/7/365 (Continuous Shift Rotation) |
| **Operational Environments** | Industrial Control Room, Security Operations Center (SOC), Network Operations Center (NOC), Emergency Operations Center (EOC) |
| **Core Systems Integrated** | SCADA, Industrial Telemetry, CCTV / VMS, Fire/Alarm Suppression Panels, Radio/VoIP Telephony, Incident Response Platforms, Building Management Systems (BMS) |

---

## 3. Key Functions

- **Continuous Monitoring & Surveillance**: Real-time telemetry ingestion and surveillance across site cameras, equipment sensors, vibration monitors, and perimeter intrusion systems.
- **Incident Lifecycle Management**: Rapid detection, logging, classification, escalation, and post-mortem resolution of operational disruptions.
- **Dispatch & Field Coordination**: Direct tactical dispatch of maintenance crews, emergency response teams, and field technicians.
- **Audit Logging & Shift Reporting**: Immutable shift handovers, hourly load logs, breakdown journals, and compliance documentation.
- **Regulatory & Safety Compliance**: Continuous verification of OSHA, ISO, and mining safety mandates.
- **Infrastructure Health Checks**: Continuous diagnostic monitoring of sensor feeds, edge gateways, UPS systems, and failover power units.

---

## 4. Roles & Responsibilities Matrix

| Role | Key Operational Responsibilities |
| :--- | :--- |
| **Control Room Manager** | Strategic oversight of department operations, staffing rosters, regulatory liaison, and policy enforcement. |
| **Shift Supervisor** | Active shift command, incident escalation decisions, shift handover sign-off, and tactical resource allocation. |
| **Control Room Operator** | Primary console monitoring, alarm triage, shift journal entry, sensor tracking, and direct field radio dispatch. |
| **Dispatcher / Coordinator** | Tactical radio communications, field crew routing, and external emergency service coordination. |
| **Systems Administrator** | Control room hardware, SCADA edge connectivity, local telemetry network, and display console maintenance. |
| **Compliance Officer** | Periodic audits of audit trails, alarm acknowledge latencies, safety protocols, and incident records. |

---

## 5. Integrated Technologies & Equipment

```
+-------------------------------------------------------------------------+
|                         Plantcor Control Room                            |
|                                                                         |
|  +--------------------+  +--------------------+  +--------------------+ |
|  |     Video VMS      |  |    SCADA / IoT     |  |   Access & Alarm   | |
|  |    (Site Feeds)    |  |  (Telemetry Data)  |  |  (Intrusion & Fire)| |
|  +---------+----------+  +---------+----------+  +---------+----------+ |
|            |                       |                       |            |
|            +-----------------------+-----------------------+            |
|                                    v                                    |
|             +---------------------------------------------+             |
|             |        Central Operations Portal UI         |             |
|             |          (Next.js 16 / WebSockets)          |             |
|             +----------------------+----------------------+             |
|                                    |                                    |
|       +----------------------------+----------------------------+       |
|       v                                                         v       |
| +-------------------------------+             +-------------------------------+ |
| | Industrial Radio & Dispatch   |             | Backup Power / UPS Status     | |
| +-------------------------------+             +-------------------------------+ |
+-------------------------------------------------------------------------+
```

1. **Video Management System (VMS) / CCTV**: High-resolution IP camera streams covering pit operations, plant conveyors, and perimeter boundaries.
2. **Supervisory Control and Data Acquisition (SCADA)**: Sub-second PLC/RTU telemetry ingestion for drills, excavators, and haul trucks.
3. **Access Control & Intrusion Detection**: Automated gate readers, badge verifications, and exclusion-zone breach sensors.
4. **Fire Alarm & Suppression Panels**: Integrated early-warning flame, thermal, and particulate sensors.
5. **Radio & Telephony**: Multi-channel TETRA/DMR radio nets, redundant landlines, and satellite emergency uplinks.
6. **Incident Management Software**: Integrated Portal incident tracking with immutable audit trails.
7. **Building Management System (BMS)**: HVAC, atmospheric scrubbers, and control console thermal management.
8. **Power Infrastructure**: Redundant online UPS battery banks paired with automated diesel generator transfer switches.

---

## 6. Standard Operating Procedures (SOPs)

### Shift Handover Workflow
1. Incoming supervisor reviews the active incident queue, breakdown logs, and machine availability states.
2. Outgoing operator reviews equipment anomalies, weather advisories, and ongoing radio channel assignments.
3. Both shift leads sign off electronically in the Portal Shift Completeness module.

### Alarm & Incident Triage Pipeline
```
[ Alarm Triggered ] 
       │
       ▼ (< 30s)
[ Operator Acknowledges & Classifies Severity ]
       │
       ├─ Level 1 (Minor) ───> Log & Notify Field Unit
       ├─ Level 2 (Moderate) ─> Dispatch Maintenance + Notify Supervisor
       └─ Level 3 (Critical) ─> Immediate Emergency Broadcast + Executive Escalation (< 60s)
```

---

## 7. Performance Targets (KPIs)

| Metric | SLA / Target | Evaluation Frequency |
| :--- | :--- | :--- |
| **Alarm Response Latency** | $< 60\text{ seconds}$ | Real-time telemetry |
| **Incident Acknowledgment Time** | $< 30\text{ seconds}$ | Real-time telemetry |
| **Shift Report Accuracy & Completeness** | $100\%$ | Per shift handover |
| **Core Monitoring System Uptime** | $\ge 99.9\%$ | Monthly aggregate |
| **Operator Annual Training & Drills** | $\ge 40\text{ hours / operator}$ | Annual audit |
| **Unacknowledged / Missed Critical Incident Rate** | $0.0\%$ | Continuous audit |

---

## 8. Operational Checklists

### Daily Verification Checklist
- [ ] Verify all core monitoring feeds (CCTV, SCADA telemetry, fire panels) are online.
- [ ] Complete formal shift handover and sign off previous shift completeness ledger.
- [ ] Perform radio check across primary, secondary, and emergency dispatch frequencies.
- [ ] Inspect UPS battery charge state, line frequency, and backup generator readiness.
- [ ] Review open machine breakdown tickets and pending maintenance locks.
- [ ] Verify physical access security and visitor badges at control room entry points.

### Weekly Operational Checklist
- [ ] Conduct end-to-end failover test of backup radio and satellite communication channels.
- [ ] Analyze 7-day incident logs for recurring machine alarms or telemetry anomalies.
- [ ] Review and update emergency contact directories and tactical escalation rosters.
- [ ] Sanitize, clean, and inspect workstation console hardware, keyboards, and displays.
- [ ] Verify storage pool capacity, retention limits, and backup status for CCTV recordings.

### Monthly Audit & Diagnostic Checklist
- [ ] Execute comprehensive diagnostic self-tests on all SCADA gateways, servers, and panels.
- [ ] Conduct unannounced emergency response and evacuation drill with site teams.
- [ ] Audit role-based access permissions (RBAC) and badge credentials for control room entry.
- [ ] Calibrate critical atmospheric, gas, and thermal field sensors.
- [ ] Deliver monthly operator refresher modules on new equipment protocols and SOP updates.

### Incident Response Checklist
- [ ] Acknowledge alarm and timestamp initial detection event.
- [ ] Aggregate contextual telemetry (camera angles, sensor metrics, operator location).
- [ ] Classify severity level and generate unique Portal Incident ID.
- [ ] Issue tactical dispatch or activate emergency agency notification protocols.
- [ ] Maintain real-time log of communications and dispatched assets.
- [ ] Perform post-incident operational debrief and finalize root cause report.

### Regulatory Compliance Checklist
- [ ] Verify operator certifications and licenses are current and compliant.
- [ ] Enforce statutory retention periods on audio dispatches and video surveillance recordings.
- [ ] Review cybersecurity access logs for unauthorized attempts or anomalous network traffic.
- [ ] Schedule mandatory external safety and compliance inspections.
