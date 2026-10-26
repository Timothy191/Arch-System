'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ExportButton } from '@/features/analytics/components/ExportButton';
import { PDFDownloadButton } from '@/features/analytics/components/PDFDownloadButton';
import { CopyReportButton } from './CopyReportButton';
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
  EngineeringLogItem,
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
  queryWarnings = [],
}: ReportsDashboardClientProps) {
  const [activeTab, setActiveTab] = useState<ReportSubtab>(initialTab);
  const [shiftFilter, setShiftFilter] = useState<'all' | 'day' | 'night'>('all');
  const [siteFilter, setSiteFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showMissingMachines, setShowMissingMachines] = useState<boolean>(false);

  const currentMonthPrefix = todayStr.slice(0, 7);

  const searchParams = useSearchParams?.() ?? null;
  const urlTabParam = searchParams?.get('tab');
  const lastSyncedUrlTabRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (lastSyncedUrlTabRef.current === urlTabParam) return;
    lastSyncedUrlTabRef.current = urlTabParam;
    if (
      urlTabParam === 'pdf-report' ||
      urlTabParam === 'day' ||
      urlTabParam === 'archived' ||
      urlTabParam === 'shift'
    ) {
      setActiveTab(urlTabParam);
    } else if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [urlTabParam, initialTab]);

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

      {activeTab === 'archived' && (
        <ReportsArchivedViewTab
          archivedData={archivedData}
          fromDateStr={fromDateStr}
          toDateStr={toDateStr}
          currentMonthPrefix={currentMonthPrefix}
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
