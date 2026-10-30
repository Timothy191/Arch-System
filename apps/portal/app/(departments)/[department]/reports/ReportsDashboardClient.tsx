'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ExportButton } from '@/features/analytics/components/ExportButton';
import { PDFDownloadButton } from '@/features/analytics/components/PDFDownloadButton';
import { saveMonthlyMachineSnapshotAction } from './actions';
import { CopyReportButton } from './CopyReportButton';
import { MachineMonthlySheetTab } from './MachineMonthlySheetTab';
import { MachineMonthlySummaryTab } from './MachineMonthlySummaryTab';
import {
  buildArchivedMonthSnapshot,
  computeFleetMonthlySummaryRows,
  deriveFallbackFleetMachinesFromLogs,
  loadStoredMachineMonthArchives,
  saveStoredMachineMonthArchives,
} from './machine-activity-helpers';
import {
  ReportsArchivedViewTab,
  ReportsDayViewTab,
  ReportsSubtabsToolbar,
} from './ReportsAnalyticsTabs';
import { ReportsKpiSummarySection } from './ReportsKpiSummarySection';
import { ReportsShiftViewTab } from './ReportsShiftViewTab';
import {
  buildPdfShiftReportPayload,
  computeArchivedReportData,
  computeDailyAggregatedRows,
  computeReportsKpiStats,
  computeShiftComparison,
  computeSiteBreakdown,
  extractUniqueSites,
  filterEngineeringLogItems,
  filterMachineOperationLogs,
  filterShiftReportRows,
} from './reports-analytics-helpers';
import type {
  ArchivedMachineMonthSnapshot,
  EngineeringLogItem,
  FleetMachineItem,
  FleetOperatorItem,
  MachineDailyOverviewRecord,
  MachineOperationLogItem,
  ReportSubtab,
  ReportsDashboardClientProps,
  ShiftCoverageMissingItem,
  ShiftReportRow,
} from './reports-types';
import { buildPdfSiteGroups, ShiftPdfReportTab } from './ShiftPdfReportTab';

export type {
  EngineeringLogItem,
  MachineOperationLogItem,
  ReportSubtab,
  ReportsDashboardClientProps,
  ShiftCoverageMissingItem,
  ShiftReportRow,
};

const EMPTY_QUERY_WARNINGS: string[] = [];
const EMPTY_FLEET_MACHINES: FleetMachineItem[] = [];
const EMPTY_FLEET_OPERATORS: FleetOperatorItem[] = [];
const EMPTY_MACHINE_DAILY_RECORDS: MachineDailyOverviewRecord[] = [];

export function ReportsDashboardClient({
  departmentId,
  departmentSlug,
  departmentName,
  initialTab = 'shift',
  todayStr,
  currentShift,
  fromDateStr,
  toDateStr,
  totalFleetCount,
  coveredFleetCount,
  missingCoverage,
  shiftRows,
  machineOperationLogs,
  engineeringLogs,
  csvContent,
  exportRows,
  pdfReportData,
  queryWarnings = EMPTY_QUERY_WARNINGS,
  fleetMachines = EMPTY_FLEET_MACHINES,
  fleetOperators = EMPTY_FLEET_OPERATORS,
  machineDailyRecords = EMPTY_MACHINE_DAILY_RECORDS,
}: ReportsDashboardClientProps) {
  const [activeTab, setActiveTab] = useState<ReportSubtab>(initialTab);
  const [shiftFilter, setShiftFilter] = useState<'all' | 'day' | 'night'>('all');
  const [siteFilter, setSiteFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showMissingMachines, setShowMissingMachines] = useState<boolean>(false);

  const currentMonthPrefix = todayStr.slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthPrefix);
  const [machineShiftType, setMachineShiftType] = useState<'day' | 'night'>(currentShift);

  const fallbackFleet = useMemo(
    () =>
      deriveFallbackFleetMachinesFromLogs({
        fleetMachines,
        machineOperationLogs,
      }),
    [fleetMachines, machineOperationLogs]
  );

  const effectiveMachines = fallbackFleet.machines;
  const [selectedMachineId, setSelectedMachineId] = useState<string>(
    () => effectiveMachines[0]?.id ?? ''
  );

  const [liveMachineRecords, setLiveMachineRecords] = useState<MachineDailyOverviewRecord[]>(() =>
    machineDailyRecords.length > 0 ? [...machineDailyRecords] : [...fallbackFleet.records]
  );

  const initialArchivedSnapshots = useMemo(() => {
    const distinctMonths = new Set<string>();
    const fromMonth = fromDateStr.slice(0, 7);
    if (/^\d{4}-\d{2}$/.test(fromMonth)) {
      distinctMonths.add(fromMonth);
    }
    distinctMonths.add(currentMonthPrefix);
    for (const rec of liveMachineRecords) {
      distinctMonths.add(rec.date.slice(0, 7));
    }

    return Array.from(distinctMonths)
      .sort((a, b) => b.localeCompare(a))
      .map((monthStr) =>
        buildArchivedMonthSnapshot({
          monthPrefix: monthStr,
          fleetMachines: effectiveMachines,
          shiftType: machineShiftType,
          records: liveMachineRecords,
          isSealed: monthStr < currentMonthPrefix,
        })
      );
  }, [fromDateStr, currentMonthPrefix, effectiveMachines, machineShiftType, liveMachineRecords]);

  const [archivedSnapshots, setArchivedSnapshots] =
    useState<ArchivedMachineMonthSnapshot[]>(initialArchivedSnapshots);
  const hasHydratedArchivesRef = useRef(false);

  useEffect(() => {
    if (hasHydratedArchivesRef.current) return;
    hasHydratedArchivesRef.current = true;
    setArchivedSnapshots(loadStoredMachineMonthArchives(initialArchivedSnapshots));
  }, [initialArchivedSnapshots]);

  const searchParams = useSearchParams?.() ?? null;
  const urlTabParam = searchParams?.get('tab');
  const lastSyncedUrlTabRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (lastSyncedUrlTabRef.current === urlTabParam) return;
    lastSyncedUrlTabRef.current = urlTabParam;
    if (
      urlTabParam === 'pdf-report' ||
      urlTabParam === 'day' ||
      urlTabParam === 'machine-30d' ||
      urlTabParam === 'monthly-summary' ||
      urlTabParam === 'archived' ||
      urlTabParam === 'shift'
    ) {
      setActiveTab(urlTabParam);
    } else if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [urlTabParam, initialTab]);

  const handleUpsertMachineRecord = (updatedRecord: MachineDailyOverviewRecord) => {
    setLiveMachineRecords((prev) => {
      const matchIdx = prev.findIndex(
        (rec) =>
          rec.machineId === updatedRecord.machineId &&
          rec.date === updatedRecord.date &&
          rec.shiftType === updatedRecord.shiftType
      );
      if (matchIdx === -1) {
        return [...prev, updatedRecord];
      }
      return prev.map((rec, idx) => (idx === matchIdx ? updatedRecord : rec));
    });
  };

  const isSelectedMonthSealed = useMemo(() => {
    const matchSnap = archivedSnapshots.find((snap) => snap.month === selectedMonth);
    return Boolean(matchSnap?.isSealed);
  }, [archivedSnapshots, selectedMonth]);

  const handleArchiveAndSealMonth = async () => {
    const sealedSnapshot = buildArchivedMonthSnapshot({
      monthPrefix: selectedMonth,
      fleetMachines: effectiveMachines,
      shiftType: machineShiftType,
      records: liveMachineRecords,
      isSealed: true,
    });
    const nextSnapshots = [
      sealedSnapshot,
      ...archivedSnapshots.filter((snap) => snap.month !== selectedMonth),
    ].sort((a, b) => b.month.localeCompare(a.month));
    setArchivedSnapshots(nextSnapshots);
    saveStoredMachineMonthArchives(nextSnapshots);

    // Synchronize to Supabase PostgreSQL cloud storage asynchronously
    try {
      await saveMonthlyMachineSnapshotAction({
        departmentId,
        month: selectedMonth,
        shiftType: machineShiftType,
        machineCount: sealedSnapshot.machineCount,
        totalSmrWorked: sealedSnapshot.totalSmrWorked,
        fleetAvailabilityPercent: sealedSnapshot.fleetAvailabilityPercent,
        fleetUtilizationPercent: sealedSnapshot.fleetUtilizationPercent,
        totalBreakdownHours: Number(
          sealedSnapshot.summaries.reduce((acc, r) => acc + (r.delays.breakdown ?? 0), 0).toFixed(1)
        ),
        isSealed: true,
        records: sealedSnapshot.records as unknown as Record<string, unknown>[],
        summaries: sealedSnapshot.summaries as unknown as Record<string, unknown>[],
      });
      toast.success(
        `Archived & sealed ${selectedMonth} (${sealedSnapshot.machineCount} machine 30-day tables) into Cloud Machine Activity Database.`
      );
    } catch {
      toast.success(
        `Archived & sealed ${selectedMonth} (${sealedSnapshot.machineCount} machine 30-day tables) into Local Machine Activity Database.`
      );
    }
  };

  const monthlySummaryRows = useMemo(
    () =>
      computeFleetMonthlySummaryRows({
        fleetMachines: effectiveMachines,
        monthPrefix: selectedMonth,
        shiftType: machineShiftType,
        records: liveMachineRecords,
      }),
    [effectiveMachines, selectedMonth, machineShiftType, liveMachineRecords]
  );

  const handleSelectTab = (nextTab: ReportSubtab) => {
    setActiveTab(nextTab);
    if (typeof window !== 'undefined' && window.history?.replaceState) {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', nextTab);
      window.history.replaceState(null, '', `${url.pathname}${url.search}`);
    }
  };

  const allSites = useMemo(
    () => extractUniqueSites(shiftRows, machineOperationLogs),
    [shiftRows, machineOperationLogs]
  );

  const kpiStats = useMemo(
    () =>
      computeReportsKpiStats(
        shiftRows,
        todayStr,
        engineeringLogs,
        totalFleetCount,
        coveredFleetCount
      ),
    [shiftRows, todayStr, engineeringLogs, totalFleetCount, coveredFleetCount]
  );

  const filteredShiftRows = useMemo(
    () => filterShiftReportRows(shiftRows, shiftFilter, siteFilter, searchQuery),
    [shiftRows, shiftFilter, siteFilter, searchQuery]
  );

  const filteredMachineOps = useMemo(
    () => filterMachineOperationLogs(machineOperationLogs, shiftFilter, siteFilter, searchQuery),
    [machineOperationLogs, shiftFilter, siteFilter, searchQuery]
  );

  const filteredEngineeringLogs = useMemo(
    () => filterEngineeringLogItems(engineeringLogs, shiftFilter, searchQuery),
    [engineeringLogs, shiftFilter, searchQuery]
  );

  const shiftComparison = useMemo(
    () => computeShiftComparison(filteredShiftRows),
    [filteredShiftRows]
  );

  const siteBreakdown = useMemo(() => computeSiteBreakdown(filteredShiftRows), [filteredShiftRows]);

  const dailyAggregatedRows = useMemo(
    () => computeDailyAggregatedRows(shiftRows, siteFilter),
    [shiftRows, siteFilter]
  );

  const archivedData = useMemo(
    () => computeArchivedReportData(shiftRows, shiftFilter, siteFilter, searchQuery, todayStr),
    [shiftRows, shiftFilter, siteFilter, searchQuery, todayStr]
  );

  const pdfSiteGroups = useMemo(() => buildPdfSiteGroups(filteredMachineOps), [filteredMachineOps]);

  const pdfShiftReportData = useMemo(
    () =>
      buildPdfShiftReportPayload({
        pdfSiteGroups,
        pdfReportData,
        departmentName,
        todayStr,
        fromDateStr,
        toDateStr,
        shiftFilter,
      }),
    [pdfSiteGroups, pdfReportData, departmentName, todayStr, fromDateStr, toDateStr, shiftFilter]
  );

  return (
    <div className="space-y-6">
      <ReportsKpiSummarySection
        departmentName={departmentName}
        currentShift={currentShift}
        todayStr={todayStr}
        queryWarnings={queryWarnings}
        kpiStats={kpiStats}
        coveredFleetCount={coveredFleetCount}
        totalFleetCount={totalFleetCount}
        missingCoverage={missingCoverage}
        showMissingMachines={showMissingMachines}
        onToggleMissingMachines={() => setShowMissingMachines((v) => !v)}
        onCloseMissingMachines={() => setShowMissingMachines(false)}
      />

      <ReportsSubtabsToolbar
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        filteredShiftRowsCount={filteredShiftRows.length}
        dailyAggregatedRowsCount={dailyAggregatedRows.length}
        monthlyRollupsCount={archivedData.monthlyRollups.length}
        historicalRowsCount={archivedData.historicalRows.length}
        pdfSiteGroupsCount={pdfSiteGroups.length}
        fleetMachinesCount={effectiveMachines.length}
        shiftFilter={shiftFilter}
        onShiftFilterChange={setShiftFilter}
        allSites={allSites}
        siteFilter={siteFilter}
        onSiteFilterChange={setSiteFilter}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
      />

      {activeTab === 'shift' && (
        <ReportsShiftViewTab
          shiftComparison={shiftComparison}
          siteBreakdown={siteBreakdown}
          filteredShiftRows={filteredShiftRows}
          filteredMachineOps={filteredMachineOps}
          filteredEngineeringLogs={filteredEngineeringLogs}
        />
      )}

      {activeTab === 'day' && (
        <ReportsDayViewTab dailyAggregatedRows={dailyAggregatedRows} todayStr={todayStr} />
      )}

      {activeTab === 'machine-30d' && (
        <MachineMonthlySheetTab
          departmentId={departmentId}
          fleetMachines={effectiveMachines}
          fleetOperators={fleetOperators}
          selectedMachineId={selectedMachineId}
          onSelectMachineId={setSelectedMachineId}
          selectedMonth={selectedMonth}
          onSelectMonth={setSelectedMonth}
          shiftType={machineShiftType}
          onShiftTypeChange={setMachineShiftType}
          records={liveMachineRecords}
          onUpsertRecord={handleUpsertMachineRecord}
          isMonthSealed={isSelectedMonthSealed}
          onArchiveAndSealMonth={handleArchiveAndSealMonth}
          onOpenMonthlySummary={() => handleSelectTab('monthly-summary')}
          engineeringLogs={engineeringLogs}
        />
      )}

      {activeTab === 'monthly-summary' && (
        <MachineMonthlySummaryTab
          selectedMonth={selectedMonth}
          onSelectMonth={setSelectedMonth}
          shiftType={machineShiftType}
          onShiftTypeChange={setMachineShiftType}
          summaryRows={monthlySummaryRows}
          archivedSnapshots={archivedSnapshots}
          isMonthSealed={isSelectedMonthSealed}
          onArchiveAndSealMonth={handleArchiveAndSealMonth}
          onInspectMachine30Day={(machineId) => {
            setSelectedMachineId(machineId);
            handleSelectTab('machine-30d');
          }}
          engineeringLogs={engineeringLogs}
        />
      )}

      {activeTab === 'archived' && (
        <ReportsArchivedViewTab
          archivedData={archivedData}
          fromDateStr={fromDateStr}
          toDateStr={toDateStr}
          currentMonthPrefix={currentMonthPrefix}
          archivedMachineSnapshots={archivedSnapshots}
          onOpenArchivedMonth30Day={(monthStr) => {
            setSelectedMonth(monthStr);
            handleSelectTab('machine-30d');
          }}
          onOpenArchivedMonthSummary={(monthStr) => {
            setSelectedMonth(monthStr);
            handleSelectTab('monthly-summary');
          }}
        />
      )}

      {activeTab === 'pdf-report' && (
        <ShiftPdfReportTab
          departmentId={departmentId}
          departmentName={departmentName}
          todayStr={todayStr}
          currentShift={currentShift}
          fromDateStr={fromDateStr}
          toDateStr={toDateStr}
          shiftFilter={shiftFilter}
          pdfSiteGroups={pdfSiteGroups}
          pdfShiftReportData={pdfShiftReportData}
        />
      )}

      <div className="no-print flex flex-wrap items-center justify-end gap-2 pt-4">
        <CopyReportButton csvContent={csvContent} />
        <PDFDownloadButton reportData={pdfShiftReportData} departmentId={departmentId} />
        <ExportButton
          filename={`${departmentSlug}-report-${fromDateStr}-to-${toDateStr}`}
          rows={exportRows}
        />
      </div>
    </div>
  );
}
