# Control Room Operations Overhaul: Implementation Checklist & Roadmap

**System:** Arch-System Control Room Suite (`apps/portal`, `libs/features/departments`, `packages/contract`, `packages/database`, `packages/ui`)  
**Tracking Format:** Checklist (`[ ]` Incomplete, `[x]` Completed)  
**Execution Strategy:** Multi-Agent Swarm with Injected Role Context  

---

## Phase 1: Routing, SMR Initialization & Safety Gateways (P0 Critical)

### 1.1 Unify `/control-room` Route & Eliminate Shadowing
- [x] **TASK-1.1.1:** Relocate `ShiftCloseoutForm` section from `apps/portal/app/(departments)/control-room/page.tsx` into a dedicated route: `apps/portal/app/(departments)/control-room/shift-closeout/page.tsx`.
- [x] **TASK-1.1.2:** Refactor `apps/portal/app/(departments)/control-room/page.tsx` to render the primary Control Room operations dashboard:
  - Mount `ControlRoomHeader`.
  - Mount `ControlRoomSummaryGridClient`.
  - Mount `ControlRoomWidgets` containing re-ordered widgets.
- [x] **TASK-1.1.3:** Register missing routes in [`libs/features/departments/data-access/src/departments.ts`](file:///home/tim/Fork/Arch-System/libs/features/departments/data-access/src/departments.ts#L203-L211):
  - Add `shift-compilation` ("Shift Handover").
  - Add `shift-coverage` ("Roster & Coverage").
  - Add `shift-closeout` ("Shift Closeout").

### 1.2 Fix SMR Initialization & Validation Tolerance
- [x] **TASK-1.2.1:** In `apps/portal/app/(departments)/control-room/shift-closeout/page.tsx`, resolve opening SMR dynamically from previous shift's `end_smu` instead of defaulting to `0`.
- [x] **TASK-1.2.2:** Update [`packages/contract/src/schemas/machine-ledger.schema.ts`](file:///home/tim/Fork/Arch-System/packages/contract/src/schemas/machine-ledger.schema.ts#L33-L41):
  - Expand maximum shift window from 12.0h to 12.5h with operational tolerance.
  - Require `overrun_reason` string if allocated hours exceed 12.0h.
- [x] **TASK-1.2.3:** In [`MachineOperationsForm.tsx`](file:///home/tim/Fork/Arch-System/apps/portal/app/(departments)/[department]/machine-operations/MachineOperationsForm.tsx), add `start_smu` and `end_smu` inputs so `hours_worked` computes automatically in PostgreSQL.

### 1.3 Fix Offline Queue & Connectivity Logic
- [x] **TASK-1.3.1:** In [`ShiftCloseoutForm.tsx`](file:///home/tim/Fork/Arch-System/apps/portal/app/(departments)/control-room/components/ShiftCloseoutForm.tsx#L78-L95), update `handleSubmit`:
  - Attempt direct POST to `/api/control-room/shift-closeout` when `isOnline && !isDegraded`.
  - Fallback to `enqueue()` only on network error or offline status.
- [x] **TASK-1.3.2:** In `ShiftCloseoutForm.tsx` (lines 109–113), consume `isDegraded` to display high-latency alert banner; display disconnected badge when `!isOnline`.
- [x] **TASK-1.3.3:** Replace hardcoded `'Control Room Operator'` literal in `ShiftCloseoutForm.tsx` (line 48) with authenticated user session identity.

### 1.4 Purge Thread-Blocking `alert()` Calls
- [x] **TASK-1.4.1:** In [`HourlyLoadsGrid.tsx`](file:///home/tim/Fork/Arch-System/apps/portal/app/(departments)/[department]/hourly-loads/HourlyLoadsGrid.tsx) (lines 370, 483, 496, 533, 947, 958), replace all native `alert(...)` with `toast.error(...)` or `toast.warning(...)` from `sonner`.

---

### [x] CRITICAL STAGE REVIEW 1: Phase 1 Verification Gate
- [x] Verify visiting `/control-room` renders the live dashboard with KPI summary and widgets.
- [x] Verify `ShiftCloseoutForm` loads actual machine opening SMR numbers without zero-baseline errors.
- [x] Verify submitting closeout directly hits the server when online and does not remain stranded in IndexedDB.
- [x] Verify no browser `alert()` modal appears anywhere in `HourlyLoadsGrid`.
- [x] Execute `pnpm type-check` — ensure 0 type errors.

---

## Phase 2: Operator Ergonomics, Fitts's Law & Viewport Prioritization (P1 High)

### 2.1 Persistent Dockable Sidebar
- [x] **TASK-2.1.1:** In [`DepartmentLayout.tsx`](file:///home/tim/Fork/Arch-System/packages/ui/src/components/DepartmentLayout.tsx#L128-L165):
  - Add pin toggle with `localStorage` persistence.
  - Sidebar remains docked (`translate-x-0`) when pinned.
  - Main container uses dynamic `pl-64` when pinned, preventing any overlap on main workspace tables.
  - Disable edge hover trigger overlay when pinned to protect table clicks.

### 2.2 Fitts's Law Steppers & Touch Targets
- [x] **TASK-2.2.1:** In [`HourlyLoadsGrid.tsx`](file:///home/tim/Fork/Arch-System/apps/portal/app/(departments)/[department]/hourly-loads/HourlyLoadsGrid.tsx#L817-L870):
  - Enlarge load stepper buttons from 10px to at least $32 \times 32\text{px}$ touch targets.
  - Add explicit `aria-label` tags for screen readers.
  - Implement keyboard arrow increment support on focused cells.
- [x] **TASK-2.2.2:** In [`EquipmentDashboard.tsx`](file:///home/tim/Fork/Arch-System/libs/features/departments/ui/src/control-room/EquipmentDashboard.tsx#L165-L173):
  - Enlarge "Report Breakdown" button to 44px height (`px-4 py-2 text-xs font-semibold rounded-lg`).
  - Add confirmation dialog (`AnimatedDialog`) requiring confirmation before dispatching maintenance escalation.

### 2.3 Telemetry Viewport Prioritization & Real-Time SCADA
- [x] **TASK-2.3.1:** In [`ControlRoomWidgets.tsx`](file:///home/tim/Fork/Arch-System/apps/portal/app/(departments)/[department]/ControlRoomWidgets.tsx#L50-L89):
  - Reorder layout: Move `ScadaPanel` and `AlertPanel` to the top row immediately below the summary KPIs.
  - Move `ShiftCoverageSectionClient` and `ControlRoomChecklistWidget` below SCADA.
- [x] **TASK-2.3.2:** In [`ScadaPanel.tsx`](file:///home/tim/Fork/Arch-System/apps/portal/features/departments/components/control-room/ScadaPanel.tsx):
  - Connect to `/api/control-room/scada-status` to reflect real Redis & FUXA gateway health.
  - Wire manual refresh button `onClick`.
  - Display actual status (Stream Active, Degraded with latency, or Breaker Tripped).

---

### [x] CRITICAL STAGE REVIEW 2: Phase 2 Verification Gate
- [x] Verify sidebar can be pinned or unpinned without layout flickering or blocking left table columns.
- [x] Verify hourly loads steppers are easy to click with mouse/trackball ($32\text{px}$) and keyboard functional.
- [x] Verify "Report Breakdown" button opens confirmation modal before triggering background mutation.
- [x] Verify SCADA and Alert telemetry are immediately visible above the fold on 1080p monitors.
- [x] Execute `pnpm lint` and `pnpm type-check` — ensure 0 warnings/errors.

---

## Phase 3: Compliance Persistence, Alarm Lifecycle & Theming (P2 Medium)

### 3.1 Shift Checklist Database Persistence
- [ ] **TASK-3.1.1:** In [`ControlRoomChecklistWidget.tsx`](file:///home/tim/Fork/Arch-System/apps/portal/features/departments/components/control-room/ControlRoomChecklistWidget.tsx):
  - Persist checked states to PostgreSQL via dedicated API / Supabase mutation.
  - Wire "Proceed to Shift Closeout" button to navigate to `/control-room/shift-closeout` with checklist reference.

### 3.2 ISA-18.2 Alarm Acknowledgement State Machine
- [ ] **TASK-3.2.1:** In [`AlertPanel.tsx`](file:///home/tim/Fork/Arch-System/apps/portal/features/departments/components/control-room/AlertPanel.tsx):
  - Update styles for critical alarms with high-contrast banners (`bg-red-600 text-white font-bold`).
  - Add functional `[Acknowledge]` action with operator comments modal.
  - Log acknowledgement timestamp and operator ID to audit trail.

### 3.3 Design Token Theming Normalization & Dark NOC Support
- [x] **TASK-3.3.1:** Purge hardcoded `bg-white/70`, `bg-neutral-50`, `text-neutral-900` in:
  - [`FleetKpiTable.tsx`](file:///home/tim/Fork/Arch-System/libs/features/departments/ui/src/control-room/FleetKpiTable.tsx)
  - [`ProductionSummaryCard.tsx`](file:///home/tim/Fork/Arch-System/libs/features/departments/ui/src/control-room/ProductionSummaryCard.tsx)
  - [`TireAlertsBanner.tsx`](file:///home/tim/Fork/Arch-System/libs/features/departments/ui/src/control-room/TireAlertsBanner.tsx)
- [ ] **TASK-3.3.2:** Migrate all deprecated `arch-*` classes in `EquipmentDashboard.tsx` to CSS custom property tokens (`var(--surface-*)`, `var(--text-*)`).
- [ ] **TASK-3.3.3:** Add dark-theme contrast variables for night shift (18:00–06:00) control room lighting.

---

### [ ] CRITICAL STAGE REVIEW 3: Phase 3 Verification Gate
- [ ] Verify checklist items retain checked state after a hard browser reload.
- [ ] Verify acknowledging an alert transitions status to steady state with audit logging.
- [ ] Verify dark mode renders without blinding white cards in `FleetKpiTable` or `ProductionSummaryCard`.
- [ ] Execute `pnpm agent:verify` or full quality suite (`pnpm type-check && pnpm lint && pnpm test`).
