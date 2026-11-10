# Supervisor PIN Reset & Security Procedure (`TASK-13.1`)

**Audience:** Control Room Supervisors, System Administrators, IT Security  
**Department:** Control Room (`/control-room`)

---

## 1. Overview

Supervisor PIN verification enforces separation of duties during Control Room shift closeout (`POST /api/control-room/shift-closeout/approve`). Only users holding the `control_room_supervisor` or `admin` role with a valid, hashed 6-digit PIN can authorize shift completion (`approverId !== operatorId`).

---

## 2. PIN Security Requirements

- **Format:** 6-digit numeric code (`000000`–`999999`), rejecting trivial sequences (e.g., `123456`, `000000`, repeated digits).
- **Storage:** Salted cryptographic hash stored in `public.employees` (`pin_hash`); plaintext PINs are never logged or persisted.
- **Rate Limiting & Lockout (`TASK-7.3`):**
  - Up to **3 failed verification attempts within a 5-minute window (`300s`)** per user (`cr:pin:attempts:<userId>`).
  - Exceeding 3 failed attempts triggers an immediate **15-minute lockout (`900s`)** (`cr:pin:lockout:<userId>`) and requires a **Cloudflare Turnstile CAPTCHA** challenge (`requiresCaptcha: true`).
- **Rotation Policy:** Supervisors must rotate their PIN every 90 days or immediately following suspected compromise.

---

## 3. Initial PIN Setup & Self-Service Rotation

1. Authenticate into the portal with an active `control_room_supervisor` or `admin` account.
2. Open **Account Security Settings** or invoke the `setPin` workflow in `apps/portal/lib/shift-closeout.ts`.
3. Provide current session credentials and enter the new 6-digit PIN twice for confirmation.
4. Verify that an audit event (`event: 'supervisor_pin_updated'`) is recorded in the structured audit log.

---

## 4. Administrative PIN Reset Procedure

When a supervisor forgets their PIN or is locked out during shift handover:

1. **Identity Verification:**
   - The requesting supervisor must confirm their identity out-of-band with the Control Room Superintendent or on-call IT Security administrator.
2. **Clear Active Lockout State:**
   - Clear the Redis lockout and attempt counters for the supervisor's employee UUID:

     ```bash
     redis-cli DEL "cr:pin:lockout:<employee_uuid>" "cr:pin:attempts:<employee_uuid>"
     ```

3. **Issue Temporary Reset:**
   - Execute the administrative PIN reset action to clear the existing `pin_hash` and require immediate PIN enrollment on next login.
4. **Audit Trail Verification:**
   - Record the incident ticket reference and verify the reset entry in `public.audit_logs`.
