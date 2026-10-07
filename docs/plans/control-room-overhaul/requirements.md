# Control Room Operations Overhaul: Integrated Requirements

**System:** Arch-System Control Room Suite (`apps/portal`, `libs/features/departments`, `packages/contract`, `packages/database`, `packages/ui`)  
**Domain:** Industrial Mining Pit Control Center (24/7 Dispatch, SCADA Telemetry, SMR Tracking, Shift Closeout)  
**Standard Compliance:** ANSI/ISA-18.2 (Alarm Management), ISO 11064 (Control Centre Ergonomics), WCAG 2.1 AA, MSHA/MHSA Shift Handover Compliance  
**Tracking Format:** Checklist (`[ ]` Pending, `[x]` Completed)

---

## 1. Primary Objectives (Safety-Critical & Operational Blockers)

### 1.1 Routing & Information Architecture (Jakob's Law)
- [ ] **REQ-PRI-01:** Eliminate Next.js App Router route shadowing at `/control-room`.
  - [ ] Navigating to `/control-room` MUST render the live operational dashboard (`ControlRoomSummaryGridClient`, `EquipmentDashboard`, `ScadaPanel`, `AlertPanel`, `ControlRoomWidgets`) instead of an isolated closeout form.
  - [ ] Relocate the administrative SMR bulk closeout table to `/control-room/shift-closeout` and link it to `/control-room/shift-compilation`.
- [ ] **REQ-PRI-02:** Register orphaned critical routes in `CONTROL_ROOM_TABS` ([`departments.ts`](file:///home/tim/Fork/Arch-System/libs/features/departments/data-access/src/departments.ts#L203-L211)).
  - [ ] Add `shift-compilation` ("Shift Handover", icon: `ClipboardCheck`).
  - [ ] Add `shift-coverage` ("Roster & Coverage", icon: `Users`).
  - [ ] Deprecate the isolated single-machine `end-smr` tab in favor of the consolidated `shift-compilation` ledger.

### 1.2 Shift Handover & SMR Validation (Postel's Law & Peak-End Rule)
- [ ] **REQ-PRI-03:** Fix the zero-baseline SMR initialization trap.
  - [ ] In [`control-room/page.tsx`](file:///home/tim/Fork/Arch-System/apps/portal/app/(departments)/control-room/page.tsx#L15-L25) and closeout forms, dynamically populate `opening_smr` from the previous shift's recorded `closing_smr` (or latest machine telemetry).
  - [ ] Eliminate hardcoded `opening_smr: 0` that causes actual meter readings (e.g. 14,850h) to trigger a schema hard-block.
- [ ] **REQ-PRI-04:** Implement fractional shift tolerance and supervisor override in SMR validation.
  - [ ] Update `packages/contract/src/schemas/machine-ledger.schema.ts` to allow operational shift overrun up to 12.5h (e.g. crusher queues or refueling delays) with an optional `overrun_reason` note.
  - [ ] Prevent hard rejection of valid closeouts at 05:45 AM handover.
- [ ] **REQ-PRI-05:** Fix null `hours_worked` in `machine_operations`.
  - [ ] In [`MachineOperationsForm.tsx`](file:///home/tim/Fork/Arch-System/apps/portal/app/(departments)/[department]/machine-operations/MachineOperationsForm.tsx), add `start_smu` and `end_smu` inputs so the PostgreSQL generated column `hours_worked` computes accurately.

### 1.3 Offline Resilience & Queueing Integrity (Fail-Safe Data Flow)
- [ ] **REQ-PRI-06:** Overhaul offline mutation queueing in [`ShiftCloseoutForm.tsx`](file:///home/tim/Fork/Arch-System/apps/portal/app/(departments)/control-room/components/ShiftCloseoutForm.tsx#L78-L94).
  - [ ] Execute direct `fetch('/api/control-room/shift-closeout')` when `isOnline && !isDegraded`.
  - [ ] Route to `enqueue()` ONLY when the client is disconnected or network requests fail.
  - [ ] Ensure `enqueue` triggers immediate background synchronization when connectivity is restored.
  - [ ] Mount `initOfflineQueueListeners()` in root portal providers so cached mutations auto-flush on re-connect.
- [ ] **REQ-PRI-07:** Fix connectivity indicator logic in `ShiftCloseoutForm.tsx`.
  - [ ] Explicitly consume `isDegraded` ("High Latency / Jitter") vs `!isOnline` ("Disconnected / Offline").
  - [ ] Show high-visibility amber warning during link degradation, red when disconnected.

### 1.4 Safety Compliance, Persistence & Audit Trails
- [ ] **REQ-PRI-08:** Persist Shift Safety Checklist to PostgreSQL.
  - [ ] In [`ControlRoomChecklistWidget.tsx`](file:///home/tim/Fork/Arch-System/apps/portal/features/departments/components/control-room/ControlRoomChecklistWidget.tsx#L20-L36), replace ephemeral React `useState` with queries and mutations to `control_room_shift_reports.checklist_items`.
  - [ ] Ensure browser reload or station swap preserves checklist verification.
  - [ ] Wire "Proceed to Shift Closeout" button to navigate to handover with verified checklist IDs.
- [ ] **REQ-PRI-09:** Eliminate anonymous legal signatures.
  - [ ] Replace hardcoded `'Control Room Operator'` in `ShiftCloseoutForm.tsx` (line 48) with authenticated employee session data (`principal.employee.name`).
  - [ ] Require cryptographic/PIN supervisor signature in `UnifiedShiftCloseoutModal`.
- [ ] **REQ-PRI-10:** Enforce shift completeness gate prior to closeout.
  - [ ] Wire `/api/control-room/shift-closeout` to verify `getShiftCompleteness()`. Block closeout if active machines have zero telemetry or unacknowledged safety bulletins, unless a supervisor bypass note is attached.

---

## 2. Secondary Objectives (Ergonomics, UX Laws & Accessibility)

### 2.1 Navigation & Fitts's Law Ergonomics
- [ ] **REQ-SEC-01:** Replace 36px hover proximity auto-collapsing sidebar.
  - [ ] In [`DepartmentLayout.tsx`](file:///home/tim/Fork/Arch-System/packages/ui/src/components/DepartmentLayout.tsx#L128-L165), replace edge-proximity flyout with a persistent 64px compact icon rail that expands to 240px via a manual pin/collapse toggle button.
  - [ ] Persist pin state in `localStorage`.
  - [ ] Remove the invisible `w-12` overlay that blocks clicks on pinned table columns.
- [ ] **REQ-SEC-02:** Enlarge Hourly Loads stepper buttons to standard touch targets.
  - [ ] In [`HourlyLoadsGrid.tsx`](file:///home/tim/Fork/Arch-System/apps/portal/app/(departments)/[department]/hourly-loads/HourlyLoadsGrid.tsx#L817-L870), increase up/down chevron buttons from $10 \times 10\text{px}$ to at least $32 \times 32\text{px}$ clickable targets.
  - [ ] Support direct numeric keypad entry and keyboard Up/Down arrow increments.
- [ ] **REQ-SEC-03:** Safeguard Breakdown Action & expand touch target.
  - [ ] In [`EquipmentDashboard.tsx`](file:///home/tim/Fork/Arch-System/libs/features/departments/ui/src/control-room/EquipmentDashboard.tsx#L165-L173), expand "Report Breakdown" button to $44\text{px}$ height (`px-4 py-2 text-xs font-semibold`).
  - [ ] Wrap mutation in a confirmation modal (`AnimatedDialog`) to prevent accidental line-down dispatches.

### 2.2 Telemetry Prioritization & Sensory Ergonomics (ISO 11064 / ANSI/ISA-18.2)
- [ ] **REQ-SEC-04:** Elevate SCADA & Alarms to primary visual viewport.
  - [ ] In [`ControlRoomWidgets.tsx`](file:///home/tim/Fork/Arch-System/apps/portal/app/(departments)/[department]/ControlRoomWidgets.tsx#L50-L89), move `ScadaPanel` and `AlertPanel` directly beneath summary KPIs (above `EquipmentDashboard`).
- [ ] **REQ-SEC-05:** Connect live SCADA telemetry and remove cosmetic timers.
  - [ ] Wire [`ScadaPanel.tsx`](file:///home/tim/Fork/Arch-System/apps/portal/features/departments/components/control-room/ScadaPanel.tsx) to `/api/control-room/scada-status` and Redis telemetry (`telemetry:last:*`).
  - [ ] Replace fake green pulsing "Stream Active" badge with real circuit-breaker health state (Normal, Degraded, Tripped).
  - [ ] Implement manual refetch on the refresh icon button.
- [ ] **REQ-SEC-06:** Implement ISA-18.2 Alarm Acknowledgement workflow.
  - [ ] In [`AlertPanel.tsx`](file:///home/tim/Fork/Arch-System/apps/portal/features/departments/components/control-room/AlertPanel.tsx), style critical alarms with high-salience banners (`bg-red-600 text-white font-bold`).
  - [ ] Provide functional `[Acknowledge]` action capturing operator ID and timestamp.
  - [ ] Subscribe to Supabase Realtime channel (`pit_alerts` / `breakdowns`) for instant incident display.

### 2.3 Visual Consistency & 24/7 Dark Control Room Theming
- [ ] **REQ-SEC-07:** Purge hardcoded light-mode classes.
  - [ ] Replace `bg-white/70`, `bg-neutral-50/50`, `text-neutral-900`, `text-neutral-500` in:
    - [`FleetKpiTable.tsx`](file:///home/tim/Fork/Arch-System/libs/features/departments/ui/src/control-room/FleetKpiTable.tsx#L44)
    - [`ProductionSummaryCard.tsx`](file:///home/tim/Fork/Arch-System/libs/features/departments/ui/src/control-room/ProductionSummaryCard.tsx#L19)
    - [`TireAlertsBanner.tsx`](file:///home/tim/Fork/Arch-System/libs/features/departments/ui/src/control-room/TireAlertsBanner.tsx#L16)
    - [`MultiSiteShiftReportClient.tsx`](file:///home/tim/Fork/Arch-System/libs/features/departments/ui/src/control-room/MultiSiteShiftReportClient.tsx#L26)
  - [ ] Standardize on core CSS custom properties: `bg-[var(--vibrancy-surface)]`, `bg-[var(--surface-card)]`, `text-[var(--text-heading)]`, `text-[var(--text-secondary)]`.
- [ ] **REQ-SEC-08:** Support Dark Mode / Night Shift palette.
  - [ ] Provide dark theme tokens for low-glare NOC environments during 18:00–06:00 shifts.

### 2.4 WCAG 2.1 AA Accessibility & Performance
- [ ] **REQ-SEC-09:** Eliminate thread-blocking browser `alert()`.
  - [ ] Replace all 7 blocking `alert()` calls in `HourlyLoadsGrid.tsx` with non-blocking `toast.error()` / `toast.warning()`.
- [ ] **REQ-SEC-10:** Accessibility & Semantics Hardening.
  - [ ] Add ARIA table roles or semantic `<table>` elements to `FleetKpiTable.tsx`.
  - [ ] Add `aria-label` tags to all stepper buttons and dropdown selectors in `HourlyLoadsGrid.tsx`.
  - [ ] Enforce minimum `12px` typography across badges and data cells.

---

## 3. Critical Stage Reviews

### [ ] CRITICAL STAGE REVIEW 1: Routing & Closeout Integrity Gate
- [ ] Visiting `/control-room` serves the live operational dashboard with summary KPIs and widgets.
- [ ] Opening SMR queries previous shift's closing SMR; closeout submit is not blocked by 0-baseline.
- [ ] Offline queue direct-POST logic validated under normal and simulated offline conditions.
- [ ] All 7 native `alert()` calls removed and verified with test toast notifications.
- [ ] `pnpm type-check` and `pnpm lint` exit with code 0.

### [ ] CRITICAL STAGE REVIEW 2: Ergonomics & Navigation Gate
- [ ] Sidebar docked as 64px icon rail; expanding to 240px does not intercept table clicks.
- [ ] Hourly load stepper targets verified $\ge 32\text{px}$; keyboard arrow increments functioning.
- [ ] "Report Breakdown" button $\ge 44\text{px}$ with confirmation modal.
- [ ] Telemetry and alarms positioned at top of dashboard.
- [ ] SCADA panel connected to `/api/control-room/scada-status`.

### [ ] CRITICAL STAGE REVIEW 3: Compliance & Theming Gate
- [ ] Shift checklist persists toggles across page reloads in PostgreSQL.
- [ ] Alarm acknowledgement records operator timestamp.
- [ ] Hardcoded `bg-white/70` purged across all control-room components; dark NOC mode verified.
- [ ] Full automated verification passes via `pnpm agent:verify`.
