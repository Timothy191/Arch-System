# Production Department — Specification & Operational Manual

> **Living System Documentation**  
> **Repository**: Plantcor Industrial Operations Portal (`Arch-System`)  
> **Domain**: Open-Cast Extraction, Coal Yield Tracking, Overburden Stripping & Yield Reconciliation

---

## 1. Executive Summary

The **Production Department** manages the core extractive operations across Plantcor mining concessions. It tracks daily coal extraction tonnage, overburden waste removal (BCM), equipment haulage cycles, strip ratios (`waste_tonnes / coal_tonnes`), and yield reconciliation between pit excavator surveys and processing weighbridge readings. It enforces strict reconciliation variance limits ($< 5\%$ optimal, $\ge 15\%$ audit trigger) to ensure production accuracy and eliminate tonnage leakage.

---

## 2. Department Overview

| Attribute | Specification |
| :--- | :--- |
| **Primary Function** | Run-of-Mine (ROM) coal extraction, waste stripping, haulage load reconciliation, yield optimization |
| **Operating Schedule** | 24/7/365 (Day Shift: 06:00–18:00, Night Shift: 18:00–06:00) |
| **Operational Environments** | Active Pit Benches, Highwalls, Haul Roads, Waste Dumps & Run-of-Mine (ROM) Stockpiles |
| **Core Systems Integrated** | Telemetry Weighbridges, Excavator Payload Systems, Fleet Management Systems (FMS), Material Density Catalogs, Supabase Production Partition Tables |

---

## 3. Key Functions & Extraction Workflows

- **Coal & Waste Extraction Logging**: Recording shift-level coal tonnage and overburden waste volumes via `production_logs` and `daily_logs` partition tables.
- **Strip Ratio Surveillance**: Continuous tracking of the volumetric waste-to-coal ratio against geotechnical mine plan benchmarks.
- **Production Reconciliation & Drift Classification**: Comparing pit extraction volumes against weighbridge yield using `view_production_summary` and `classifyReconciliationDrift`.
- **Equipment Utilization & Fuel Metrics**: Linking excavator and haul truck operating hours (`machine_hours`) and diesel consumption (`fuel_logs`) to extracted BCM.
- **Material Density Calibration**: Dynamic conversion of surveyed volume (BCM) to tonnage using verified specific gravity factors ($1.45\text{ t/BCM}$ for Coal, $2.25\text{ t/BCM}$ for Waste Overburden).

---

## 4. Roles & Responsibilities Matrix

| Role | Key Operational Responsibilities |
| :--- | :--- |
| **Production Manager** | Strategic extraction scheduling, monthly tonnage quota compliance, bench progression oversight, and executive reporting. |
| **Shift Pit Supervisor** | Real-time bench coordination, excavator-dumper fleet allocation, hourly load pacing, and shift handover sign-off. |
| **Weighbridge / Tonnage Officer** | Accurate weighing of outgoing road haulers, tare weight calibration, and weighbridge ticket reconciliation. |
| **Surveyor / Volume Auditor** | Drone and LiDAR bench topography surveys, monthly volumetric BCM calculations, and highwall void verification. |
| **Continuous Improvement Lead** | Cycle time optimization, bucket fill factor analysis, and operator loading efficiency coaching. |

---

## 5. Integrated Architecture & Telemetry Data Flow

```
+-------------------------------------------------------------------------+
|                        Plantcor Production Pipeline                     |
|                                                                         |
|  +--------------------+  +--------------------+  +--------------------+ |
|  | Excavator Payload  |  | Weighbridge Scanners| | Bench Drone Survey | |
|  |  (Bucket Pass BCM) |  |   (Gross Tonnes)   |  | (Volumetric Void)  | |
|  +---------+----------+  +---------+----------+  +---------+----------+ |
|            |                       |                       |            |
|            +-----------------------+-----------------------+            |
|                                    v                                    |
|             +---------------------------------------------+             |
|             |       Production Reconciliation Layer       |             |
|             |   (view_production_summary / Drift Check)   |             |
|             +----------------------+----------------------+             |
|                                    |                                    |
|       +----------------------------+----------------------------+       |
|       v                                                         v       |
| +-------------------------------+             +-------------------------------+ |
| | PostgreSQL Partition Tables   |             | Production Analytics Engine   | |
| | (production_logs, daily_logs) |             | (Strip Ratio, Yield, MT/hr)   | |
| +-------------------------------+             +-------------------------------+ |
+-------------------------------------------------------------------------+
```

---

## 6. Standard Operating Procedures (SOPs)

### Shift Tonnage Logging & Reconciliation
```
[ Shift Extraction at Active Pit Bench ]
       │
       ▼
[ Hourly Load Counts Recorded in Control Room / Field Portal ]
       │
       ▼
[ Weighbridge Ingestion & Tonnage Accumulation ]
       │
       ▼
[ End-of-Shift Yield Reconciliation Execution ]
       │
       ├─ Variance < 5% (Optimal) ──────> Electronic Supervisor Sign-Off
       ├─ Variance 5%–10% (Warning) ───> Bucket Fill Factor Recalibration
       └─ Variance >= 15% (Critical) ──> Automatic Audit Lockout & Pit Survey Trigger
```

### Material Density Reference Standard
1. Specific gravity reference catalog is enforced via `material_density` table.
2. Coal Run-of-Mine: $1.45\text{ tonnes / BCM}$.
3. Waste Overburden (Sandstone/Shale): $2.25\text{ tonnes / BCM}$.
4. Unspecified / Mixed Material: $2.00\text{ tonnes / BCM}$.

---

## 7. Performance Targets (KPIs)

| Metric | Target SLA | Evaluation Frequency |
| :--- | :--- | :--- |
| **Shift Coal Yield** | $\ge 88.0\%$ extraction recovery | Per shift |
| **Reconciliation Variance Drift** | $\le \pm 5.0\%$ variance | Shift handover |
| **Target Strip Ratio** | $< 3.8:1\text{ (Waste BCM : Coal Tonnes)}$ | Daily aggregate |
| **Hourly Tonnage Pacing** | $\ge 450\text{ tonnes / operating hour}$ | Hourly monitoring |
| **Daily Log Submission Integrity** | $100\%$ shifts signed off before handover | Per shift transition |
| **Weighbridge Calibration Compliance** | Weekly zero-tare calibration certified | Weekly audit |

---

## 8. Operational Checklists

### Pre-Shift Extraction Checklist
- [ ] Inspect active pit bench conditions, highwall stability, and ground drainage.
- [ ] Confirm excavator positioning and haul truck loading queue assignments.
- [ ] Verify weighbridge scale connectivity and zero-load tare reading.
- [ ] Review geotechnical exclusions and blast exclusion zones for the shift.

### Mid-Shift Tonnage Audit Checklist
- [ ] Audit hourly load counts against excavator telemetry pass counters.
- [ ] Compare cumulative shift tonnage against hourly pacing quota ($450\text{ t/hr}$).
- [ ] Inspect haul road conditions for spillage or speed restriction bottlenecks.
- [ ] Verify diesel fuel levels for frontline excavators and loaders.

### Shift Closeout & Yield Reconciliation Checklist
- [ ] Aggregate all gross and tare weighbridge tickets for the 12-hour shift.
- [ ] Execute automated yield reconciliation drift calculation in the portal.
- [ ] If variance $\ge 10\%$, document root cause (e.g. wet coal moisture penalty, bucket factor shift).
- [ ] Submit signed shift report to mine management and engineering planning.

---

## 9. Current Technical Implementation & Audit State

| Feature / Subsystem | Completeness | Technical Implementation State |
| :--- | :--- | :--- |
| **Materialized Summary View** | 100% | `view_production_summary` aggregating actual tonnage, expected BCM, fuel, and strip ratio (`073_production_summary_view.sql`) |
| **Hourly Production Trend Engine** | 100% | `get_hourly_production_trend` RPC function (`074_hourly_production_trend.sql`) |
| **Reconciliation Drift Classifier** | 100% | `classifyReconciliationDrift` and `RECONCILIATION_UI` in `apps/portal/lib/production-reconciliation.ts` |
| **Regulatory Export Engine** | 100% | `/api/export/production` endpoint with CSV sanitization and date range filtering |
| **Partition Table Infrastructure** | 100% | `production_logs` partitioned by month with department-scoped RLS policies (`072_partition_production_logs.sql`) |
| **Material Density Standard** | 100% | Reference table and RLS policies for material specific gravity calibration |
| **Living System Documentation** | 100% | Full operational manual, SOPs, KPIs, checklist matrix (`system-wiki/production-department.md`) |
| **Overall Production Department** | **94.0%** | Robust backend and analytical foundation; UI dashboard widgets wired |
