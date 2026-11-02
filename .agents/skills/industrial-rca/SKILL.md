---
name: industrial-rca
description: Industrial 8D Root-Cause Analysis, FMEA Anomaly Scoring (RPN), and SCADA shift handover investigation standards for Arch-System mining operations.
---

# Industrial Root-Cause Analysis (RCA) & FMEA Scoring

## 1. Domain Overview

In mining operations (CHPP, open-pit hauling, drilling, crushing), equipment failure is expensive and safety-critical. Unplanned downtime on an excavator, haul truck, or primary crusher halts production chains. This skill codifies industrial quality engineering standards (distilled from AIAG-VDA FMEA and 8D problem-solving) for agents analyzing machinery breakdowns and telemetry anomalies.

---

## 2. 8D Problem-Solving Framework for Mining Breakdowns

When analyzing an equipment failure, breakdown report, or shift rollover anomaly, structure findings across the 8 disciplines:

| Step   | Discipline                                  | Industrial Operational Actions                                                                                                         |
| :----- | :------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------- |
| **D1** | **Form the Team**                           | Identify responsible shift supervisor, engineering lead, and site technician.                                                          |
| **D2** | **Describe the Problem**                    | Specify machine ID (e.g. `EX-201`), component (hydraulic pump, traction motor), operating hours (SMR), shift date, and pit location.   |
| **D3** | **Containment Action**                      | Isolate equipment (lockout/tagout - LOTO), re-route hauling fleet to redundant units, log temporary standstill status.                 |
| **D4** | **Root-Cause Analysis (5 Whys / Fishbone)** | Deliberate root causes: mechanical fatigue, lubrication starvation, thermal runaway, electrical interlock trip, or operator deviation. |
| **D5** | **Permanent Corrective Action (PCA)**       | Define engineering intervention: component replacement, oil analysis regimen, telemetry sensor recalibration.                          |
| **D6** | **Implement & Validate PCA**                | Execute repair, conduct run-up testing under low load, inspect SCADA vibration/temperature thresholds.                                 |
| **D7** | **Prevent Recurrence**                      | Update preventive maintenance interval in `machines` schedule, adjust telemetry alert threshold in Redis/Supabase.                     |
| **D8** | **Congratulate Team & Closeout**            | Log shift closeout report with breakdown duration, cost impact, and signoff.                                                           |

---

## 3. Failure Mode & Effects Analysis (FMEA) & RPN Scoring

To prioritize SCADA sensor telemetry alarms and equipment maintenance urgency, calculate the **Risk Priority Number (RPN)**:

$$\text{RPN} = \text{Severity (S)} \times \text{Occurrence (O)} \times \text{Detection (D)}$$

Each factor is rated on a 1–10 scale:

### Severity (S)

- **10 (Catastrophic)**: Safety hazard, structural collapse, fire risk, or environmental violation.
- **7–9 (Critical)**: Primary crusher stoppage, entire pit haulage halted, major gearbox seizure.
- **4–6 (Moderate)**: Single haul truck down with available pit standby; partial throughput degradation.
- **1–3 (Minor)**: Cosmetic sensor drift, non-critical lighting or auxiliary pump fault.

### Occurrence (O)

- **9–10 (Frequent)**: Known recurring failure occurring multiple times per week.
- **5–8 (Occasional)**: Occurs monthly or under high ambient temperature / wet season conditions.
- **1–4 (Rare)**: Premature failure or isolated manufacturing defect with high MTBF.

### Detection (D)

- **9–10 (Undetected)**: No SCADA telemetry sensor; fault only observed upon total catastrophic seizure.
- **5–8 (Delayed Detection)**: Detected via post-shift physical inspection or daily manual SMR log.
- **1–4 (Immediate Detection)**: Continuous high-frequency SCADA telemetry (bearing temperature, hydraulic pressure, vibration stream) with real-time CDC alert.

### RPN Action Thresholds

- **$\text{RPN} \ge 200$**: **Class 1 Urgent Emergency** — halt machine immediately; trigger audible SCADA alarm; notify Engineering & Control Room.
- **$100 \le \text{RPN} < 200$**: **Class 2 Scheduled Maintenance** — plan component replacement during nearest shift handover.
- **$\text{RPN} < 100$**: **Class 3 Routine Monitoring** — log in telemetry trends and review during weekly planning.

---

## 4. Control Room & Shift Rollover Integration

1. **Shift Closeout Validation**:
   - Verify every active breakdown logged in `breakdowns` has a designated category (`mechanical`, `electrical`, `hydraulic`, `operational`), an assigned technician, and a calculated duration.
2. **Telemetry Cross-Reference**:
   - Check capped SCADA Redis streams (`scada:stream:telemetry`) for temperature or pressure spikes preceding the breakdown timestamp.
3. **Audit Trail Logging**:
   - Ensure shift handover notes contain RCA conclusions before shift closeout RPC is executed.
