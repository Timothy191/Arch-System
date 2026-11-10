# Control Room Alert Response Procedures (`TASK-13.5`)

**Audience:** Control Room Operators, Shift Supervisors, Maintenance Dispatch  
**Department:** Control Room (`/control-room`)

---

## 1. Overview

The Control Room `AlertPanel` aggregates real-time equipment faults, SCADA threshold breaches, and shift data completeness warnings. Every `Critical` alert must be triaged, acted upon, and acknowledged before shift closeout can proceed.

---

## 2. Alert Severity Tiers & SLAs

| Severity     | Visual Indicator          | Examples                                                                            | Triage SLA          | Escalation SLA    |
| :----------- | :------------------------ | :---------------------------------------------------------------------------------- | :------------------ | :---------------- |
| **Critical** | Red Banner + Audible Tone | Unplanned machine breakdown, crusher trip, safety interlock, SCADA feed down        | Immediate (<2 mins) | 15 minutes        |
| **Warning**  | Amber Badge               | High SMR hours (>8h single operator), missing hourly load entry, FUXA degraded mode | <5 minutes          | 30 minutes        |
| **Info**     | Blue / Neutral Badge      | Scheduled refueling, shift handover reminder, operator scan completed               | <15 minutes         | Next shift review |

---

## 3. Step-by-Step Alert Response Workflow

### Step 1: Identify & Triage

1. Locate the active alert at the top of `AlertPanel` (sorted by severity and timestamp).
2. Inspect the affected `machineId`, telemetry tag or completeness rule, and trigger timestamp.

### Step 2: Field Verification & Dispatch Action

1. **Equipment Breakdown / Fault Alert:**
   - Hail the machine operator on the pit radio channel to confirm safety and fault nature.
   - Dispatch the field maintenance crew and log the breakdown in `/control-room/engineering-notes` or `/control-room/machine-operations`.
2. **Missing Shift Data / Completeness Alert:**
   - Triggered by the 15-minute completeness check job (`apps/portal/lib/jobs/shift-completeness-check.ts`).
   - Open the linked form (`hourly-loads`, `excavator-activity`, `roll-over`, or `machine-operations`) and record the missing entry.
3. **SCADA / Realtime Connectivity Alert:**
   - Verify `/api/health` status (`fuxa`, `supabase-realtime`, `redis`) and follow `docs/control-room/troubleshooting.md`.

### Step 3: Acknowledge Alert in Portal

1. Click **Acknowledge** on the alert item in `AlertPanel`.
2. Enter a concise operational resolution note (e.g., `"Dispatched bay 2 mechanic; hydraulic hose replacement in progress"`).
3. The acknowledgment is persisted with actor ID and timestamp, clearing the closeout blocker once resolved.

---

## 4. Escalation Matrix

- **Unresolved > 15 Minutes (`Critical`):** Escalate to the Shift Supervisor and Maintenance Planner.
- **Unresolved > 30 Minutes (`Critical` Safety / Primary Crusher Down):** Escalate to the Mine Operations Manager.
- **Telemetry / Portal Infrastructure Outage:** Escalate to On-Call Platform Engineering with the `x-correlation-id` header.
