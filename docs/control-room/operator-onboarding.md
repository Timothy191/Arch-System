# Control Room Operator Onboarding Guide (`TASK-9.1`)

**Audience:** Control Room Operators, Shift Supervisors, Training Leads  
**Department:** Control Room (`/control-room`)

---

## 1. Control Room Overview

The Arch-System Control Room workspace is the central operational nerve center for mine production monitoring, fleet dispatch tracking, FUXA SCADA telemetry visualization, and shift lifecycle accounting.

Key capabilities:

- **Live Fleet & SCADA Telemetry:** Real-time machine health, haulage status, and embedded FUXA HMI diagrams with automatic Redis/local degraded-mode fallback.
- **Shift Production Accounting:** End-to-end tracking from opening Service Meter Readings (Start SMR) through Hourly Loads, Dozer Rolls, Shift Compilation, and End SMR.
- **Audited Shift Closeout:** Completeness validation and supervisor PIN sign-off enforcing separation of duties.

---

## 2. Required Roles & Access Prerequisites

Before starting a shift in the Control Room portal, verify the following account prerequisites:

1. **Operator Role (`control_room_operator`):**
   - Assigned in `public.employees` / RBAC claims for standard shift data entry, machine status toggling, hourly load logging, and alert acknowledgment.
2. **Supervisor Approval Role (`control_room_supervisor` / `admin`):**
   - Required to approve shift closeouts (`/api/control-room/shift-closeout/approve`) and alter already-committed report records.
   - Must have an active 6-digit **Supervisor PIN** configured in the system.
   - **Separation of Duties Invariant:** An operator cannot approve their own shift closeout (`approverId !== operatorId`).

---

## 3. Daily Shift Workflow

Follow this sequential workflow during every 12-hour (`day` or `night`) shift:

### Phase 1: Shift Start & Start SMR (`/control-room`)

1. Log into the portal and navigate to **Control Room** (`/control-room`).
2. Verify active shift metadata (Shift Date, Day/Night shift selector, Assigned Crew).
3. Scan or assign machine operators via the **Machine Operator Scan** workflow (`/api/control-room/machine-operator-scan`).
4. Confirm opening **Start SMR** (Service Meter Readings) for all assigned haul trucks (e.g., `DT-101`, `DT-102`), excavators, dozers, and drill rigs match the previous shift's closing SMR.

### Phase 2: Machine Operations (`/control-room/machine-operations`)

1. Monitor active fleet state (`Operating`, `Breakdown`, `Standby`) via the Fleet Summary Strip and Machine Operations List.
2. Log shift machine operations in **Log Machine Operation** (`MachineOperationsForm`):
   - **Drill Rigs:** When a Drill Rig is selected, enter **Meters**, **Site**, **Block**, and **Holes**; metrics auto-sync to the Drilling Department.
   - **Dozers:** When a Dozer is selected, check **Roll Over** (auto-calculates rehabilitation push at `250 BCM/h` and syncs to `dozer_rollover_logs`) or **Other** (road/ramp maintenance, stockpile push, floor/pad cleanup, berm construction, with `0 BCM` roll-over).
   - **End-of-Shift Breakdown Auto-Carry-Over:** If a machine ends the shift on breakdown, check **Machine ends shift on breakdown (auto-carry over into new shift)** and enter the fault reason. The system automatically creates an active breakdown record and pre-populates the next shift's operation (`Start SMR = Stop SMR`, `operational_status = 'BREAKDOWN'`).

### Phase 3: Hourly Loads & Excavator Activity (`/control-room/hourly-loads` & `/control-room/excavator-activity`)

1. At the top of each hour, record load counts per haul truck and material classification (`Waste` or `Coal`).
2. In **Excavator Activity** (`/control-room/excavator-activity`), assign dumpers to active excavators and toggle material (`Waste` / `Coal`) with instant optimistic updates.
3. The system multiplies load counts by each machine's calibrated `bin_factor` to compute total hauled BCM and tonnage.

### Phase 4: Engineering Overview, Delays & Shift Compilation (`/control-room/engineering-notes` & `/control-room/shift-compilation`)

1. Open **Operations / Engineering Overview** (`/control-room/engineering-notes`) to manage the full fleet's 12-hour shift SMR, 12 delay buckets, availability, and utilization:
   - **Standard Shift Allowances (`2.4h` total):** `Refueling = 0.2h`, `Safety Talks = 0.5h`, `Lunches = 0.5h`, `GES / Maintenance = 0.5h`, `Tyres / Trams = 0.2h`, `Greasing / Startups = 0.5h`.
   - **12.0-Hour Shift Cap:** Combined `Total SMR Worked + Total Delays` never exceeds `12.0h`.
   - **3-Step Guided Quick Delay Logger:** Select a machine in **Step 1**, choose the delay category and one-tap duration chip (`0h`–`6.0h`) in **Step 2**, and apply a one-tap note template + **Save Ledger** in **Step 3**. Use the **Simplified Table** button to hide the 6 standard allowance columns when focusing on abnormal delays.
   - **Automatic Breakdown Carry-Over & Book Out:** Checking **Ends shift on breakdown (carry over)** (or logging breakdown hours at shift end) automatically carries the machine into the new shift (`day` $\rightarrow$ `night` or `night` $\rightarrow$ next-day `day`) with `Start SMR = Stop SMR` and `12.0h` Breakdown delay until repaired and cleared via **Book Out**.
2. Open **Shift Compilation** (`/control-room/shift-compilation`) to review aggregated production KPIs, crusher throughput, and variance against shift targets.

### Phase 5: End SMR (`/control-room/end-smr`)

1. At the end of the shift, collect closing meter readings from all fleet units and drill rigs (including `DRILLING PRODUCTION` hole and meter totals).
2. Enter **End SMR** values:
   - Ensure `End SMR >= Start SMR`.
   - Total elapsed machine hours cannot exceed shift duration limits.

### Phase 6: Shift Closeout (`/control-room/shift-closeout`)

1. Open the **Shift Closeout** workflow (`CloseShiftModal` or `/control-room/shift-closeout`).
2. Verify that all completeness indicators are green (`100% Complete`).
3. Submit the shift for closeout and request the on-duty Shift Supervisor to review the ledger and enter their **Supervisor PIN** to finalize the shift.

---

## 4. Alert Response Workflow (`AlertPanel`)

The Control Room **AlertPanel** surfaces real-time operational, telemetry, and completeness alerts sorted by severity (`Critical`, `Warning`, `Info`).

1. **Triage:**
   - When an audible or visual banner triggers in `AlertPanel`, inspect the alert category (e.g., _SCADA Telemetry Offline_, _Missing Hourly Load_, _Machine Down Exceeding Threshold_).
2. **Verify & Act:**
   - Contact the field operator or maintenance dispatch via radio to confirm physical machine status.
   - If the alert is a FUXA SCADA connectivity warning (`Degraded` or `Offline`), consult `docs/control-room/fuxa-troubleshooting.md`.
3. **Acknowledge:**
   - Click **Acknowledge** on the alert card and attach a brief resolution note.
   - All critical alerts **must** be acknowledged and resolved before a shift can be closed out.
4. **Escalate:**
   - Unresolved `Critical` alerts persisting longer than 15 minutes must be escalated to the Shift Supervisor and Maintenance Planner.
