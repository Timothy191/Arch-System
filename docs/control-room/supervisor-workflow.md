# Control Room Supervisor Workflow Guide (`TASK-13.3`)

**Audience:** Shift Supervisors, Superintendents, Control Room Leads  
**Department:** Control Room (`/control-room`)

---

## 1. Overview

Control Room Shift Supervisors oversee real-time fleet dispatch, validate production and delay accounting across the 12-hour shift window, manage critical alert escalations, and execute final separation-of-duties approval at shift handover.

---

## 2. Core Supervisor Responsibilities

1. **Start-of-Shift Verification (First 30 Minutes):**
   - Confirm crew attendance and operator-to-machine assignments (`/api/control-room/machine-operator-scan`).
   - Verify carry-over engineering breakdowns from the prior shift (`operational_status = 'BREAKDOWN'`) and confirm opening SMR continuity (`Start SMR = prior Stop SMR`).
2. **Mid-Shift Production & Delay Auditing (Every 2 Hours):**
   - Review `/control-room/hourly-loads` and `/control-room/excavator-activity` to ensure load counts and material classifications (`Waste` vs. `Coal`) match pit dispatch targets.
   - Audit `/control-room/engineering-notes` to verify that abnormal delays and engineering breakdowns are accurately categorized within the 12.0-hour shift ceiling.
3. **Alert Escalation Management:**
   - Monitor the Control Room `AlertPanel` for unacknowledged `Critical` or `Warning` alerts exceeding the 15-minute SLA.
4. **End-of-Shift Handover & Closeout Approval:**
   - Audit completeness (`100% Complete` across all non-exempt fleet units) and sign off using the 6-digit **Supervisor PIN**.

---

## 3. Shift Closeout Approval Workflow

1. **Operator Submission:**
   - The on-duty Control Room Operator verifies completeness in `/control-room/shift-closeout` and submits the shift (`status = 'pending_approval'`).
2. **Separation-of-Duties Check:**
   - The approving supervisor must be a distinct authenticated employee (`approverId !== operatorId`) with the `control_room_supervisor` or `admin` role.
3. **Ledger Inspection:**
   - Inspect total operating hours (`0 <= operatingHours <= 12`), SMR deltas (`closingSmr - openingSmr <= 12`), haulage tonnages, and committed delay comments.
4. **PIN Authorization:**
   - Enter the 6-digit Supervisor PIN in `CloseShiftModal`.
   - Upon verification, `atomic_shift_closeout` seals the shift (`status = 'closed'`), records the immutable audit log entry, and invalidates department caches.

---

## 4. Handling Exceptions & Overrides

- **Exempting Standby Equipment:** If a machine is undergoing long-term overhaul, mark `report_exempt = true` in the machine registry so it does not block shift closeout.
- **Correcting Pre-Closeout Discrepancies:** Reject the closeout request and instruct the operator to amend `/control-room/end-smr` or `/control-room/machine-operations` before re-submitting.
- **Supervisor PIN Lockout:** If locked out after 3 failed PIN attempts, another authorized supervisor can approve immediately, or IT Security can follow `docs/control-room/pin-reset-procedure.md`.
