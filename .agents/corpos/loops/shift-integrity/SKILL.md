---
name: "shift-integrity-skill"
description: "Adaptive operational runbook for Control Room shift handovers, SCADA failover, and telemetry health audits."
department: "control-room"
authority_level: "L2"
---

# Shift Integrity & SCADA Monitor — Agent Skill Runbook

## 1. Input Context
- **Signal**: SCADA MQTT event, shift conclusion timer, or sensor drift alert.
- **Brief**: Read `.agents/corpos/storage/briefs/<tick_id>.md`.

## 2. Execution Phases

### Phase 1: Telemetry Health Check
1. Probe control room health endpoint (`apps/portal/app/api/control-room/health/route.ts`).
2. Verify Redis cache freshness for mining machinery telemetry (`arch:telemetry:equipment:*`).

### Phase 2: Shift Handover Audit
1. Query active shift records in `public.shifts`.
2. Ensure shifts past their scheduled duration contain supervisor closeout signatures.
3. If an unclosed shift is detected, prepare an operational escalation card.

### Phase 3: Machinery Assignment Check
1. Cross-reference `public.mining_equipment` with active employee shifts.
2. Flag machinery operating without assigned certified operators.

### Phase 4: Outcome & Reporting
1. Output structured summary of shift status, active alerts, and telemetry ping latencies.
2. If equipment threshold breaches are detected, escalate immediately.

## 3. Negative Constraints
- NEVER overwrite or bypass supervisor PIN checks.
- NEVER write mock telemetry data into production tables.
