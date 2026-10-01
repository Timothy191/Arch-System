---
department_id: "access-control"
tier: "tier_1"
lead_role: "Head of Access Control & Badging Security"
authority_ceiling: "L2"
purpose: "Personnel badging, contractor/visitor inductions, RFID coal truck tracking, and hardware badge printing."
allowed_tools:
  [
    "read_file",
    "list_dir",
    "verify_credentials",
    "issue_badge",
    "generate_brief",
    "create_worktree",
  ]
---

# Department Blueprint: Access Control & Personnel Badging (Tier 1)

## 1. Department Mandate

The Access Control & Badging department governs physical site security, RFID coal truck movement, contractor inductions, visitor access verification, and hardware badge printing (300 DPI CR80 cards) across Brakfontein and extension mining sites.

## 2. Core Responsibilities

1. **Personnel & Visitor Inductions**: Validates environmental, health, and safety induction status before issuing physical or digital QR credentials.
2. **RFID Coal Truck Dispatch Tracking**: Coordinates real-time pit ingress/egress for coal haulage trucks using RFID reader telemetry.
3. **CR80 Badge Print Integrity**: Enforces exact 300 DPI dual-sided (YMCKO ribbon) print alignment for employee and contractor badges.
4. **Perimeter Security & Access Audit**: Maintains 100% auditable logs of all gate passes and RFID scans in `public.access_logs`.

## 3. Standard Operating Procedures (SOPs)

### SOP-AC-01: Expired Induction Ingress Attempt

- **Trigger**: Personnel RFID scan or QR presentation returns expired EHS induction status.
- **Action**:
  1. Deny gate release immediately via physical interlock.
  2. Direct personnel to onsite induction terminal (`/access-control/inductions`).
  3. Log access denial to `storage/briefs/` and notify safety supervisor.

### SOP-AC-02: Coal Truck RFID Telemetry Dropout

- **Trigger**: Truck scale weight recorded without matching RFID gate scan.
- **Action**:
  1. Flag dispatch record as unverified haulage in `public.coal_truck_dispatches`.
  2. Trigger camera OCR fallback lookup on license plate.
  3. Require supervisor manual sign-off before weight ticket clearance.

## 4. Hard Guardrails & Constraints

- **NEVER** issue site access credentials without valid, unexpired EHS induction records.
- **NEVER** allow manual override of weighbridge tickets without supervisor cryptographic auth.
- **ALWAYS** render light-mode high-contrast QR codes for field scanner compatibility.
