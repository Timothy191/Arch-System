# EARS Specification: Control Room Operational Workflow & Telemetry Enhancements

## 1. Objective

Harden and unify the 24/7 mining Control Room operational workflows, navigation tabs, real-time SCADA connection status telemetry, pre-closeout shift completeness readiness gating, inline machine quick-actions, and shared opening SMR resolution.

## 2. Scope

1. **Navigation & Route Unification**:
   - Synchronize `CONTROL_ROOM_TABS` (`libs/features/departments/data-access/src/departments.ts`) with `ControlRoomQuickNav` (`apps/portal/app/(departments)/control-room/components/ControlRoomQuickNav.tsx`) so `shift-compilation` ("Shift Operations") and `shift-closeout` ("Shift Closeout") are accessible directly in the primary Control Room header tab bar.
   - Unify the closeout tab in `apps/portal/app/(departments)/[department]/shift-compilation/ShiftCompilationClient.tsx` with `apps/portal/app/(departments)/control-room/shift-closeout/page.tsx` by rendering `ControlRoomChecklistWidget` alongside `SupervisorApprovalPanel` and `ShiftCloseoutForm`, and syncing the active section (`handover` | `coverage` | `closeout`) with URL query parameters.
2. **Live SCADA & Telemetry Connection Status Strip (`ScadaPanel.tsx`)**:
   - Connect `ScadaPanel` (`apps/portal/features/departments/components/control-room/ScadaPanel.tsx`) to `/api/control-room/scada-status` to display real-time SCADA/Redis connection state (`healthy` / `degraded` / `offline`), cached telemetry tag count (`cached_tag_count`), and probe latency (`latencyMs`).
3. **Inline Machine & Excavator Quick-Actions in `ScadaPanel`**:
   - Add direct contextual quick-action links on each Excavator row (`Update Dig` -> `/control-room/excavator-activity?machineId=<id>`) and each Registered Machine row (`+ Loads` -> `/control-room/hourly-loads?machineId=<id>`, `+ Delay` -> `/control-room/engineering-notes?machineId=<id>`) in `ScadaPanel.tsx`.
4. **Pre-Closeout Shift Completeness Readiness Gate (`ShiftCloseoutForm.tsx`)**:
   - Add a live pre-closeout readiness summary banner in `ShiftCloseoutForm.tsx` showing reconciled vs. pending fleet units (`closing_smr - opening_smr + breakdown_hours + delay_hours === 12.0h` or valid overrun), plus one-click machine focus badges for any un-reconciled units and live `/api/control-room/shift-completeness` integration.
5. **Shared Opening SMR Snapshot Helper & Backend Fixes**:
   - Extract `getFleetOpeningSmrSnapshot()` in `apps/portal/lib/control-room-fleet-smr.ts` to eliminate the 3x duplicated 45-line SMR resolution logic across `shift-closeout/page.tsx`, `shift-compilation/page.tsx`, and `end-smr/page.tsx`.
   - Fix UTC vs. SAST timezone bug in `apps/portal/app/(departments)/[department]/shift-coverage/page.tsx` by using `getCurrentShift()` from `@repo/utils`.
   - Fix `department_id` resolution in `apps/portal/lib/actions/shift-closeout.ts` so it resolves the supervisor's or control-room's `department_id` instead of passing `supervisorId` directly when available.

## 3. EARS Acceptance Criteria

- **WHEN** an operator views the Control Room header navigation (`CONTROL_ROOM_TABS`), **THE SYSTEM SHALL** display `Dashboard`, `Shift Operations`, `Excavator Activity`, `Hourly Loads`, `Machine Operations`, `Delays`, `Reports`, and `Shift Closeout`.
- **WHEN** an operator opens `/control-room/shift-compilation?tab=closeout`, **THE SYSTEM SHALL** render `SupervisorApprovalPanel` (for supervisors/admins), `ShiftCloseoutForm`, and `ControlRoomChecklistWidget` with full parity to `/control-room/shift-closeout`.
- **WHEN** `ScadaPanel` renders on `/control-room`, **THE SYSTEM SHALL** display live SCADA status metrics (`state`, `cached_tag_count`, `latencyMs`) from `/api/control-room/scada-status` and provide inline row quick-action links (`Update Dig`, `+ Loads`, `+ Delay`).
- **WHEN** an operator opens `ShiftCloseoutForm`, **THE SYSTEM SHALL** display a live Shift Completeness & SMR Readiness banner showing reconciled machine count (`X / Y Reconciled`), progress percentage, and quick-jump pills for any un-reconciled machines.
- **WHEN** `shift-closeout/page.tsx`, `shift-compilation/page.tsx`, or `end-smr/page.tsx` resolves opening SMRs, **THE SYSTEM SHALL** use the shared `getFleetOpeningSmrSnapshot()` helper.
- **WHEN** `shift-coverage/page.tsx` determines the active shift on the server, **THE SYSTEM SHALL** use `getCurrentShift()` (`Africa/Johannesburg` SAST).

## 4. Constraints & Invariants

- Preserve light-mode-only semantic tokens and `@repo/ui/GlassCard` styling.
- Maintain all existing `data-testid` attributes and OpenTelemetry spans (`scada_machine_fetch`, `scada_realtime_subscription`).
- Enforce zero TypeScript `any`, Biome formatting/lint rules, and 100% pass rate across `pnpm test:dept:control-room` and `pnpm agent:verify` (27/27 gates).

## 5. Rollback Procedure

- Revert the feature branch commit (`git revert <sha>`) if any of the 27 verification gates fail.
