# Shift Closeout Runbook (`TASK-5.1`)

**Severity:** High  
**Department:** Control Room  
**Owner:** Control Room Operations & Platform Engineering

---

## 1. Overview

Shift closeout finalizes an active Control Room shift (`day` or `night`), verifies completeness of all operational records (Start SMR, End SMR, Machine Operations, Hourly Loads, Shift Compilation), enforces dual-operator separation of duties via Supervisor PIN approval, and writes an immutable audit trail via `atomic_shift_closeout`.

---

## 2. Step-by-Step Shift Closeout Procedure

### Step 1: Verify Shift Completeness

Before initiating closeout, verify that all mandatory shift records are present and reconciled:

1. Navigate to `/control-room/shift-closeout` or open the **Close Shift** modal from the Control Room workspace.
2. The client queries `GET /api/control-room/shift-completeness?shiftId=<uuid>` (backed by `checkShiftCompleteness` in `apps/portal/lib/shift-completeness.ts`).
3. Confirm all completeness checks pass:
   - **Start SMR & End SMR:** Every active machine assigned to the shift has both opening and closing Service Meter Readings (`end_smr >= start_smr`, within the 16-hour shift ceiling).
   - **Machine Operations:** All active haul trucks, excavators, and drill rigs have logged operational states and operator assignments.
   - **Hourly Loads & Shift Compilation:** Production tonnages (calculated using machine `bin_factor`) and dozer rolls are reconciled with zero unacknowledged critical alerts.

### Step 2: SMR & Production Ledger Review

1. Review the aggregated shift summary in the closeout modal:
   - Total tonnes moved, total drill meters, machine utilization hours, and engineering notes.
2. If discrepancies exist, return to `/control-room/end-smr`, `/control-room/hourly-loads`, or `/control-room/shift-compilation` to correct entries before proceeding.

### Step 3: Submit Shift Closeout Request

1. Submit the closeout payload to `POST /api/control-room/shift-closeout` with an `Idempotency-Key` header.
2. If the shift requires supervisor sign-off or separation-of-duties approval, the shift transitions to `pending_approval`.

### Step 4: Supervisor PIN Entry & Separation-of-Duties Approval

1. A supervisor or authorized approver (distinct from the submitting operator: `approverId !== operatorId`) enters their 6-digit supervisor PIN.
2. The request is sent to `POST /api/control-room/shift-closeout/approve` (or verified via `verifyPin` in `apps/portal/lib/shift-closeout.ts`).
3. Upon verification:
   - The `atomic_shift_closeout` PostgreSQL RPC executes transactionally.
   - Shift status transitions to `closed`.
   - Next.js and Redis L1/L2 cache tags (`dept:control-room`, `shift-closeout`) are invalidated.

---

## 3. Error Resolution & Recovery Procedures

### 3.1 Supervisor PIN Lockout & CAPTCHA Challenge (3-Attempt / 5-Minute Window → 15-Minute Lockout)

- **Mechanism:** `verifyPin` tracks failed PIN attempts per user (`cr:pin:attempts:<userId>`) in Redis with an automatic in-process `MemoryStore` fallback if Redis is unreachable.
- **Threshold:** **3 failed attempts within a 5-minute window (300s)** triggers:
  1. Immediate **15-minute lockout (900s)** (`cr:pin:lockout:<userId>`).
  2. Mandatory **Turnstile CAPTCHA challenge** requirement (`requiresCaptcha: true`) before any subsequent verification after lockout expiry or elevated risk.
- **Resolution:**
  - **Wait for Lockout Expiry:** Wait 15 minutes for the TTL on `cr:pin:lockout:<userId>` to expire, then complete the CAPTCHA challenge and enter the valid PIN.
  - **Alternate Approver:** Another active supervisor with `control_room_supervisor` or `admin` role can approve the closeout immediately (lockout is scoped per `userId`).
  - **Admin Lockout Clear (Emergency Only):** Verified IT/Database administrators can clear the lockout key in Redis:
    ```bash
    redis-cli DEL "cr:pin:lockout:<user_uuid>" "cr:pin:attempts:<user_uuid>"
    ```
    If running in fallback memory mode on an isolated instance, restart or recycle the affected worker or use an alternate supervisor account.

### 3.2 Rate Limit Exceeded (`429 Too Many Requests` — 5 req/min)

- **Mechanism:** Shift closeout endpoints enforce a strict rate limit of **5 requests per minute per operator** (`RATE_LIMIT_MAX_ATTEMPTS = 5`, `RATE_LIMIT_WINDOW_MS = 60_000`).
- **Symptom:** HTTP `429` with `RateLimitError` (`Too many shift closeout attempts. Please wait 60 seconds.`).
- **Resolution:**
  - Pause rapid retries for 60 seconds.
  - Inspect the `Retry-After` response header before re-submitting.

### 3.3 Idempotency Key Replay & Stuck Transactions

- **Mechanism:** `POST /api/control-room/shift-closeout` records the client's `Idempotency-Key` in PostgreSQL `public.idempotency_keys`.
- **Symptom:** Network timeout during submission or `409 Conflict` / duplicate submission warning.
- **Resolution:**
  - Safe to retry with the **same `Idempotency-Key`**. The server will replay the cached deterministic result without double-closing or duplicating ledger entries.
  - If `atomic_shift_closeout` timed out (`statement_timeout`), check Postgres locks on `public.idempotency_keys` and `public.shifts` (see `docs/runbooks/control-room/closeout-failure.md`).

### 3.4 Offline Outbox Recovery

- **Mechanism:** When WAN/Supabase connectivity drops during closeout or machine status updates, the Control Room client queues mutations in the browser's IndexedDB/localStorage offline outbox (`OutboxSyncBanner`).
- **Resolution:**
  1. Do **not** clear browser site data or close the tab in incognito mode while the **Offline Outbox** badge shows pending items.
  2. Once connectivity is restored (`/api/health` returns `200 OK`), the outbox automatically replays queued mutations in FIFO order using their original idempotency keys.
  3. If an item remains stuck in `failed` state inside the outbox banner, click **Retry Sync** or export the JSON payload from the diagnostic drawer for manual administrator reconciliation.

---

## 4. Emergency Escalation Procedures

| Condition                                     | Immediate Action                                                                         | Escalation Target                         | SLA       |
| :-------------------------------------------- | :--------------------------------------------------------------------------------------- | :---------------------------------------- | :-------- |
| **`atomic_shift_closeout` 5xx / DB Deadlock** | Capture request `x-correlation-id` and shift ID; record manual handover log              | On-Call Backend / DBA Team                | 15 mins   |
| **All Supervisors Locked Out**                | Verify identity out-of-band; clear Redis `cr:pin:lockout:*` or assign temporary approver | Control Room Superintendent + IT Security | 15 mins   |
| **Prolonged Outage (>30m at Shift Handover)** | Complete signed paper/PDF contingency handover sheet; reconcile in portal once online    | Mine Operations Manager                   | Immediate |
