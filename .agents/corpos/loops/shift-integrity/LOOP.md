---
id: "shift-integrity"
name: "Control Room Shift Integrity & SCADA Monitor"
department: "control-room"
authority_level: "L2"
schedule:
  min_interval_minutes: 10
  max_interval_minutes: 60
  backoff_factor: 1.5
signals:
  - source: "scada"
    event: "shift-closeout-pending"
  - source: "telemetry"
    metric: "unassigned_equipment_count"
    threshold: "> 0"
verification:
  commands:
    - "node -e 'console.log(\"Validating SCADA telemetry contracts and shift states...\");'"
---

# Business Loop: Control Room Shift Integrity & SCADA Monitor

## 1. Business Intent
Surveys real-time mining operations across the plant and pit. Verifies that all operational shifts have valid supervisor cryptographic signatures, no orphaned machinery runs unmonitored, and SCADA telemetry lines remain healthy.

## 2. Invariants & Guardrails
- **Cryptographic PIN Verification**: Shift handovers require supervisor PIN validation via `verify_supervisor_pin` RPC.
- **Fail-Safe Telemetry**: If FUXA iframe drops or streams lag > 60s, activate graceful fallback views in `apps/portal`.
- **Zero Unassigned Machines**: Every active excavator, haul truck, and ball mill must map to an active operator ID.
