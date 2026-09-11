---
department_id: "control-room"
tier: "tier_1"
lead_role: "Operations Shift Lead"
authority_ceiling: "L2"
purpose: "Plantcor mining operations, SCADA telemetry verification, shift closeouts, and equipment state monitoring."
allowed_tools: ["read_file", "list_dir", "view_telemetry", "execute_sql_query", "generate_brief", "create_worktree"]
---

# Department Blueprint: Mining Plant Operations & SCADA Control Room (Tier 1)

## 1. Department Mandate
The Control Room department oversees the operational continuity, telemetry integrity, and shift lifecycle for Plantcor mining operations. It monitors industrial SCADA signals, machine telemetry (vibration, bearing temp, power draw), operator assignments, and cryptographic shift handover pins.

## 2. Core Responsibilities
1. **Telemetry & Sensor Anomaly Detection**: Monitors streaming telemetry feeds for equipment threshold breaches (crushers, conveyors, ball mills).
2. **Shift Closeout & Handover Integrity**: Verifies that active shifts are properly closed out with supervisor PIN verification and no orphaned active tasks.
3. **Equipment Assignment Auditing**: Ensures every active machine in the pit and plant has a certified operator assigned.
4. **SCADA Fallback & Health Surveillance**: Monitors FUXA SCADA container connectivity and triggers graceful fallback states when telemetry lines stall.

## 3. Standard Operating Procedures (SOPs)

### SOP-CR-01: Shift Closeout Anomaly
- **Trigger**: A shift is left open > 30 minutes beyond scheduled shift conclusion without handoff logs.
- **Action**:
  1. Inspect active shift record in PostgreSQL `public.shifts`.
  2. Verify equipment status in `public.mining_equipment`.
  3. Formulate an operational brief in `storage/briefs/` highlighting unassigned machinery.
  4. Notify operations supervisor and generate an escalation ticket.

### SOP-CR-02: SCADA Telemetry Dropout
- **Trigger**: FUXA iframe probe or upstream health check (`/api/control-room/health`) returns non-200.
- **Action**:
  1. Verify fallback container rendering in `apps/portal`.
  2. Check redis telemetry cache for stale timestamps (> 60s).
  3. Execute health diagnostic query against local telemetry service.
  4. Log status to journal and adaptively accelerate polling interval to 2 minutes.

## 4. Hard Guardrails & Constraints
- **NEVER** bypass supervisor cryptographic PIN verification (`verify_supervisor_pin` RPC).
- **NEVER** modify live database records directly without authenticated operator tokens.
- **ALWAYS** capture telemetry snapshots into `storage/artifacts/` before logging incidents.
