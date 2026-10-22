'use client';

import { GlassCard } from '@repo/ui/GlassCard';
import { Input } from '@repo/ui/Input';
import {
  Activity,
  AlertTriangle,
  Archive,
  BarChart3,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  Layers,
  Moon,
  Radio,
  Search,
  Sun,
  Truck,
  Wrench,
} from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ExportButton } from '@/features/analytics/components/ExportButton';
import { PDFDownloadButton } from '@/features/analytics/components/PDFDownloadButton';
import { CopyReportButton } from './CopyReportButton';
import { buildPdfSiteGroups, ShiftPdfReportTab } from './ShiftPdfReportTab';
export interface ShiftReportRow {
  id: string;
  site: string;
  date: string;
  shift: 'day' | 'night';
  hours: number;
  loads: number;
  haulBcm: number;
  dozerRolloverBcm: number;
  totalBcm: number;
  delayMin: number;
  dozerPasses: number;
  fuelLitres: number;
  coalTonnes: number;
  wasteTonnes: number;
  notes: string;
}

export interface MachineOperationLogItem {
  id: string;
  date: string;
  shift: 'day' | 'night';
  machineName: string;
  machineType: string;
  operatorName: string;
  siteName: string;
  startSmu: number | null;
  endSmu: number | null;
  hoursWorked: number;
  bcmMoved: number;
  isDozer: boolean;
  delayMinutes: number;
  productionDelayMinutes?: number;
  engineeringDelayMinutes?: number;
  naturalDelayMinutes?: number;
  nonSiteDelayMinutes?: number;
  excavatorActivity?: string;
  siteGroupRole?: 'excavator' | 'rollover' | 'site_machine';
  loadsCount?: number;
  bladePasses?: number;
  status: 'completed' | 'active';
}

export interface EngineeringLogItem {
  id: string;
  date: string;
  shift: 'day' | 'night';
  source: 'breakdown' | 'engineering_note' | 'daily_log';
  machineName: string;
  category: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'resolved';
  description: string;
  actionTaken: string;
}

export interface ShiftCoverageMissingItem {
  machineId: string;
  machineName: string;
  machineType: string;
  formPath: string;
  formLabel: string;
}

export interface ReportsDashboardClientProps {
  departmentId: string;
  departmentSlug: string;
  departmentName: string;
  isControlRoom: boolean;
  initialTab?: ReportSubtab;
  todayStr: string;
  currentShift: 'day' | 'night';
  fromDateStr: string;
  toDateStr: string;
  totalFleetCount: number;
  coveredFleetCount: number;
  missingCoverage: ShiftCoverageMissingItem[];
  shiftRows: ShiftReportRow[];
  machineOperationLogs: MachineOperationLogItem[];
  engineeringLogs: EngineeringLogItem[];
  csvContent: string;
  exportRows: Record<string, string | number>[];
  pdfReportData: {
    title: string;
    subtitle: string;
    kpis: Array<{ label: string; value: string }>;
    tableHeaders: string[];
    tableRows: string[][];
  };
  queryWarnings?: string[];
}

export type ReportSubtab = 'shift' | 'day' | 'archived' | 'pdf-report';

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
  // Extract unique sites
  const allSites = useMemo(() => {
    const set = new Set<string>();
    for (const r of shiftRows) {
      if (r.site && r.site !== '—') set.add(r.site);
    }
    for (const m of machineOperationLogs) {
      if (m.siteName && m.siteName !== '—') set.add(m.siteName);
    }
    return Array.from(set).sort();
  }, [shiftRows, machineOperationLogs]);

  // Live / Period KPI Totals
  // Performance Optimization: Replaced 10 array iterations (7 reduces, 1 filter, 2 reduces) over shiftRows
  // and 2 filter iterations over engineeringLogs with single-pass accumulators.
  const kpiStats = useMemo(() => {
    let totalHours = 0;
    let totalLoads = 0;
    let totalHaulBcm = 0;
    let totalDozerBcm = 0;
    let totalBcm = 0;
    let totalDelayMin = 0;
    let totalPasses = 0;
    let todayBcm = 0;
    let todayLoads = 0;
    let todayHours = 0;

    for (const r of shiftRows) {
      totalHours += r.hours;
      totalLoads += r.loads;
      totalHaulBcm += r.haulBcm;
      totalDozerBcm += r.dozerRolloverBcm;
      totalBcm += r.totalBcm;
      totalDelayMin += r.delayMin;
      totalPasses += r.dozerPasses;

      if (r.date === todayStr) {
        todayBcm += r.totalBcm;
        todayLoads += r.loads;
        todayHours += r.hours;
      }
    }

    let openIssues = 0;
    let resolvedIssues = 0;
    for (const e of engineeringLogs) {
      if (e.status === 'open') openIssues++;
      else if (e.status === 'resolved') resolvedIssues++;
    }

    const coveragePct =
      totalFleetCount > 0 ? Math.round((coveredFleetCount / totalFleetCount) * 100) : 100;
    const bcmPerHour = totalHours > 0 ? totalBcm / totalHours : 0;

    return {
      totalHours,
      totalLoads,
      totalHaulBcm,
      totalDozerBcm,
      totalBcm,
      totalDelayMin,
      totalPasses,
      todayBcm,
      todayLoads,
      todayHours,
      openIssues,
      resolvedIssues,
      coveragePct,
      bcmPerHour,
    };
  }, [shiftRows, todayStr, engineeringLogs, totalFleetCount, coveredFleetCount]);

  // Filtered rows for Shift subtab (focusing on current/recent shifts matching filters)
  const filteredShiftRows = useMemo(() => {
    return shiftRows.filter((r) => {
      if (shiftFilter !== 'all' && r.shift !== shiftFilter) return false;
      if (siteFilter !== 'all' && r.site !== siteFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          r.site.toLowerCase().includes(q) ||
          r.date.toLowerCase().includes(q) ||
          r.shift.toLowerCase().includes(q) ||
          r.notes.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [shiftRows, shiftFilter, siteFilter, searchQuery]);

  const filteredMachineOps = useMemo(() => {
    return machineOperationLogs.filter((m) => {
      if (shiftFilter !== 'all' && m.shift !== shiftFilter) return false;
      if (siteFilter !== 'all' && m.siteName !== siteFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          m.machineName.toLowerCase().includes(q) ||
          m.machineType.toLowerCase().includes(q) ||
          m.operatorName.toLowerCase().includes(q) ||
          m.siteName.toLowerCase().includes(q) ||
          m.date.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [machineOperationLogs, shiftFilter, siteFilter, searchQuery]);

  const filteredEngineeringLogs = useMemo(() => {
    return engineeringLogs.filter((e) => {
      if (shiftFilter !== 'all' && e.shift !== shiftFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          e.machineName.toLowerCase().includes(q) ||
          e.description.toLowerCase().includes(q) ||
          e.actionTaken.toLowerCase().includes(q) ||
          e.category.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [engineeringLogs, shiftFilter, searchQuery]);

  // Day vs Night comparison metrics
  // Performance Optimization: Replaced separate array filter step and 8 reduces with single-pass accumulator.
  const shiftComparison = useMemo(() => {
    let dayBcm = 0;
    let nightBcm = 0;
    let dayLoads = 0;
    let nightLoads = 0;
    let dayHours = 0;
    let nightHours = 0;
    let dayDelays = 0;
    let nightDelays = 0;

    for (const r of filteredShiftRows) {
      if (r.shift === 'day') {
        dayBcm += r.totalBcm;
        dayLoads += r.loads;
        dayHours += r.hours;
        dayDelays += r.delayMin;
      } else if (r.shift === 'night') {
        nightBcm += r.totalBcm;
        nightLoads += r.loads;
        nightHours += r.hours;
        nightDelays += r.delayMin;
      }
    }

    const maxBcm = Math.max(dayBcm + nightBcm, 1);
    return {
      dayBcm,
      nightBcm,
      dayLoads,
      nightLoads,
      dayHours,
      nightHours,
      dayDelays,
      nightDelays,
      dayPct: Math.round((dayBcm / maxBcm) * 100),
      nightPct: Math.round((nightBcm / maxBcm) * 100),
    };
  }, [filteredShiftRows]);

  // Site Breakdown for visual indicators
  const siteBreakdown = useMemo(() => {
    const map = new Map<
      string,
      { site: string; bcm: number; loads: number; hours: number; delays: number }
    >();
    for (const r of filteredShiftRows) {
      const siteKey = r.site || 'General / Unassigned';
      const curr = map.get(siteKey) || {
        site: siteKey,
        bcm: 0,
        loads: 0,
        hours: 0,
        delays: 0,
      };
      curr.bcm += r.totalBcm;
      curr.loads += r.loads;
      curr.hours += r.hours;
      curr.delays += r.delayMin;
      map.set(siteKey, curr);
    }
    const list = Array.from(map.values()).sort((a, b) => b.bcm - a.bcm);
    const maxSiteBcm = Math.max(...list.map((s) => s.bcm), 1);
    return list.map((s) => ({
      ...s,
      pct: Math.round((s.bcm / maxSiteBcm) * 100),
      bcmPerHour: s.hours > 0 ? s.bcm / s.hours : 0,
    }));
  }, [filteredShiftRows]);

  // Day Aggregated Rows for "Day" subtab
  const dailyAggregatedRows = useMemo(() => {
    const map = new Map<
      string,
      {
        date: string;
        sites: Set<string>;
        shiftsLogged: Set<string>;
        hours: number;
        loads: number;
        haulBcm: number;
        dozerRolloverBcm: number;
        totalBcm: number;
        delayMin: number;
        dozerPasses: number;
        fuelLitres: number;
        coalTonnes: number;
        wasteTonnes: number;
        notes: string[];
      }
    >();

    for (const r of shiftRows) {
      if (siteFilter !== 'all' && r.site !== siteFilter) continue;
      const existing = map.get(r.date) || {
        date: r.date,
        sites: new Set<string>(),
        shiftsLogged: new Set<string>(),
        hours: 0,
        loads: 0,
        haulBcm: 0,
        dozerRolloverBcm: 0,
        totalBcm: 0,
        delayMin: 0,
        dozerPasses: 0,
        fuelLitres: 0,
        coalTonnes: 0,
        wasteTonnes: 0,
        notes: [],
      };
      if (r.site && r.site !== '—') existing.sites.add(r.site);
      existing.shiftsLogged.add(r.shift);
      existing.hours += r.hours;
      existing.loads += r.loads;
      existing.haulBcm += r.haulBcm;
      existing.dozerRolloverBcm += r.dozerRolloverBcm;
      existing.totalBcm += r.totalBcm;
      existing.delayMin += r.delayMin;
      existing.dozerPasses += r.dozerPasses;
      existing.fuelLitres += r.fuelLitres;
      existing.coalTonnes += r.coalTonnes;
      existing.wasteTonnes += r.wasteTonnes;
      if (r.notes) existing.notes.push(r.notes);
      map.set(r.date, existing);
    }

    const list = Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
    const maxDayBcm = Math.max(...list.map((d) => d.totalBcm), 1);

    return list.map((d) => ({
      ...d,
      siteList: Array.from(d.sites),
      shiftCount: d.shiftsLogged.size,
      bcmPct: Math.round((d.totalBcm / maxDayBcm) * 100),
      bcmPerHour: d.hours > 0 ? d.totalBcm / d.hours : 0,
    }));
  }, [shiftRows, siteFilter]);

  // Archived Rows & Monthly Rollups for "Archived" subtab
  const archivedData = useMemo(() => {
    // Historical rows (prior dates or matching search/date range)
    const historicalRows = shiftRows.filter((r) => {
      if (shiftFilter !== 'all' && r.shift !== shiftFilter) return false;
      if (siteFilter !== 'all' && r.site !== siteFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          r.site.toLowerCase().includes(q) ||
          r.date.toLowerCase().includes(q) ||
          r.shift.toLowerCase().includes(q) ||
          r.notes.toLowerCase().includes(q)
        );
      }
      return true;
    });

    const monthMap = new Map<
      string,
      {
        month: string;
        shiftCount: number;
        hours: number;
        loads: number;
        haulBcm: number;
        dozerRolloverBcm: number;
        totalBcm: number;
        delayMin: number;
      }
    >();

    for (const r of historicalRows) {
      const month = r.date.slice(0, 7);
      const curr = monthMap.get(month) || {
        month,
        shiftCount: 0,
        hours: 0,
        loads: 0,
        haulBcm: 0,
        dozerRolloverBcm: 0,
        totalBcm: 0,
        delayMin: 0,
      };
      curr.shiftCount += 1;
      curr.hours += r.hours;
      curr.loads += r.loads;
      curr.haulBcm += r.haulBcm;
      curr.dozerRolloverBcm += r.dozerRolloverBcm;
      curr.totalBcm += r.totalBcm;
      curr.delayMin += r.delayMin;
      monthMap.set(month, curr);
    }

    const monthlyRollups = Array.from(monthMap.values()).sort((a, b) =>
      b.month.localeCompare(a.month)
    );

    return {
      historicalRows,
      monthlyRollups,
      priorDaysRows: historicalRows.filter((r) => r.date < todayStr),
    };
  }, [shiftRows, shiftFilter, siteFilter, searchQuery, todayStr]);

  // Site-grouped Shift PDF Report data:
  // Grouped by Site, ordered within each site:
  // 1. Excavators first ('excavator')
  // 2. Then Roll Over ('rollover')
  // 3. Then Machines Worked on Site ('site_machine')
  const pdfSiteGroups = useMemo(() => buildPdfSiteGroups(filteredMachineOps), [filteredMachineOps]);

  const pdfShiftReportData = useMemo(() => {
    if (pdfSiteGroups.length === 0) return pdfReportData;
    const rows: string[][] = [];
    let prod = 0;
    let eng = 0;
    let nat = 0;
    let nonSite = 0;
    let totalHours = 0;
    for (const g of pdfSiteGroups) {
      prod += g.productionDelayMin;
      eng += g.engineeringDelayMin;
      nat += g.naturalDelayMin;
      nonSite += g.nonSiteDelayMin;
      totalHours += g.totalHours;
      for (const m of g.orderedMachines) {
        const roleLabel =
          m.siteGroupRole === 'excavator'
            ? '1. Excavator'
            : m.siteGroupRole === 'rollover'
              ? '2. Roll Over'
              : '3. Site Machine';
        const smuRange =
          m.startSmu != null && m.endSmu != null
            ? `${m.startSmu.toFixed(1)} - ${m.endSmu.toFixed(1)}`
            : m.startSmu != null
              ? `${m.startSmu.toFixed(1)} - Active`
              : '—';
        rows.push([
          g.site,
          roleLabel,
          `${m.machineName} (${m.machineType})`,
          smuRange,
          `${m.hoursWorked.toFixed(2)}h`,
          m.operatorName,
          `${m.productionDelayMinutes ?? 0}m`,
          `${m.engineeringDelayMinutes ?? 0}m`,
          `${m.naturalDelayMinutes ?? 0}m`,
          `${m.nonSiteDelayMinutes ?? 0}m`,
          m.excavatorActivity || '—',
        ]);
      }
    }
    return {
      title: `${departmentName} — Site-Grouped Shift Report`,
      subtitle: `Generated on ${todayStr} — Date range: ${fromDateStr} to ${toDateStr} (${shiftFilter === 'all' ? 'All Shifts' : `${shiftFilter.toUpperCase()} Shift`})`,
      kpis: [
        { label: 'Total Worked Hours', value: `${totalHours.toFixed(1)} h` },
        { label: 'Production Delay', value: `${prod} min` },
        { label: 'Engineering Delay', value: `${eng} min` },
        {
          label: 'Natural / Non-Site Delay',
          value: `${nat}m / ${nonSite}m`,
        },
      ],
      tableHeaders: [
        'Site',
        'Group',
        'Machine',
        'Hours Start - Stop',
        'Total Worked',
        'Operator',
        'Prod Delay',
        'Eng Delay',
        'Natural Delays',
        'Non-Site Delays',
        'Excavator Activity',
      ],
      tableRows: rows,
    };
  }, [pdfSiteGroups, pdfReportData, departmentName, todayStr, fromDateStr, toDateStr, shiftFilter]);
  return (
    <div className="space-y-6">
      {queryWarnings.length > 0 && (
        <div
          role="alert"
          data-testid="reports-query-warning-banner"
          className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs text-amber-800 flex items-start gap-2.5 no-print"
        >
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Partial Data Warning — Database Query Issue</p>
            <p className="mt-0.5 font-mono text-[11px]">{queryWarnings.join(' · ')}</p>
          </div>
        </div>
      )}
      {/* Executive & Operator Live Header */}
      <GlassCard className="p-5 no-print">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-2xl font-bold text-[var(--text-heading)]">
                {departmentName} Reports &amp; Live Intelligence
              </h2>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-accent-green/10 text-accent-green border border-accent-green/20">
                <Radio className="w-3.5 h-3.5 animate-pulse" />
                Live Telemetry &amp; Logs
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] border border-[var(--accent-blue)]/20">
                {currentShift === 'day' ? (
                  <Sun className="w-3.5 h-3.5" />
                ) : (
                  <Moon className="w-3.5 h-3.5" />
                )}
                Active Shift: {currentShift.toUpperCase()} ({todayStr})
              </span>
            </div>
            <p className="text-xs text-[var(--text-muted)]">
              Unified operational &amp; executive reporting across active Shift logs, Daily
              consolidations, and Archived historical records ({fromDateStr} to {toDateStr}).
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <CopyReportButton csvContent={csvContent} />
            <PDFDownloadButton reportData={pdfShiftReportData} departmentId={departmentId} />
            <ExportButton
              filename={`${departmentSlug}-report-${fromDateStr}-to-${toDateStr}`}
              rows={exportRows}
            />
          </div>
        </div>
      </GlassCard>

      {/* Live Stats KPI Grid with Visual Indicators */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 no-print">
        {/* 1. Total Volume Moved (BCM) */}
        <GlassCard className="p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[var(--text-muted)]">
                Total Volume (BCM)
              </span>
              <Layers className="w-4 h-4 text-[var(--accent-blue)]" />
            </div>
            <p className="text-2xl font-bold text-[var(--text-heading)] mt-1.5 font-mono">
              {Number(kpiStats.totalBcm.toFixed(1)).toLocaleString()}
            </p>
          </div>
          <div className="mt-3 space-y-1.5">
            <div className="w-full h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden flex">
              <div
                className="bg-[var(--accent-blue)] h-full transition-all"
                style={{
                  width: `${kpiStats.totalBcm > 0 ? Math.round((kpiStats.totalHaulBcm / kpiStats.totalBcm) * 100) : 50}%`,
                }}
              />
              <div
                className="bg-accent-green h-full transition-all"
                style={{
                  width: `${kpiStats.totalBcm > 0 ? Math.round((kpiStats.totalDozerBcm / kpiStats.totalBcm) * 100) : 50}%`,
                }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
              <span>Haul: {Number(kpiStats.totalHaulBcm.toFixed(0)).toLocaleString()}</span>
              <span>Roll-over: {Number(kpiStats.totalDozerBcm.toFixed(0)).toLocaleString()}</span>
            </div>
          </div>
        </GlassCard>

        {/* 2. Haul Loads */}
        <GlassCard className="p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[var(--text-muted)]">Total Haul Loads</span>
              <Truck className="w-4 h-4 text-[var(--accent-blue)]" />
            </div>
            <p className="text-2xl font-bold text-[var(--accent-blue)] mt-1.5 font-mono">
              {kpiStats.totalLoads.toLocaleString()}
            </p>
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px]">
            <span className="text-[var(--text-muted)]">Today&apos;s Loads:</span>
            <span className="font-semibold text-[var(--text-heading)] font-mono">
              {kpiStats.todayLoads.toLocaleString()} loads
            </span>
          </div>
        </GlassCard>

        {/* 3. Operating Hours & Efficiency */}
        <GlassCard className="p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[var(--text-muted)]">Operating Hours</span>
              <Clock className="w-4 h-4 text-accent-green" />
            </div>
            <p className="text-2xl font-bold text-accent-green mt-1.5 font-mono">
              {kpiStats.totalHours.toFixed(1)}h
            </p>
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px]">
            <span className="text-[var(--text-muted)]">Efficiency Rate:</span>
            <span className="font-semibold text-[var(--accent-blue)] font-mono">
              {kpiStats.bcmPerHour.toFixed(1)} BCM/h
            </span>
          </div>
        </GlassCard>

        {/* 4. Dozer Roll-over Fixed Calculation */}
        <GlassCard className="p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[var(--text-muted)]">
                Dozer Roll-over (250/h)
              </span>
              <BarChart3 className="w-4 h-4 text-[var(--accent-blue)]" />
            </div>
            <p className="text-2xl font-bold text-[var(--text-heading)] mt-1.5 font-mono">
              {Number(kpiStats.totalDozerBcm.toFixed(1)).toLocaleString()}{' '}
              <span className="text-xs font-normal text-[var(--text-muted)]">BCM</span>
            </p>
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px]">
            <span className="text-[var(--text-muted)]">Blade Passes:</span>
            <span className="font-semibold text-[var(--text-heading)] font-mono">
              {kpiStats.totalPasses.toLocaleString()}
            </span>
          </div>
        </GlassCard>

        {/* 5. Delays & Engineering Health */}
        <GlassCard className="p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[var(--text-muted)]">
                Delays &amp; Breakdowns
              </span>
              <Wrench className="w-4 h-4 text-accent-red" />
            </div>
            <p className="text-2xl font-bold text-[var(--text-heading)] mt-1.5 font-mono">
              {kpiStats.totalDelayMin.toLocaleString()}{' '}
              <span className="text-xs font-normal text-[var(--text-muted)]">min</span>
            </p>
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px]">
            <span className="text-accent-red font-medium">{kpiStats.openIssues} Open</span>
            <span className="text-accent-green font-medium">
              {kpiStats.resolvedIssues} Resolved
            </span>
          </div>
        </GlassCard>

        {/* 6. Shift Coverage Completeness */}
        <GlassCard className="p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[var(--text-muted)]">Shift Coverage</span>
              <Activity className="w-4 h-4 text-accent-green" />
            </div>
            <div className="flex items-baseline justify-between mt-1.5">
              <p className="text-2xl font-bold text-[var(--text-heading)] font-mono">
                {kpiStats.coveragePct}%
              </p>
              <span className="text-xs text-[var(--text-muted)]">
                {coveredFleetCount}/{totalFleetCount} units
              </span>
            </div>
          </div>
          <div className="mt-3 space-y-1.5">
            <div className="w-full h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${
                  kpiStats.coveragePct === 100 ? 'bg-accent-green' : 'bg-[var(--accent-blue)]'
                }`}
                style={{ width: `${kpiStats.coveragePct}%` }}
              />
            </div>
            {missingCoverage.length > 0 ? (
              <button
                type="button"
                onClick={() => setShowMissingMachines((v) => !v)}
                className="text-[11px] text-[var(--accent-blue)] hover:underline text-left w-full"
              >
                {showMissingMachines
                  ? 'Hide pending machines'
                  : `${missingCoverage.length} pending shift entries →`}
              </button>
            ) : (
              <span className="text-[11px] text-accent-green flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> All machines logged
              </span>
            )}
          </div>
        </GlassCard>
      </div>

      {/* Optional Expandable Pending Shift Coverage Drawer (Non-blocking!) */}
      {showMissingMachines && missingCoverage.length > 0 && (
        <GlassCard className="border-[var(--accent-blue)]/30 p-4 space-y-3 no-print">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[var(--accent-blue)]" />
              <p className="text-sm font-medium text-[var(--text-heading)]">
                Pending Shift Entries ({missingCoverage.length} machines for {currentShift} shift)
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowMissingMachines(false)}
              className="text-xs text-[var(--text-muted)] hover:text-[var(--text-heading)]"
            >
              Close
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {missingCoverage.map((s) => (
              <div
                key={s.machineId}
                className="flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-default)]"
              >
                <div>
                  <p className="text-xs font-medium text-[var(--text-heading)]">{s.machineName}</p>
                  <p className="text-[11px] text-[var(--text-muted)]">{s.machineType}</p>
                </div>
                <Link
                  href={s.formPath}
                  className="text-xs font-medium text-[var(--accent-blue)] hover:underline"
                >
                  Log →
                </Link>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Subtabs Navigation: Shift | Day | Archived + Filter Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--border-default)] pb-3 no-print">
        <div
          role="tablist"
          aria-label="Report Views"
          className="inline-flex items-center gap-1.5 bg-[var(--bg-secondary)] p-1.5 rounded-xl border border-[var(--border-default)]"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'shift'}
            onClick={() => handleSelectTab('shift')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'shift'
                ? 'bg-[var(--accent-blue)] text-[var(--bg-secondary)] shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-heading)]'
            }`}
          >
            <Clock className="w-4 h-4" />
            Shift
            <span
              className={`text-xs px-1.5 py-0.2 rounded-full ${
                activeTab === 'shift'
                  ? 'bg-white/20 text-white'
                  : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]'
              }`}
            >
              {filteredShiftRows.length}
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'day'}
            onClick={() => handleSelectTab('day')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'day'
                ? 'bg-[var(--accent-blue)] text-[var(--bg-secondary)] shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-heading)]'
            }`}
          >
            <Calendar className="w-4 h-4" />
            Day
            <span
              className={`text-xs px-1.5 py-0.2 rounded-full ${
                activeTab === 'day'
                  ? 'bg-white/20 text-white'
                  : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]'
              }`}
            >
              {dailyAggregatedRows.length}
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'archived'}
            onClick={() => handleSelectTab('archived')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'archived'
                ? 'bg-[var(--accent-blue)] text-[var(--bg-secondary)] shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-heading)]'
            }`}
          >
            <Archive className="w-4 h-4" />
            Archived
            <span
              className={`text-xs px-1.5 py-0.2 rounded-full ${
                activeTab === 'archived'
                  ? 'bg-white/20 text-white'
                  : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]'
              }`}
            >
              {archivedData.monthlyRollups.length}m / {archivedData.historicalRows.length}
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'pdf-report'}
            onClick={() => handleSelectTab('pdf-report')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'pdf-report'
                ? 'bg-[var(--accent-blue)] text-[var(--bg-secondary)] shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-heading)]'
            }`}
          >
            <FileText className="w-4 h-4" />
            PDF Report
            <span
              className={`text-xs px-1.5 py-0.2 rounded-full ${
                activeTab === 'pdf-report'
                  ? 'bg-white/20 text-white'
                  : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]'
              }`}
            >
              {pdfSiteGroups.length} site{pdfSiteGroups.length === 1 ? '' : 's'}
            </span>
          </button>
        </div>

        {/* Interactive Quick Filters (Shift, Site, Search) */}
        <div className="flex flex-wrap items-center gap-2.5">
          {activeTab !== 'day' && (
            <div className="inline-flex items-center rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-default)] p-1">
              {(['all', 'day', 'night'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setShiftFilter(s)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                    shiftFilter === s
                      ? 'bg-[var(--accent-blue)] text-[var(--bg-secondary)]'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-heading)]'
                  }`}
                >
                  {s === 'all' ? 'All Shifts' : s === 'day' ? 'Day Shift' : 'Night Shift'}
                </button>
              ))}
            </div>
          )}

          {allSites.length > 0 && (
            <select
              aria-label="Filter by site"
              value={siteFilter}
              onChange={(e) => setSiteFilter(e.target.value)}
              className="bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg px-3 py-1.5 text-xs text-[var(--text-heading)] focus:outline-none focus:border-[var(--accent-blue)]"
            >
              <option value="all">All Sites ({allSites.length})</option>
              {allSites.map((site) => (
                <option key={site} value={site}>
                  {site}
                </option>
              ))}
            </select>
          )}

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search machine, site, date..."
              className="bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg pl-8 pr-3 py-1.5 text-xs text-[var(--text-heading)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-blue)] w-48 sm:w-56"
            />
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════════
          SUBTAB 1: SHIFT VIEW (Visual Indicators + Shift Logs)
         ═══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'shift' && (
        <div className="space-y-6">
          {/* Visual Indicators Row: Day vs Night Shift Split & Site Performance */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Day vs Night Shift Visual Indicator Card */}
            <GlassCard className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-[var(--text-heading)]">
                    Shift Performance Split (Day vs Night)
                  </h3>
                  <p className="text-xs text-[var(--text-muted)]">
                    Visual comparison of volume moved, haul loads, and operating hours by shift
                  </p>
                </div>
                <span className="text-xs font-mono text-[var(--accent-blue)] font-semibold">
                  {Number(
                    (shiftComparison.dayBcm + shiftComparison.nightBcm).toFixed(1)
                  ).toLocaleString()}{' '}
                  BCM
                </span>
              </div>

              {/* Visual Split Bar */}
              <div className="space-y-2">
                <div className="w-full h-3 bg-[var(--bg-tertiary)] rounded-full overflow-hidden flex">
                  <div
                    className="bg-[var(--accent-blue)] h-full transition-all"
                    style={{ width: `${shiftComparison.dayPct}%` }}
                    title={`Day Shift: ${shiftComparison.dayPct}%`}
                  />
                  <div
                    className="bg-indigo-500 h-full transition-all"
                    style={{ width: `${shiftComparison.nightPct}%` }}
                    title={`Night Shift: ${shiftComparison.nightPct}%`}
                  />
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-[var(--accent-blue)] font-medium">
                    <Sun className="w-3.5 h-3.5" />
                    Day Shift ({shiftComparison.dayPct}%)
                  </span>
                  <span className="flex items-center gap-1.5 text-indigo-500 font-medium">
                    <Moon className="w-3.5 h-3.5" />
                    Night Shift ({shiftComparison.nightPct}%)
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[var(--border-default)]">
                <div className="p-3 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-default)] space-y-1">
                  <p className="text-xs font-medium text-[var(--accent-blue)]">Day Shift Totals</p>
                  <p className="text-lg font-bold font-mono text-[var(--text-heading)]">
                    {Number(shiftComparison.dayBcm.toFixed(1)).toLocaleString()} BCM
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {shiftComparison.dayLoads.toLocaleString()} loads ·{' '}
                    {shiftComparison.dayHours.toFixed(1)}h · {shiftComparison.dayDelays}m delay
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-default)] space-y-1">
                  <p className="text-xs font-medium text-indigo-500">Night Shift Totals</p>
                  <p className="text-lg font-bold font-mono text-[var(--text-heading)]">
                    {Number(shiftComparison.nightBcm.toFixed(1)).toLocaleString()} BCM
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {shiftComparison.nightLoads.toLocaleString()} loads ·{' '}
                    {shiftComparison.nightHours.toFixed(1)}h · {shiftComparison.nightDelays}m delay
                  </p>
                </div>
              </div>
            </GlassCard>

            {/* Site Production Visual Indicators Card */}
            <GlassCard className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-[var(--text-heading)]">
                    Site Volume &amp; Productivity Indicators
                  </h3>
                  <p className="text-xs text-[var(--text-muted)]">
                    Live production distribution across active pit &amp; stockpile sites
                  </p>
                </div>
                <span className="text-xs text-[var(--text-muted)]">
                  {siteBreakdown.length} active site{siteBreakdown.length === 1 ? '' : 's'}
                </span>
              </div>

              <div className="space-y-3 max-h-52 overflow-y-auto pr-1">
                {siteBreakdown.map((s) => (
                  <div key={s.site} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-[var(--text-heading)]">{s.site}</span>
                      <span className="font-mono text-[var(--text-secondary)]">
                        <strong className="text-[var(--accent-blue)]">
                          {Number(s.bcm.toFixed(1)).toLocaleString()} BCM
                        </strong>{' '}
                        · {s.loads.toLocaleString()} loads · {s.hours.toFixed(1)}h (
                        {s.bcmPerHour.toFixed(1)} BCM/h)
                      </span>
                    </div>
                    <div className="w-full h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                      <div
                        className="bg-[var(--accent-blue)] h-full rounded-full transition-all"
                        style={{ width: `${Math.max(s.pct, 4)}%` }}
                      />
                    </div>
                  </div>
                ))}
                {siteBreakdown.length === 0 && (
                  <p className="text-xs text-[var(--text-muted)] py-6 text-center">
                    No site shift data for the current filter.
                  </p>
                )}
              </div>
            </GlassCard>
          </div>

          {/* Shift Production Logs Table */}
          <GlassCard className="overflow-hidden p-0">
            <div className="px-6 py-4 border-b border-[var(--border-default)] flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-[var(--text-heading)]">
                  Shift Production &amp; Roll-over Logs
                </h3>
                <p className="text-xs text-[var(--text-muted)]">
                  Per-shift breakdown of operating hours, haul loads, excavator BCM, Dozer roll-over
                  (Hours &times; 250), and delays
                </p>
              </div>
              <span className="text-xs font-mono text-[var(--text-muted)]">
                {filteredShiftRows.length} shift record{filteredShiftRows.length === 1 ? '' : 's'}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[var(--border-default)] bg-[var(--bg-secondary)]/60">
                    <th className="px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase">
                      Date
                    </th>
                    <th className="px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase">
                      Shift
                    </th>
                    <th className="px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase">
                      Site
                    </th>
                    <th className="px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase text-right">
                      Hours
                    </th>
                    <th className="px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase text-right">
                      Loads
                    </th>
                    <th className="px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase text-right">
                      Haul BCM
                    </th>
                    <th className="px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase text-right">
                      Roll-over BCM
                    </th>
                    <th className="px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase text-right">
                      Total BCM
                    </th>
                    <th className="px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase text-right">
                      Delay (min)
                    </th>
                    <th className="px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase text-right">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-default)]">
                  {filteredShiftRows.map((row) => (
                    <tr key={row.id} className="hover:bg-[var(--bg-tertiary)]/60 transition-colors">
                      <td className="px-5 py-3.5 text-sm font-mono text-[var(--text-heading)]">
                        {row.date}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            row.shift === 'day'
                              ? 'bg-[var(--accent-blue)]/10 text-[var(--accent-blue)]'
                              : 'bg-indigo-500/10 text-indigo-500'
                          }`}
                        >
                          {row.shift === 'day' ? (
                            <Sun className="w-3 h-3" />
                          ) : (
                            <Moon className="w-3 h-3" />
                          )}
                          {row.shift.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-sm">
                        {row.site && row.site !== '—' ? (
                          <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] border border-[var(--accent-blue)]/20">
                            {row.site}
                          </span>
                        ) : (
                          <span className="text-xs text-[var(--text-muted)]">All Sites</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-sm font-mono text-right text-[var(--text-heading)]">
                        {row.hours.toFixed(1)}h
                      </td>
                      <td className="px-5 py-3.5 text-sm font-mono text-right text-[var(--accent-blue)] font-medium">
                        {row.loads.toLocaleString()}
                      </td>
                      <td className="px-5 py-3.5 text-sm font-mono text-right text-[var(--text-secondary)]">
                        {Number(row.haulBcm.toFixed(1)).toLocaleString()}
                      </td>
                      <td className="px-5 py-3.5 text-sm font-mono text-right text-[var(--accent-blue)]">
                        {Number(row.dozerRolloverBcm.toFixed(1)).toLocaleString()}
                      </td>
                      <td className="px-5 py-3.5 text-sm font-mono text-right text-accent-green font-semibold">
                        {Number(row.totalBcm.toFixed(1)).toLocaleString()}
                      </td>
                      <td className="px-5 py-3.5 text-sm font-mono text-right text-[var(--text-secondary)]">
                        {row.delayMin}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                            row.delayMin > 120
                              ? 'bg-accent-red/10 text-accent-red'
                              : 'bg-accent-green/10 text-accent-green'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              row.delayMin > 120 ? 'bg-accent-red' : 'bg-accent-green'
                            }`}
                          />
                          {row.delayMin > 120 ? 'High Delay' : 'Optimal'}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {filteredShiftRows.length === 0 && (
                    <tr>
                      <td
                        colSpan={10}
                        className="px-6 py-10 text-center text-sm text-[var(--text-muted)]"
                      >
                        No shift production logs match the selected filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </GlassCard>

          {/* Machine Operations & SMR Log Table */}
          <GlassCard className="overflow-hidden p-0">
            <div className="px-6 py-4 border-b border-[var(--border-default)] flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-[var(--text-heading)]">
                  Machine Operations &amp; SMR Shift Log
                </h3>
                <p className="text-xs text-[var(--text-muted)]">
                  Individual machine SMR readings, operator assignments, and calculated output
                </p>
              </div>
              <span className="text-xs font-mono text-[var(--text-muted)]">
                {filteredMachineOps.length} operation{filteredMachineOps.length === 1 ? '' : 's'}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[var(--border-default)] bg-[var(--bg-secondary)]/60">
                    <th className="px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase">
                      Date &amp; Shift
                    </th>
                    <th className="px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase">
                      Machine
                    </th>
                    <th className="px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase">
                      Operator
                    </th>
                    <th className="px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase">
                      Site
                    </th>
                    <th className="px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase text-right">
                      Start SMR
                    </th>
                    <th className="px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase text-right">
                      Stop SMR
                    </th>
                    <th className="px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase text-right">
                      Hours Worked
                    </th>
                    <th className="px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase text-right">
                      Volume / Roll-over
                    </th>
                    <th className="px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase text-right">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-default)]">
                  {filteredMachineOps.slice(0, 50).map((op) => (
                    <tr key={op.id} className="hover:bg-[var(--bg-tertiary)]/60 transition-colors">
                      <td className="px-5 py-3 text-xs font-mono text-[var(--text-heading)]">
                        {op.date} · <span className="uppercase">{op.shift}</span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-[var(--text-heading)]">
                            {op.machineName}
                          </span>
                          <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--text-muted)]">
                            {op.machineType}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-sm text-[var(--text-secondary)]">
                        {op.operatorName}
                      </td>
                      <td className="px-5 py-3 text-sm text-[var(--text-secondary)]">
                        {op.siteName}
                      </td>
                      <td className="px-5 py-3 text-sm font-mono text-right text-[var(--text-secondary)]">
                        {op.startSmu != null ? op.startSmu.toFixed(1) : '—'}
                      </td>
                      <td className="px-5 py-3 text-sm font-mono text-right text-[var(--text-secondary)]">
                        {op.endSmu != null ? op.endSmu.toFixed(1) : '—'}
                      </td>
                      <td className="px-5 py-3 text-sm font-mono text-right text-accent-green font-medium">
                        {op.hoursWorked.toFixed(2)}h
                      </td>
                      <td className="px-5 py-3 text-sm font-mono text-right text-[var(--accent-blue)] font-medium">
                        {op.isDozer
                          ? `${Number(op.bcmMoved.toFixed(1)).toLocaleString()} BCM (Roll-over)`
                          : op.bcmMoved > 0
                            ? `${Number(op.bcmMoved.toFixed(1)).toLocaleString()} BCM`
                            : '—'}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                            op.status === 'completed'
                              ? 'bg-accent-green/10 text-accent-green'
                              : 'bg-[var(--accent-blue)]/10 text-[var(--accent-blue)]'
                          }`}
                        >
                          {op.status === 'completed' ? 'Completed' : 'In Progress'}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {filteredMachineOps.length === 0 && (
                    <tr>
                      <td
                        colSpan={9}
                        className="px-6 py-8 text-center text-sm text-[var(--text-muted)]"
                      >
                        No machine operation logs found for the selected filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </GlassCard>

          {/* Engineering Breakdowns & Activity Logs */}
          {filteredEngineeringLogs.length > 0 && (
            <GlassCard className="overflow-hidden p-0">
              <div className="px-6 py-4 border-b border-[var(--border-default)] flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-[var(--text-heading)]">
                    Engineering Breakdowns &amp; Department Activity Logs
                  </h3>
                  <p className="text-xs text-[var(--text-muted)]">
                    Cross-department engineering faults, repairs, and shift logs
                  </p>
                </div>
                <span className="text-xs font-mono text-[var(--text-muted)]">
                  {filteredEngineeringLogs.length} item
                  {filteredEngineeringLogs.length === 1 ? '' : 's'}
                </span>
              </div>
              <div className="divide-y divide-[var(--border-default)]">
                {filteredEngineeringLogs.slice(0, 20).map((item) => (
                  <div
                    key={item.id}
                    className="px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-[var(--bg-tertiary)]/50 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium ${
                            item.source === 'breakdown'
                              ? 'bg-accent-red/10 text-accent-red border border-accent-red/20'
                              : 'bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] border border-[var(--accent-blue)]/20'
                          }`}
                        >
                          {item.source === 'breakdown'
                            ? 'Breakdown'
                            : item.source === 'daily_log'
                              ? 'Engineering Log'
                              : 'Engineering Note'}
                        </span>
                        <span className="text-sm font-semibold text-[var(--text-heading)]">
                          {item.machineName}
                        </span>
                        <span className="text-xs font-mono text-[var(--text-muted)]">
                          {item.date} · {item.shift.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-sm text-[var(--text-heading)]">{item.description}</p>
                      {item.actionTaken && (
                        <p className="text-xs text-[var(--text-secondary)]">
                          <strong className="text-[var(--accent-blue)]">Action:</strong>{' '}
                          {item.actionTaken}
                        </p>
                      )}
                    </div>
                    <span
                      className={`self-start sm:self-center px-2.5 py-0.5 rounded-full text-xs font-medium shrink-0 ${
                        item.status === 'resolved'
                          ? 'bg-accent-green/10 text-accent-green'
                          : 'bg-accent-red/10 text-accent-red'
                      }`}
                    >
                      {item.status === 'resolved' ? 'Resolved' : 'Open / Active'}
                    </span>
                  </div>
                ))}
              </div>
            </GlassCard>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════════
          SUBTAB 2: DAY VIEW (Daily Consolidated Visual Trends & Daily Logs)
         ═══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'day' && (
        <div className="space-y-6">
          {/* Visual Daily Volume Trend Bars */}
          <GlassCard className="p-5 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-base font-semibold text-[var(--text-heading)]">
                  Daily Consolidated Production Trend (Day + Night Combined)
                </h3>
                <p className="text-xs text-[var(--text-muted)]">
                  Visual daily volume comparison (Haul BCM + Dozer Roll-over BCM) for CEO &amp;
                  Operational review
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5 text-[var(--accent-blue)]">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[var(--accent-blue)]" />
                  Haul / Excavator BCM
                </span>
                <span className="flex items-center gap-1.5 text-accent-green">
                  <span className="w-2.5 h-2.5 rounded-sm bg-accent-green" />
                  Dozer Roll-over BCM (Hours &times; 250)
                </span>
              </div>
            </div>

            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {dailyAggregatedRows.slice(0, 14).map((d) => {
                const haulRatio = d.totalBcm > 0 ? (d.haulBcm / d.totalBcm) * d.bcmPct : 0;
                const dozerRatio =
                  d.totalBcm > 0 ? (d.dozerRolloverBcm / d.totalBcm) * d.bcmPct : 0;
                return (
                  <div key={d.date} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono font-medium text-[var(--text-heading)]">
                        {d.date}
                        {d.date === todayStr && (
                          <span className="ml-2 px-1.5 py-0.5 rounded bg-accent-green/10 text-accent-green text-[10px]">
                            TODAY
                          </span>
                        )}
                      </span>
                      <span className="font-mono text-[var(--text-secondary)]">
                        <strong className="text-[var(--text-heading)]">
                          {Number(d.totalBcm.toFixed(1)).toLocaleString()} BCM
                        </strong>{' '}
                        ({d.loads.toLocaleString()} loads · {d.hours.toFixed(1)}h ·{' '}
                        {d.bcmPerHour.toFixed(1)} BCM/h)
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden flex">
                      <div
                        className="bg-[var(--accent-blue)] h-full transition-all"
                        style={{ width: `${Math.max(haulRatio, d.haulBcm > 0 ? 2 : 0)}%` }}
                      />
                      <div
                        className="bg-accent-green h-full transition-all"
                        style={{
                          width: `${Math.max(dozerRatio, d.dozerRolloverBcm > 0 ? 2 : 0)}%`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
              {dailyAggregatedRows.length === 0 && (
                <p className="text-xs text-[var(--text-muted)] text-center py-8">
                  No daily production records found.
                </p>
              )}
            </div>
          </GlassCard>

          {/* Daily Consolidated Log Table */}
          <GlassCard className="overflow-hidden p-0">
            <div className="px-6 py-4 border-b border-[var(--border-default)] flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-[var(--text-heading)]">
                  Daily Consolidated Operational Log
                </h3>
                <p className="text-xs text-[var(--text-muted)]">
                  Full-day (24h) aggregated metrics combining Day &amp; Night shifts per calendar
                  date
                </p>
              </div>
              <span className="text-xs font-mono text-[var(--text-muted)]">
                {dailyAggregatedRows.length} day{dailyAggregatedRows.length === 1 ? '' : 's'}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[var(--border-default)] bg-[var(--bg-secondary)]/60">
                    <th className="px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase">
                      Date
                    </th>
                    <th className="px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase">
                      Active Sites
                    </th>
                    <th className="px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase text-right">
                      Total Hours
                    </th>
                    <th className="px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase text-right">
                      Total Loads
                    </th>
                    <th className="px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase text-right">
                      Haul BCM
                    </th>
                    <th className="px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase text-right">
                      Dozer Roll-over BCM
                    </th>
                    <th className="px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase text-right">
                      Total Daily BCM
                    </th>
                    <th className="px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase text-right">
                      BCM / Hour
                    </th>
                    <th className="px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase text-right">
                      Delays (min)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-default)]">
                  {dailyAggregatedRows.map((d) => (
                    <tr key={d.date} className="hover:bg-[var(--bg-tertiary)]/60 transition-colors">
                      <td className="px-5 py-3.5 text-sm font-mono font-medium text-[var(--text-heading)]">
                        {d.date}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-[var(--text-secondary)]">
                        {d.siteList.length > 0 ? d.siteList.join(', ') : 'All Sites'} (
                        {d.shiftCount} shift{d.shiftCount === 1 ? '' : 's'})
                      </td>
                      <td className="px-5 py-3.5 text-sm font-mono text-right text-[var(--text-heading)]">
                        {d.hours.toFixed(1)}h
                      </td>
                      <td className="px-5 py-3.5 text-sm font-mono text-right text-[var(--accent-blue)] font-medium">
                        {d.loads.toLocaleString()}
                      </td>
                      <td className="px-5 py-3.5 text-sm font-mono text-right text-[var(--text-secondary)]">
                        {Number(d.haulBcm.toFixed(1)).toLocaleString()}
                      </td>
                      <td className="px-5 py-3.5 text-sm font-mono text-right text-[var(--accent-blue)]">
                        {Number(d.dozerRolloverBcm.toFixed(1)).toLocaleString()}
                      </td>
                      <td className="px-5 py-3.5 text-sm font-mono text-right text-accent-green font-semibold">
                        {Number(d.totalBcm.toFixed(1)).toLocaleString()}
                      </td>
                      <td className="px-5 py-3.5 text-sm font-mono text-right text-[var(--accent-blue)]">
                        {d.bcmPerHour.toFixed(1)}
                      </td>
                      <td className="px-5 py-3.5 text-sm font-mono text-right text-[var(--text-secondary)]">
                        {d.delayMin}
                      </td>
                    </tr>
                  ))}
                  {dailyAggregatedRows.length === 0 && (
                    <tr>
                      <td
                        colSpan={9}
                        className="px-6 py-10 text-center text-sm text-[var(--text-muted)]"
                      >
                        No daily consolidated data available.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════════
          SUBTAB 3: ARCHIVED VIEW (Date Range Query, Monthly Rollups & Historical Register)
         ═══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'archived' && (
        <div className="space-y-6">
          {/* Date Range Filter Card */}
          <GlassCard className="p-5">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-[var(--text-heading)]">
                  Archived &amp; Historical Period Query
                </h3>
                <p className="text-xs text-[var(--text-muted)]">
                  Select a historical date range to inspect archived shift logs and monthly
                  production rollups
                </p>
              </div>
              <form method="GET" className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="block text-xs text-[var(--text-muted)] mb-1">From Date</label>
                  <Input
                    type="date"
                    name="from"
                    defaultValue={fromDateStr}
                    className="px-3 py-1.5"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[var(--text-muted)] mb-1">To Date</label>
                  <Input type="date" name="to" defaultValue={toDateStr} className="px-3 py-1.5" />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[var(--accent-blue)] text-[var(--bg-secondary)] text-xs font-semibold hover:bg-[var(--accent-blue)]/90 transition-colors"
                >
                  Load Archive Range
                </button>
              </form>
            </div>
          </GlassCard>

          {/* Monthly Archive Rollup Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {archivedData.monthlyRollups.map((m) => (
              <GlassCard key={m.month} className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold font-mono text-[var(--text-heading)]">
                    Period: {m.month}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                      m.month === currentMonthPrefix
                        ? 'bg-[var(--accent-blue)]/10 text-[var(--accent-blue)]'
                        : 'bg-accent-green/10 text-accent-green'
                    }`}
                  >
                    {m.month === currentMonthPrefix ? 'Current Period' : 'Archived Period'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-[var(--bg-secondary)]">
                    <p className="text-[var(--text-muted)]">Total Volume</p>
                    <p className="text-base font-bold font-mono text-accent-green mt-0.5">
                      {Number(m.totalBcm.toFixed(1)).toLocaleString()} BCM
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[var(--bg-secondary)]">
                    <p className="text-[var(--text-muted)]">Haul Loads</p>
                    <p className="text-base font-bold font-mono text-[var(--accent-blue)] mt-0.5">
                      {m.loads.toLocaleString()}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[var(--bg-secondary)]">
                    <p className="text-[var(--text-muted)]">Dozer Roll-over</p>
                    <p className="text-sm font-semibold font-mono text-[var(--text-heading)] mt-0.5">
                      {Number(m.dozerRolloverBcm.toFixed(1)).toLocaleString()} BCM
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[var(--bg-secondary)]">
                    <p className="text-[var(--text-muted)]">Operating Hours</p>
                    <p className="text-sm font-semibold font-mono text-[var(--text-heading)] mt-0.5">
                      {m.hours.toFixed(1)}h ({m.shiftCount} shifts)
                    </p>
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>

          {/* Full Historical / Archived Shift Register */}
          <GlassCard className="overflow-hidden p-0">
            <div className="px-6 py-4 border-b border-[var(--border-default)] flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-[var(--text-heading)]">
                  Archived Shift &amp; Production Register ({fromDateStr} — {toDateStr})
                </h3>
                <p className="text-xs text-[var(--text-muted)]">
                  Complete immutable historical log for executive auditing and compliance export
                </p>
              </div>
              <span className="text-xs font-mono text-[var(--text-muted)]">
                {archivedData.historicalRows.length} archived record
                {archivedData.historicalRows.length === 1 ? '' : 's'}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[var(--border-default)] bg-[var(--bg-secondary)]/60">
                    <th className="px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase">
                      Date
                    </th>
                    <th className="px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase">
                      Shift
                    </th>
                    <th className="px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase">
                      Site
                    </th>
                    <th className="px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase text-right">
                      Hours
                    </th>
                    <th className="px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase text-right">
                      Loads
                    </th>
                    <th className="px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase text-right">
                      Haul BCM
                    </th>
                    <th className="px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase text-right">
                      Dozer Roll-over BCM
                    </th>
                    <th className="px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase text-right">
                      Total BCM
                    </th>
                    <th className="px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase text-right">
                      Delay (min)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-default)]">
                  {archivedData.historicalRows.map((row) => (
                    <tr
                      key={`arch-${row.id}`}
                      className="hover:bg-[var(--bg-tertiary)]/60 transition-colors"
                    >
                      <td className="px-5 py-3 text-sm font-mono text-[var(--text-heading)]">
                        {row.date}
                      </td>
                      <td className="px-5 py-3">
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--bg-tertiary)] text-[var(--text-secondary)] uppercase">
                          {row.shift}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-sm text-[var(--text-secondary)]">
                        {row.site || 'All Sites'}
                      </td>
                      <td className="px-5 py-3 text-sm font-mono text-right text-[var(--text-heading)]">
                        {row.hours.toFixed(1)}h
                      </td>
                      <td className="px-5 py-3 text-sm font-mono text-right text-[var(--accent-blue)]">
                        {row.loads.toLocaleString()}
                      </td>
                      <td className="px-5 py-3 text-sm font-mono text-right text-[var(--text-secondary)]">
                        {Number(row.haulBcm.toFixed(1)).toLocaleString()}
                      </td>
                      <td className="px-5 py-3 text-sm font-mono text-right text-[var(--accent-blue)]">
                        {Number(row.dozerRolloverBcm.toFixed(1)).toLocaleString()}
                      </td>
                      <td className="px-5 py-3 text-sm font-mono text-right text-accent-green font-semibold">
                        {Number(row.totalBcm.toFixed(1)).toLocaleString()}
                      </td>
                      <td className="px-5 py-3 text-sm font-mono text-right text-[var(--text-secondary)]">
                        {row.delayMin}
                      </td>
                    </tr>
                  ))}
                  {archivedData.historicalRows.length === 0 && (
                    <tr>
                      <td
                        colSpan={9}
                        className="px-6 py-10 text-center text-sm text-[var(--text-muted)]"
                      >
                        No archived records found for this date range.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════════
          SUBTAB 4: PDF REPORT (Site-Grouped Shift Report PDF Preview)
          Order per Site: 1. Excavators First -> 2. Roll Over -> 3. Machines Worked on Site
         ═══════════════════════════════════════════════════════════════════════════ */}
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
    </div>
  );
}
