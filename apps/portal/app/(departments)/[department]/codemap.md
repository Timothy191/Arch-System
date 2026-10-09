# (departments)/[department]/

**Kind:** page · **Files:** 54 (+3 test)

## Responsibility

React Server Component page under the (departments)/[department] route.
Server Components fetch data directly (no client-side fetching), pass props down to client islands.

## Design

- Client components ("use client"): ControlRoomSummaryGridClient.tsx, NonControlRoomSummaryGridClient.tsx, ShiftCoverageSectionClient.tsx, DailyLogForm.tsx, EndSMRForm.tsx, EngineeringNotesForm.tsx, EngineeringNotesList.tsx, PredictiveAlertsWidget.tsx, error.tsx, ExcavatorActivityForm.tsx, ExcavatorActivityList.tsx, ExcavatorDumperTable.tsx, HourlyLoadsGrid.tsx, DelayEntriesForm.tsx, MachineOperationsComplianceWidget.tsx, MachineOperationsForm.tsx, MachineOperationsList.tsx, CopyReportButton.tsx, ShiftCompilationClient.tsx, ShiftCoverageClient.tsx
- Hooks referenced: useControlRoomSummary, useDashboardQueries, useNonControlRoomSummary, useShiftCoverage, useOfflineQueue, useRouter, useEffect, useMemo, useState, useForm, useUnsavedChangesWarning, useAutoSave
- Database tables touched: breakdowns, machines, daily_logs, production_logs, machine_operations, sites, operators, engineering_notes, breakdowns_control_room_view, excavator_activity, excavator_dumper_assignments, mine_blocks, hourly_loads, shift_status, operational_delays, delay_categories, delay_entries, employees, dozer_rolls, machine_hours, fuel_logs
- Exports:
  - `ControlRoomSummaryGridClient.tsx` → ControlRoomSummaryGridClient
  - `ControlRoomWidgets.tsx` → ControlRoomWidgets
  - `NonControlRoomSummaryGridClient.tsx` → NonControlRoomSummaryGridClient
  - `ShiftCoverageSectionClient.tsx` → ShiftCoverageSectionClient
  - `loading.tsx` → ShiftCompilationLoading, default
  - `page.tsx` → ToolsPage, default
  - `DailyLogForm.tsx` → DailyLogForm
  - `actions.ts` → getUnifiedShiftReport, getMultiSiteShiftReport, lockAndSignUnifiedShift
  - `EndSMRForm.tsx` → EndSMRForm
  - `EngineeringNotesForm.tsx` → EngineeringNotesForm
  - `PredictiveAlertsWidget.tsx` → PredictiveAlertsWidget
  - `error.tsx` → DepartmentError, default
  - `ExcavatorActivityForm.tsx` → ExcavatorActivityForm
  - `ExcavatorActivityList.tsx` → ExcavatorActivityList
  - `ExcavatorDumperTable.tsx` → ExcavatorDumperTable
  - `loads-utils.ts` → HOUR_PROP, loadKey, buildHourlyLoadsMap, buildHourlyLoadsGroupedMap, isHourEditable, sumHourlyTotal, HOURS_12
  - `layout.tsx` → generateMetadata, DepartmentRootLayout, default
  - `DelayEntriesForm.tsx` → DelayEntriesForm
  - `MachineOperationsComplianceWidget.tsx` → MachineOperationsComplianceWidget
  - `MachineOperationsForm.tsx` → MachineOperationsForm
  - `CopyReportButton.tsx` → CopyReportButton
  - `ShiftCompilationClient.tsx` → ShiftCompilationClient
  - `pdf-actions.ts` → exportSignedShiftReportPdf
  - `ShiftCoverageClient.tsx` → ShiftCoverageClient

## Flow

Route params/segments → server data fetch → RSC render → client island hydration.

- Local imports consumed: actions, DailyLogForm, EndSMRForm, EngineeringNotesForm, EngineeringNotesList, PredictiveAlertsWidget, ExcavatorDumperTable, ExcavatorActivityForm, ExcavatorActivityList, loads-utils, HourlyLoadsGrid, DelayEntriesForm, ControlRoomSummaryGridClient, NonControlRoomSummaryGridClient, CopyReportButton

## Integration

- Data layer: Supabase Postgres via `@repo/supabase` (RLS enforced; service role never reaches the client).
- Cross-check against `codebase-maps/latest/` for the current architectural snapshot.
