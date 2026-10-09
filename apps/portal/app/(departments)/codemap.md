# (departments)/

**Kind:** page · **Files:** 118 (+6 test)

## Responsibility

React Server Component page under the (departments) route.
Server Components fetch data directly (no client-side fetching), pass props down to client islands.

## Design

- Client components ("use client"): ControlRoomSummaryGridClient.tsx, NonControlRoomSummaryGridClient.tsx, ShiftCoverageSectionClient.tsx, DailyLogForm.tsx, EndSMRForm.tsx, EngineeringNotesForm.tsx, EngineeringNotesList.tsx, PredictiveAlertsWidget.tsx, error.tsx, ExcavatorActivityForm.tsx, ExcavatorActivityList.tsx, ExcavatorDumperTable.tsx, HourlyLoadsGrid.tsx, DelayEntriesForm.tsx, MachineOperationsComplianceWidget.tsx, MachineOperationsForm.tsx, MachineOperationsList.tsx, CopyReportButton.tsx, ShiftCompilationClient.tsx, ShiftCoverageClient.tsx, card-actions-view.tsx, qr-section.tsx, DashboardChartsRow.tsx, HeadcountMusterBanner.tsx, HourlyAccessChart.tsx, PerimeterGateHUD.tsx, QRStatusDistributionChart.tsx, QuickActionHub.tsx, error.tsx, muster-roll-call-view.tsx, neo300-print-studio.tsx, qr-management-studio.tsx, access-reports-studio.tsx, visitor-form.tsx, ShiftCloseoutForm.tsx, DrillingOperationsTable.tsx, error.tsx, RealtimeDrillTelemetryStream.tsx, error.tsx
- Hooks referenced: useControlRoomSummary, useDashboardQueries, useNonControlRoomSummary, useShiftCoverage, useOfflineQueue, useRouter, useEffect, useMemo, useState, useForm, useUnsavedChangesWarning, useAutoSave
- Database tables touched: breakdowns, machines, daily_logs, production_logs, machine_operations, sites, operators, engineering_notes, breakdowns_control_room_view, excavator_activity, excavator_dumper_assignments, mine_blocks, hourly_loads, shift_status, operational_delays, delay_categories, delay_entries, employees, dozer_rolls, machine_hours, fuel_logs, badges, visitors, access_logs, personnel, issued_cards, card_printers, print_jobs, card_templates, fleet, equipment, drill_operations, departments, machine_telemetry_archive, tire_inspections, tires
- Exports:
  - `ControlRoomSummaryGridClient.tsx` → ControlRoomSummaryGridClient
  - `ControlRoomWidgets.tsx` → ControlRoomWidgets
  - `NonControlRoomSummaryGridClient.tsx` → NonControlRoomSummaryGridClient
  - `ShiftCoverageSectionClient.tsx` → ShiftCoverageSectionClient
  - `loading.tsx` → DepartmentLoading, default
  - `page.tsx` → TireManagementPage, default
  - `DailyLogForm.tsx` → DailyLogForm
  - `actions.ts` → upsertDrillOperationAction
  - `EndSMRForm.tsx` → EndSMRForm
  - `EngineeringNotesForm.tsx` → EngineeringNotesForm
  - `PredictiveAlertsWidget.tsx` → PredictiveAlertsWidget
  - `error.tsx` → EngineeringError, default
  - `ExcavatorActivityForm.tsx` → ExcavatorActivityForm
  - `ExcavatorActivityList.tsx` → ExcavatorActivityList
  - `ExcavatorDumperTable.tsx` → ExcavatorDumperTable
  - `loads-utils.ts` → HOUR_PROP, loadKey, buildHourlyLoadsMap, buildHourlyLoadsGroupedMap, isHourEditable, sumHourlyTotal, HOURS_12
  - `layout.tsx` → EngineeringLayout, default
  - `DelayEntriesForm.tsx` → DelayEntriesForm
  - `MachineOperationsComplianceWidget.tsx` → MachineOperationsComplianceWidget
  - `MachineOperationsForm.tsx` → MachineOperationsForm
  - `CopyReportButton.tsx` → CopyReportButton
  - `ShiftCompilationClient.tsx` → ShiftCompilationClient
  - `pdf-actions.ts` → exportSignedShiftReportPdf
  - `ShiftCoverageClient.tsx` → ShiftCoverageClient
  - `badges.ts` → getBadgesForDepartment, getVisitorsForDepartment, registerVisitor, getAccessLogsForDepartment
  - `gates.ts` → getLivePerimeterGates, triggerGatePulse, logGateDenial
  - `muster.ts` → getMusterRollCall, markPersonnelMusterStatus
  - `queries.ts` → getAccessControlMetrics, getRecentAccessActivity, getEntityBadgeStatus, getHourlyAccessStats, getBadgeStatusDistribution
  - `reports.ts` → getAccessReportsData
  - `shared.ts` → assertAccessControlRole
  - `card-actions-view.tsx` → CardActionsView
  - `card-pdf.tsx` → CardDocument
  - `qr-section.tsx` → QRCodeSection
  - `DashboardActivityFeed.tsx` → DashboardActivityFeed, default
  - `DashboardChartsRow.tsx` → DashboardChartsRow, default
  - `DashboardEntityStatus.tsx` → DashboardEntityStatus, default
  - `DashboardKPIGrid.tsx` → DashboardKPIGrid, default
  - `HeadcountMusterBanner.tsx` → HeadcountMusterBanner
  - `HourlyAccessChart.tsx` → HourlyAccessChart, default
  - `PerimeterGateHUD.tsx` → PerimeterGateHUD
  - `QRStatusDistributionChart.tsx` → QRStatusDistributionChart, default
  - `QuickActionHub.tsx` → QuickActionHub
  - `printer-detection.ts` → scanCupsPrinters, getPrinterQueue, getPrinterStatus, scanUsbDevices, submitCupsPrintJob, detectAllPrinters
  - `muster-roll-call-view.tsx` → MusterRollCallView
  - `neo300-print-studio.tsx` → Neo300PrintStudio
  - `printing.ts` → submitPrintJob
  - `qr-management-studio.tsx` → QrManagementStudio
  - `access-reports-studio.tsx` → AccessReportsStudio
  - `visitor-form.tsx` → VisitorForm
  - `ShiftCloseoutForm.tsx` → ShiftCloseoutForm
  - `DrillingOperationsTable.tsx` → DrillingOperationsTable
  - `RealtimeDrillTelemetryStream.tsx` → RealtimeDrillTelemetryStream

## Flow

Route params/segments → server data fetch → RSC render → client island hydration.

- Local imports consumed: actions, DailyLogForm, EndSMRForm, EngineeringNotesForm, EngineeringNotesList, PredictiveAlertsWidget, ExcavatorDumperTable, ExcavatorActivityForm, ExcavatorActivityList, loads-utils, HourlyLoadsGrid, DelayEntriesForm, ControlRoomSummaryGridClient, NonControlRoomSummaryGridClient, CopyReportButton

## Integration

- Data layer: Supabase Postgres via `@repo/supabase` (RLS enforced; service role never reaches the client).
- Cross-check against `codebase-maps/latest/` for the current architectural snapshot.
