# Requirements Specification: Access Control & Security Operations Center (EARS Syntax)

## Ubiquitous Requirements
- **REQ-UBI-01**: The Access Control system SHALL strictly adhere to the project's light-mode invariant (#f3f4f6 canvas, background luminance > 200, semantic OKLCH tokens, zero `dark:` Tailwind classes).
- **REQ-UBI-02**: All data persistence and security state mutations SHALL execute exclusively via Next.js Server Actions with atomic audit logging.
- **REQ-UBI-03**: All primary telemetry, badge inventories, and access event queries SHALL execute in Server Components (RSC) with Suspense streaming fallbacks.
- **REQ-UBI-04**: Timestamps, Badge hex codes, RFID EPCs, and Gate IDs SHALL render in tabular monospace font (`JetBrains Mono`).

## Event-Driven Requirements
- **REQ-EVT-01**: WHEN an authorized user navigates to `/access-control`, the system SHALL render the Security Operations Center dashboard displaying live on-site headcount, active perimeter barriers, KPI bento grid, and real-time activity feed without throwing 403 authorization crashes.
- **REQ-EVT-02**: WHEN a security officer triggers "Remote Gate Pulse" from the Quick Action hub, the system SHALL log the caller identity, gate ID, and timestamp into `access_logs` and display a confirmation status toast.
- **REQ-EVT-03**: WHEN a blast clearance or emergency evacuation occurs, the system SHALL enable the "Emergency Muster Mode" allowing safety marshals to reconcile and check off on-site personnel against Muster Stations A, B, and C in real-time.
- **REQ-EVT-04**: WHEN a user accesses the "Reports" tab (`/access-control/reports`), the system SHALL render the Regulatory Audit & Access Analytics studio with filterable date ranges and export capabilities instead of returning a 404 error.
- **REQ-EVT-05**: WHEN a badge swipe occurs with an expired safety induction or medical fitness certificate, the system SHALL flag the entry as denied with an explicit denial reason ("Expired Induction" / "Expired Medical").

## State-Driven Requirements
- **REQ-STA-01**: WHILE in normal operating state, the perimeter barrier HUD SHALL display live statuses (Operational, Pulse Ready, Interlock Active) for Main Inbound Boom, South Pit Turnstiles, Haul Truck Weighbridge RFID, and Magazine Portal.
- **REQ-STA-02**: WHILE an individual is checked-in on site without a recorded exit scan, the system SHALL register that individual in the active site headcount and muster roster.
- **REQ-STA-03**: WHILE network connectivity is intermittent, the system SHALL fall back to cached metrics and enqueue offline security registrations via the `useOfflineQueue` background sync engine.

## Optional & Unwanted Behavior Requirements
- **REQ-OPT-01**: WHERE available, the system SHALL display breathalyzer (BAC) zero-tolerance interlock indicators and contractor induction compliance status badges.
- **REQ-UNW-01**: The system SHALL NOT fail or present a blank screen or unhandled "Try Again" crash if the database metrics RPC encounters schema cache lag or if a non-admin role views site headcount.
- **REQ-UNW-02**: The system SHALL NOT allow badge issuance without validating required entity relationships (Personnel, Contractor, Fleet Vehicle, or Heavy Equipment).
