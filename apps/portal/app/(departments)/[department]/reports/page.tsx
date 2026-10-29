import '@/styles/print-report.css';
import { PlantInventoryWorkspaceClient } from '~/features/departments/components/plant-inventory/PlantInventoryWorkspaceClient';
import { getPlantProcessingWorkspaceData } from '~/features/departments/components/plant-processing/actions';
import { PlantHistoryDatabaseClient } from '~/features/departments/components/plant-processing/PlantHistoryDatabaseClient';
import { getDepartmentContext } from '~/lib/dept-context';
import { mapOperationsToMachineDailyRecords } from './machine-activity-helpers';
import { ReportsDashboardClient } from './ReportsDashboardClient';
import {
  buildEngineeringAndExportPayloads,
  buildShiftAndMachineReports,
} from './reports-server-helpers';
import { fetchDepartmentReportsRawData } from './reports-server-queries';
import type { FleetMachineItem, FleetOperatorItem, ReportSubtab } from './reports-types';

export default async function ReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ department: string }>;
  searchParams: Promise<{ from?: string; to?: string; tab?: string }>;
}) {
  const { department: deptSlug } = await params;
  if (deptSlug === 'plant-processing') {
    const { today } = await getDepartmentContext({ department: deptSlug });
    const plantData = await getPlantProcessingWorkspaceData(today);
    return (
      <PlantHistoryDatabaseClient
        initialDate={plantData.currentDate}
        initialSheets={plantData.initialSheets}
        initialDelays={plantData.initialDelays}
      />
    );
  }
  const { from: fromParam, to: toParam, tab: tabParam } = await searchParams;
  if (deptSlug === 'plant-inventory') {
    const { today } = await getDepartmentContext({ department: deptSlug });
    return <PlantInventoryWorkspaceClient mode="reports" today={today} />;
  }
  const initialTab: ReportSubtab =
    tabParam === 'pdf-report' ||
    tabParam === 'day' ||
    tabParam === 'machine-30d' ||
    tabParam === 'monthly-summary' ||
    tabParam === 'archived'
      ? tabParam
      : 'shift';
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
    rawMachines,
    rawOperators,
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

  const latestSmrByMachine = new Map<string, number>();
  for (const op of operations) {
    if (!op.machine_id || op.end_smu == null) continue;
    const prevSmr = latestSmrByMachine.get(op.machine_id) ?? 0;
    const endSmr = Number(op.end_smu);
    if (Number.isFinite(endSmr) && endSmr > prevSmr) {
      latestSmrByMachine.set(op.machine_id, endSmr);
    }
  }

  const fleetMachines: FleetMachineItem[] = rawMachines
    .filter((mach) => mach.active !== false)
    .map((mach) => {
      const siteRel = Array.isArray(mach.sites) ? mach.sites[0] : mach.sites;
      return {
        id: mach.id,
        name: mach.name,
        machineType: mach.machine_type || 'Equipment',
        serialNumber: mach.serial_number ?? null,
        siteId: mach.site_id ?? null,
        siteName: siteRel?.name || 'General Pit',
        baselineSmr: latestSmrByMachine.get(mach.id) ?? 1200,
      };
    });

  const fleetOperators: FleetOperatorItem[] = rawOperators
    .filter((op) => op.active !== false)
    .map((op) => ({
      id: op.id,
      fullName: op.full_name,
      employeeCode: op.employee_code || '',
    }));

  const machineDailyRecords = mapOperationsToMachineDailyRecords({
    operations,
    fleetMachines,
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
      fleetMachines={fleetMachines}
      fleetOperators={fleetOperators}
      machineDailyRecords={machineDailyRecords}
    />
  );
}
