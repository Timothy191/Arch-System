# Control Room Troubleshooting Guide (`TASK-13.9`)

**Audience:** Control Room Operators, Support Engineers, On-Call SREs  
**Department:** Control Room (`/control-room`)

---

## 1. Quick Diagnostic Health Probes

Before troubleshooting specific UI or data symptoms, check the unified health endpoints:

- **`GET /api/health`** — Aggregated system status across all backing services.
- **`GET /api/health/fuxa`** — FUXA HMI reachability and HTTP latency (`<500ms` target).
- **`GET /api/health/supabase-realtime`** — Realtime WebSocket connectivity and active subscription health.
- **`GET /api/health/redis`** — Redis cache connectivity, hit ratio, and memory status.

---

## 2. Common Operational Issues & Resolutions

### 2.1 Shift Cannot Be Closed (`Completeness < 100%`)

- **Symptom:** The **Close Shift** button is disabled or returns a validation error listing uncovered machines.
- **Root Cause:** One or more active, non-exempt machines (`report_exempt = false`) lack a required entry for the shift (`machine-operations`, `hourly-loads`, `excavator-activity`, or `roll-over`), or SMR/bin-factor constraints failed (`validateMachineOperationConstraints`).
- **Resolution:**
  1. Inspect the uncovered machine cards in the Shift Completeness checklist.
  2. Click the machine's form link to log its operation, hourly load (`total_loads > 0`), or breakdown status.
  3. Verify `0 <= operatingHours <= 12`, `0.1 <= binFactor <= 50`, and `0 <= closingSmr - openingSmr <= 12`.
  4. If the unit is decommissioned or on long-term overhaul, ask an administrator to set `report_exempt = true` in `public.machines`.

### 2.2 Supervisor PIN Rejected or Locked Out

- **Symptom:** PIN approval returns `403 Forbidden`, `429 Too Many Requests`, or prompts for a CAPTCHA challenge.
- **Root Cause:**
  - Approver is the same user who submitted the shift (`approverId === operatorId` violates separation of duties).
  - Approver entered 3 incorrect PINs within 5 minutes, triggering a 15-minute lockout (`cr:pin:lockout:<userId>`).
- **Resolution:**
  - Ensure a distinct supervisor with `control_room_supervisor` or `admin` role approves the shift.
  - Follow `docs/control-room/pin-reset-procedure.md` to clear Redis lockout keys if emergency approval is required.

### 2.3 Stale Shift Sheet or Missing Delay Minutes

- **Symptom:** Committed delay entries or breakdown hours do not appear on the Shift Compilation sheet.
- **Root Cause:** Delay entry is still in `draft` status (`status !== 'committed'`), was soft-deleted (`deleted_at IS NOT NULL`), or breakdown `fleet_id` does not match machine `id`, `name`, or `serial_number`.
- **Resolution:**
  1. Open `/control-room/engineering-notes` and confirm the delay entry is saved/committed.
  2. Verify the breakdown record's `fleet_id` matches the registered machine name or serial number.

### 2.4 Offline Outbox Stuck Pending Sync

- **Symptom:** The `OutboxSyncBanner` displays queued mutations after network recovery.
- **Resolution:**
  1. Confirm `/api/health` returns `200 OK`.
  2. Click **Retry Sync** in the banner; queued requests replay idempotently using their `Idempotency-Key`.
  3. Never clear browser storage while offline mutations are pending.
