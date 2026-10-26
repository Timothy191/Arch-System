import '@/styles/print-report.css';
import { redirect } from 'next/navigation';
import { PlantInventoryWorkspaceClient } from '~/features/departments/components/plant-inventory/PlantInventoryWorkspaceClient';
import { getDepartmentContext } from '~/lib/dept-context';
import { ReportsDashboardClient } from './ReportsDashboardClient';
import {
  buildEngineeringAndExportPayloads,
  buildShiftAndMachineReports,
} from './reports-server-helpers';
import { fetchDepartmentReportsRawData } from './reports-server-queries';

export default async function ReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ department: string }>;
  searchParams: Promise<{ from?: string; to?: string; tab?: string }>;
}) {
  const { department: deptSlug } = await params;
  if (deptSlug === 'plant-processing') {
    redirect('/plant-processing/history');
  }
  const { from: fromParam, to: toParam, tab: tabParam } = await searchParams;
  if (deptSlug === 'plant-inventory') {
    const { today } = await getDepartmentContext({ department: deptSlug });
    return <PlantInventoryWorkspaceClient mode="reports" today={today} />;
  }
  const initialTab: 'shift' | 'day' | 'archived' | 'pdf-report' =
    tabParam === 'pdf-report' || tabParam === 'day' || tabParam === 'archived' ? tabParam : 'shift';
  const { dept, deptId, supabase, today } = await getDepartmentContext({
    department: deptSlug,
  });

  const todayStr = today || new Date().toISOString().split('T')[0]!;
  const toDateStr = toParam || todayStr;
  const fromDateStr =
    fromParam || new Date(Date.now() - 60 * 86400000).toISOString().split('T')[0]!;

  const currentHour = new Date().getHours();
  const currentShift: 'day' | 'night' = currentHour >= 6 && currentHour < 18 ? 'day' : 'night';
  const isControlRoom = dept.type === 'control_room';

  const {
    operations,
    loads,
    delays,
    excavatorAssignments,
    dozerRolls,
    breakdowns,
    engNotes,
    dailyLogs,
    completeness,
    queryWarnings,
    machineHoursByLog,
    fuelLogsByLog,
    productionByLog,
  } = await fetchDepartmentReportsRawData({
    supabase,
    deptId,
    deptSlug,
    fromDateStr,
    toDateStr,
    todayStr,
    currentShift,
  });

  const { shiftRows, machineOperationLogs } = buildShiftAndMachineReports({
    operations,
    loads,
    delays,
    excavatorAssignments,
    dozerRolls,
    breakdowns,
    dailyLogs,
    isControlRoom,
    deptId,
    machineHoursByLog,
    fuelLogsByLog,
    productionByLog,
  });

  const {
    engineeringLogs,
    totalFleetCount,
    coveredFleetCount,
    missingCoverage,
    csvContent,
    exportRows,
    pdfReportData,
  } = buildEngineeringAndExportPayloads({
    breakdowns,
    engNotes,
    completeness,
    shiftRows,
    departmentDisplayName: dept.displayName,
    todayStr,
    fromDateStr,
    toDateStr,
  });

  return (
    <ReportsDashboardClient
      departmentId={deptId}
      departmentSlug={deptSlug}
      departmentName={dept.displayName}
      isControlRoom={isControlRoom}
      initialTab={initialTab}
      todayStr={todayStr}
      currentShift={currentShift}
      fromDateStr={fromDateStr}
      toDateStr={toDateStr}
      totalFleetCount={totalFleetCount}
      coveredFleetCount={coveredFleetCount}
      missingCoverage={missingCoverage}
      shiftRows={shiftRows}
      machineOperationLogs={machineOperationLogs}
      engineeringLogs={engineeringLogs}
      csvContent={csvContent}
      exportRows={exportRows}
      pdfReportData={pdfReportData}
      queryWarnings={queryWarnings}
    />
  );
}
