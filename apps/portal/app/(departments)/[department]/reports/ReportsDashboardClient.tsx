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
import type { MachineOperationLogItem } from './reports-types';
import { buildPdfSiteGroups, ShiftPdfReportTab } from './ShiftPdfReportTab';

export type { MachineOperationLogItem } from './reports-types';

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
          className="no-print flex items-start gap-2.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-amber-800 text-xs"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div>
            <p className="font-semibold">Partial Data Warning — Database Query Issue</p>
            <p className="mt-0.5 font-mono text-[11px]">{queryWarnings.join(' · ')}</p>
          </div>
        </div>
      )}
      {/* Executive & Operator Live Header */}
      <GlassCard className="no-print p-5">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="font-bold text-2xl text-[var(--text-heading)]">
                {departmentName} Reports &amp; Live Intelligence
              </h2>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-green/20 bg-accent-green/10 px-2.5 py-0.5 font-semibold text-accent-green text-xs">
                <Radio className="h-3.5 w-3.5 animate-pulse" />
                Live Telemetry &amp; Logs
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--accent-blue)]/20 bg-[var(--accent-blue)]/10 px-2.5 py-0.5 font-medium text-[var(--accent-blue)] text-xs">
                {currentShift === 'day' ? (
                  <Sun className="h-3.5 w-3.5" />
                ) : (
                  <Moon className="h-3.5 w-3.5" />
                )}
                Active Shift: {currentShift.toUpperCase()} ({todayStr})
              </span>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Live Stats KPI Grid with Visual Indicators */}
      <div className="no-print grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {/* 1. Total Volume Moved (BCM) */}
        <GlassCard className="flex flex-col justify-between p-4">
          <div>
            <div className="flex items-center justify-between">
              <span className="font-medium text-[var(--text-muted)] text-xs">
                Total Volume (BCM)
              </span>
              <Layers className="h-4 w-4 text-[var(--accent-blue)]" />
            </div>
            <p className="mt-1.5 font-bold font-mono text-2xl text-[var(--text-heading)]">
              {Number(kpiStats.totalBcm.toFixed(1)).toLocaleString()}
            </p>
          </div>
          <div className="mt-3 space-y-1.5">
            <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-tertiary)]">
              <div
                className="h-full bg-[var(--accent-blue)] transition-all"
                style={{
                  width: `${kpiStats.totalBcm > 0 ? Math.round((kpiStats.totalHaulBcm / kpiStats.totalBcm) * 100) : 50}%`,
                }}
              />
              <div
                className="h-full bg-accent-green transition-all"
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
        <GlassCard className="flex flex-col justify-between p-4">
          <div>
            <div className="flex items-center justify-between">
              <span className="font-medium text-[var(--text-muted)] text-xs">Total Haul Loads</span>
              <Truck className="h-4 w-4 text-[var(--accent-blue)]" />
            </div>
            <p className="mt-1.5 font-bold font-mono text-2xl text-[var(--accent-blue)]">
              {kpiStats.totalLoads.toLocaleString()}
            </p>
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px]">
            <span className="text-[var(--text-muted)]">Today&apos;s Loads:</span>
            <span className="font-mono font-semibold text-[var(--text-heading)]">
              {kpiStats.todayLoads.toLocaleString()} loads
            </span>
          </div>
        </GlassCard>

        {/* 3. Operating Hours & Efficiency */}
        <GlassCard className="flex flex-col justify-between p-4">
          <div>
            <div className="flex items-center justify-between">
              <span className="font-medium text-[var(--text-muted)] text-xs">Operating Hours</span>
              <Clock className="h-4 w-4 text-accent-green" />
            </div>
            <p className="mt-1.5 font-bold font-mono text-2xl text-accent-green">
              {kpiStats.totalHours.toFixed(1)}h
            </p>
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px]">
            <span className="text-[var(--text-muted)]">Efficiency Rate:</span>
            <span className="font-mono font-semibold text-[var(--accent-blue)]">
              {kpiStats.bcmPerHour.toFixed(1)} BCM/h
            </span>
          </div>
        </GlassCard>

        {/* 4. Dozer Roll-over Fixed Calculation */}
        <GlassCard className="flex flex-col justify-between p-4">
          <div>
            <div className="flex items-center justify-between">
              <span className="font-medium text-[var(--text-muted)] text-xs">
                Dozer Roll-over (250/h)
              </span>
              <BarChart3 className="h-4 w-4 text-[var(--accent-blue)]" />
            </div>
            <p className="mt-1.5 font-bold font-mono text-2xl text-[var(--text-heading)]">
              {Number(kpiStats.totalDozerBcm.toFixed(1)).toLocaleString()}{' '}
              <span className="font-normal text-[var(--text-muted)] text-xs">BCM</span>
            </p>
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px]">
            <span className="text-[var(--text-muted)]">Blade Passes:</span>
            <span className="font-mono font-semibold text-[var(--text-heading)]">
              {kpiStats.totalPasses.toLocaleString()}
            </span>
          </div>
        </GlassCard>

        {/* 5. Delays & Engineering Health */}
        <GlassCard className="flex flex-col justify-between p-4">
          <div>
            <div className="flex items-center justify-between">
              <span className="font-medium text-[var(--text-muted)] text-xs">
                Delays &amp; Breakdowns
              </span>
              <Wrench className="h-4 w-4 text-accent-red" />
            </div>
            <p className="mt-1.5 font-bold font-mono text-2xl text-[var(--text-heading)]">
              {kpiStats.totalDelayMin.toLocaleString()}{' '}
              <span className="font-normal text-[var(--text-muted)] text-xs">min</span>
            </p>
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px]">
            <span className="font-medium text-accent-red">{kpiStats.openIssues} Open</span>
            <span className="font-medium text-accent-green">
              {kpiStats.resolvedIssues} Resolved
            </span>
          </div>
        </GlassCard>

        {/* 6. Shift Coverage Completeness */}
        <GlassCard className="flex flex-col justify-between p-4">
          <div>
            <div className="flex items-center justify-between">
              <span className="font-medium text-[var(--text-muted)] text-xs">Shift Coverage</span>
              <Activity className="h-4 w-4 text-accent-green" />
            </div>
            <div className="mt-1.5 flex items-baseline justify-between">
              <p className="font-bold font-mono text-2xl text-[var(--text-heading)]">
                {kpiStats.coveragePct}%
              </p>
              <span className="text-[var(--text-muted)] text-xs">
                {coveredFleetCount}/{totalFleetCount} units
              </span>
            </div>
          </div>
          <div className="mt-3 space-y-1.5">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-tertiary)]">
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
                className="w-full text-left text-[11px] text-[var(--accent-blue)] hover:underline"
              >
                {showMissingMachines
                  ? 'Hide pending machines'
                  : `${missingCoverage.length} pending shift entries →`}
              </button>
            ) : (
              <span className="flex items-center gap-1 text-[11px] text-accent-green">
                <CheckCircle2 className="h-3 w-3" /> All machines logged
              </span>
            )}
          </div>
        </GlassCard>
      </div>

      {/* Optional Expandable Pending Shift Coverage Drawer (Non-blocking!) */}
      {showMissingMachines && missingCoverage.length > 0 && (
        <GlassCard className="no-print space-y-3 border-[var(--accent-blue)]/30 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-[var(--accent-blue)]" />
              <p className="font-medium text-[var(--text-heading)] text-sm">
                Pending Shift Entries ({missingCoverage.length} machines for {currentShift} shift)
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowMissingMachines(false)}
              className="text-[var(--text-muted)] text-xs hover:text-[var(--text-heading)]"
            >
              Close
            </button>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {missingCoverage.map((s) => (
              <div
                key={s.machineId}
                className="flex items-center justify-between rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2"
              >
                <div>
                  <p className="font-medium text-[var(--text-heading)] text-xs">{s.machineName}</p>
                  <p className="text-[11px] text-[var(--text-muted)]">{s.machineType}</p>
                </div>
                <Link
                  href={s.formPath}
                  className="font-medium text-[var(--accent-blue)] text-xs hover:underline"
                >
                  Log →
                </Link>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Subtabs Navigation: Shift | Day | Archived + Filter Controls */}
      <div className="no-print flex flex-col justify-between gap-4 border-[var(--border-default)] border-b pb-3 md:flex-row md:items-center">
        <div
          role="tablist"
          aria-label="Report Views"
          className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-1.5"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'shift'}
            onClick={() => handleSelectTab('shift')}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 font-semibold text-sm transition-all ${
              activeTab === 'shift'
                ? 'bg-[var(--accent-blue)] text-[var(--bg-secondary)] shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-heading)]'
            }`}
          >
            <Clock className="h-4 w-4" />
            Shift
            <span
              className={`rounded-full px-1.5 py-0.2 text-xs ${
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
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 font-semibold text-sm transition-all ${
              activeTab === 'day'
                ? 'bg-[var(--accent-blue)] text-[var(--bg-secondary)] shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-heading)]'
            }`}
          >
            <Calendar className="h-4 w-4" />
            Day
            <span
              className={`rounded-full px-1.5 py-0.2 text-xs ${
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
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 font-semibold text-sm transition-all ${
              activeTab === 'archived'
                ? 'bg-[var(--accent-blue)] text-[var(--bg-secondary)] shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-heading)]'
            }`}
          >
            <Archive className="h-4 w-4" />
            Archived
            <span
              className={`rounded-full px-1.5 py-0.2 text-xs ${
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
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 font-semibold text-sm transition-all ${
              activeTab === 'pdf-report'
                ? 'bg-[var(--accent-blue)] text-[var(--bg-secondary)] shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-heading)]'
            }`}
          >
            <FileText className="h-4 w-4" />
            PDF Report
            <span
              className={`rounded-full px-1.5 py-0.2 text-xs ${
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
            <div className="inline-flex items-center rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] p-1">
              {(['all', 'day', 'night'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setShiftFilter(s)}
                  className={`rounded-md px-3 py-1 font-medium text-xs transition-colors ${
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
              className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-1.5 text-[var(--text-heading)] text-xs focus:border-[var(--accent-blue)] focus:outline-none"
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
            <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search machine, site, date..."
              className="w-48 rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] py-1.5 pr-3 pl-8 text-[var(--text-heading)] text-xs placeholder:text-[var(--text-muted)] focus:border-[var(--accent-blue)] focus:outline-none sm:w-56"
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
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Day vs Night Shift Visual Indicator Card */}
            <GlassCard className="space-y-4 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-[var(--text-heading)] text-base">
                    Shift Performance Split (Day vs Night)
                  </h3>
                  <p className="text-[var(--text-muted)] text-xs">
                    Visual comparison of volume moved, haul loads, and operating hours by shift
                  </p>
                </div>
                <span className="font-mono font-semibold text-[var(--accent-blue)] text-xs">
                  {Number(
                    (shiftComparison.dayBcm + shiftComparison.nightBcm).toFixed(1)
                  ).toLocaleString()}{' '}
                  BCM
                </span>
              </div>

              {/* Visual Split Bar */}
              <div className="space-y-2">
                <div className="flex h-3 w-full overflow-hidden rounded-full bg-[var(--bg-tertiary)]">
                  <div
                    className="h-full bg-[var(--accent-blue)] transition-all"
                    style={{ width: `${shiftComparison.dayPct}%` }}
                    title={`Day Shift: ${shiftComparison.dayPct}%`}
                  />
                  <div
                    className="h-full bg-indigo-500 transition-all"
                    style={{ width: `${shiftComparison.nightPct}%` }}
                    title={`Night Shift: ${shiftComparison.nightPct}%`}
                  />
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 font-medium text-[var(--accent-blue)]">
                    <Sun className="h-3.5 w-3.5" />
                    Day Shift ({shiftComparison.dayPct}%)
                  </span>
                  <span className="flex items-center gap-1.5 font-medium text-indigo-500">
                    <Moon className="h-3.5 w-3.5" />
                    Night Shift ({shiftComparison.nightPct}%)
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 border-[var(--border-default)] border-t pt-2">
                <div className="space-y-1 rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3">
                  <p className="font-medium text-[var(--accent-blue)] text-xs">Day Shift Totals</p>
                  <p className="font-bold font-mono text-[var(--text-heading)] text-lg">
                    {Number(shiftComparison.dayBcm.toFixed(1)).toLocaleString()} BCM
                  </p>
                  <p className="text-[var(--text-muted)] text-xs">
                    {shiftComparison.dayLoads.toLocaleString()} loads ·{' '}
                    {shiftComparison.dayHours.toFixed(1)}h · {shiftComparison.dayDelays}m delay
                  </p>
                </div>
                <div className="space-y-1 rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3">
                  <p className="font-medium text-indigo-500 text-xs">Night Shift Totals</p>
                  <p className="font-bold font-mono text-[var(--text-heading)] text-lg">
                    {Number(shiftComparison.nightBcm.toFixed(1)).toLocaleString()} BCM
                  </p>
                  <p className="text-[var(--text-muted)] text-xs">
                    {shiftComparison.nightLoads.toLocaleString()} loads ·{' '}
                    {shiftComparison.nightHours.toFixed(1)}h · {shiftComparison.nightDelays}m delay
                  </p>
                </div>
              </div>
            </GlassCard>

            {/* Site Production Visual Indicators Card */}
            <GlassCard className="space-y-4 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-[var(--text-heading)] text-base">
                    Site Volume &amp; Productivity Indicators
                  </h3>
                  <p className="text-[var(--text-muted)] text-xs">
                    Live production distribution across active pit &amp; stockpile sites
                  </p>
                </div>
                <span className="text-[var(--text-muted)] text-xs">
                  {siteBreakdown.length} active site{siteBreakdown.length === 1 ? '' : 's'}
                </span>
              </div>

              <div className="max-h-52 space-y-3 overflow-y-auto pr-1">
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
                    <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--bg-tertiary)]">
                      <div
                        className="h-full rounded-full bg-[var(--accent-blue)] transition-all"
                        style={{ width: `${Math.max(s.pct, 4)}%` }}
                      />
                    </div>
                  </div>
                ))}
                {siteBreakdown.length === 0 && (
                  <p className="py-6 text-center text-[var(--text-muted)] text-xs">
                    No site shift data for the current filter.
                  </p>
                )}
              </div>
            </GlassCard>
          </div>

          {/* Shift Production Logs Table */}
          <GlassCard className="overflow-hidden p-0">
            <div className="flex items-center justify-between border-[var(--border-default)] border-b px-6 py-4">
              <div>
                <h3 className="font-semibold text-[var(--text-heading)] text-base">
                  Shift Production &amp; Roll-over Logs
                </h3>
                <p className="text-[var(--text-muted)] text-xs">
                  Per-shift breakdown of operating hours, haul loads, excavator BCM, Dozer roll-over
                  (Hours &times; 250), and delays
                </p>
              </div>
              <span className="font-mono text-[var(--text-muted)] text-xs">
                {filteredShiftRows.length} shift record{filteredShiftRows.length === 1 ? '' : 's'}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-[var(--border-default)] border-b bg-[var(--bg-secondary)]/60">
                    <th className="px-5 py-3 font-semibold text-[var(--text-muted)] text-xs uppercase">
                      Date
                    </th>
                    <th className="px-5 py-3 font-semibold text-[var(--text-muted)] text-xs uppercase">
                      Shift
                    </th>
                    <th className="px-5 py-3 font-semibold text-[var(--text-muted)] text-xs uppercase">
                      Site
                    </th>
                    <th className="px-5 py-3 text-right font-semibold text-[var(--text-muted)] text-xs uppercase">
                      Hours
                    </th>
                    <th className="px-5 py-3 text-right font-semibold text-[var(--text-muted)] text-xs uppercase">
                      Loads
                    </th>
                    <th className="px-5 py-3 text-right font-semibold text-[var(--text-muted)] text-xs uppercase">
                      Haul BCM
                    </th>
                    <th className="px-5 py-3 text-right font-semibold text-[var(--text-muted)] text-xs uppercase">
                      Roll-over BCM
                    </th>
                    <th className="px-5 py-3 text-right font-semibold text-[var(--text-muted)] text-xs uppercase">
                      Total BCM
                    </th>
                    <th className="px-5 py-3 text-right font-semibold text-[var(--text-muted)] text-xs uppercase">
                      Delay (min)
                    </th>
                    <th className="px-5 py-3 text-right font-semibold text-[var(--text-muted)] text-xs uppercase">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-default)]">
                  {filteredShiftRows.map((row) => (
                    <tr key={row.id} className="transition-colors hover:bg-[var(--bg-tertiary)]/60">
                      <td className="px-5 py-3.5 font-mono text-[var(--text-heading)] text-sm">
                        {row.date}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-medium text-xs ${
                            row.shift === 'day'
                              ? 'bg-[var(--accent-blue)]/10 text-[var(--accent-blue)]'
                              : 'bg-indigo-500/10 text-indigo-500'
                          }`}
                        >
                          {row.shift === 'day' ? (
                            <Sun className="h-3 w-3" />
                          ) : (
                            <Moon className="h-3 w-3" />
                          )}
                          {row.shift.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-sm">
                        {row.site && row.site !== '—' ? (
                          <span className="inline-flex rounded border border-[var(--accent-blue)]/20 bg-[var(--accent-blue)]/10 px-2 py-0.5 font-medium text-[var(--accent-blue)] text-xs">
                            {row.site}
                          </span>
                        ) : (
                          <span className="text-[var(--text-muted)] text-xs">All Sites</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono text-[var(--text-heading)] text-sm">
                        {row.hours.toFixed(1)}h
                      </td>
                      <td className="px-5 py-3.5 text-right font-medium font-mono text-[var(--accent-blue)] text-sm">
                        {row.loads.toLocaleString()}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono text-[var(--text-secondary)] text-sm">
                        {Number(row.haulBcm.toFixed(1)).toLocaleString()}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono text-[var(--accent-blue)] text-sm">
                        {Number(row.dozerRolloverBcm.toFixed(1)).toLocaleString()}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono font-semibold text-accent-green text-sm">
                        {Number(row.totalBcm.toFixed(1)).toLocaleString()}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono text-[var(--text-secondary)] text-sm">
                        {row.delayMin}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium text-xs ${
                            row.delayMin > 120
                              ? 'bg-accent-red/10 text-accent-red'
                              : 'bg-accent-green/10 text-accent-green'
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
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
                        className="px-6 py-10 text-center text-[var(--text-muted)] text-sm"
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
            <div className="flex items-center justify-between border-[var(--border-default)] border-b px-6 py-4">
              <div>
                <h3 className="font-semibold text-[var(--text-heading)] text-base">
                  Machine Operations &amp; SMR Shift Log
                </h3>
                <p className="text-[var(--text-muted)] text-xs">
                  Individual machine SMR readings, operator assignments, and calculated output
                </p>
              </div>
              <span className="font-mono text-[var(--text-muted)] text-xs">
                {filteredMachineOps.length} operation{filteredMachineOps.length === 1 ? '' : 's'}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-[var(--border-default)] border-b bg-[var(--bg-secondary)]/60">
                    <th className="px-5 py-3 font-semibold text-[var(--text-muted)] text-xs uppercase">
                      Date &amp; Shift
                    </th>
                    <th className="px-5 py-3 font-semibold text-[var(--text-muted)] text-xs uppercase">
                      Machine
                    </th>
                    <th className="px-5 py-3 font-semibold text-[var(--text-muted)] text-xs uppercase">
                      Operator
                    </th>
                    <th className="px-5 py-3 font-semibold text-[var(--text-muted)] text-xs uppercase">
                      Site
                    </th>
                    <th className="px-5 py-3 text-right font-semibold text-[var(--text-muted)] text-xs uppercase">
                      Start SMR
                    </th>
                    <th className="px-5 py-3 text-right font-semibold text-[var(--text-muted)] text-xs uppercase">
                      Stop SMR
                    </th>
                    <th className="px-5 py-3 text-right font-semibold text-[var(--text-muted)] text-xs uppercase">
                      Hours Worked
                    </th>
                    <th className="px-5 py-3 text-right font-semibold text-[var(--text-muted)] text-xs uppercase">
                      Volume / Roll-over
                    </th>
                    <th className="px-5 py-3 text-right font-semibold text-[var(--text-muted)] text-xs uppercase">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-default)]">
                  {filteredMachineOps.slice(0, 50).map((op) => (
                    <tr key={op.id} className="transition-colors hover:bg-[var(--bg-tertiary)]/60">
                      <td className="px-5 py-3 font-mono text-[var(--text-heading)] text-xs">
                        {op.date} · <span className="uppercase">{op.shift}</span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-[var(--text-heading)] text-sm">
                            {op.machineName}
                          </span>
                          <span className="rounded bg-[var(--bg-tertiary)] px-1.5 py-0.5 text-[var(--text-muted)] text-xs">
                            {op.machineType}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-[var(--text-secondary)] text-sm">
                        {op.operatorName}
                      </td>
                      <td className="px-5 py-3 text-[var(--text-secondary)] text-sm">
                        {op.siteName}
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-[var(--text-secondary)] text-sm">
                        {op.startSmu != null ? op.startSmu.toFixed(1) : '—'}
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-[var(--text-secondary)] text-sm">
                        {op.endSmu != null ? op.endSmu.toFixed(1) : '—'}
                      </td>
                      <td className="px-5 py-3 text-right font-medium font-mono text-accent-green text-sm">
                        {op.hoursWorked.toFixed(2)}h
                      </td>
                      <td className="px-5 py-3 text-right font-medium font-mono text-[var(--accent-blue)] text-sm">
                        {op.isDozer
                          ? `${Number(op.bcmMoved.toFixed(1)).toLocaleString()} BCM (Roll-over)`
                          : op.bcmMoved > 0
                            ? `${Number(op.bcmMoved.toFixed(1)).toLocaleString()} BCM`
                            : '—'}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium text-xs ${
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
                        className="px-6 py-8 text-center text-[var(--text-muted)] text-sm"
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
              <div className="flex items-center justify-between border-[var(--border-default)] border-b px-6 py-4">
                <div>
                  <h3 className="font-semibold text-[var(--text-heading)] text-base">
                    Engineering Breakdowns &amp; Department Activity Logs
                  </h3>
                  <p className="text-[var(--text-muted)] text-xs">
                    Cross-department engineering faults, repairs, and shift logs
                  </p>
                </div>
                <span className="font-mono text-[var(--text-muted)] text-xs">
                  {filteredEngineeringLogs.length} item
                  {filteredEngineeringLogs.length === 1 ? '' : 's'}
                </span>
              </div>
              <div className="divide-y divide-[var(--border-default)]">
                {filteredEngineeringLogs.slice(0, 20).map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col justify-between gap-2 px-6 py-3.5 transition-colors hover:bg-[var(--bg-tertiary)]/50 sm:flex-row sm:items-center"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded px-2 py-0.5 font-medium text-xs ${
                            item.source === 'breakdown'
                              ? 'border border-accent-red/20 bg-accent-red/10 text-accent-red'
                              : 'border border-[var(--accent-blue)]/20 bg-[var(--accent-blue)]/10 text-[var(--accent-blue)]'
                          }`}
                        >
                          {item.source === 'breakdown'
                            ? 'Breakdown'
                            : item.source === 'daily_log'
                              ? 'Engineering Log'
                              : 'Engineering Note'}
                        </span>
                        <span className="font-semibold text-[var(--text-heading)] text-sm">
                          {item.machineName}
                        </span>
                        <span className="font-mono text-[var(--text-muted)] text-xs">
                          {item.date} · {item.shift.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-[var(--text-heading)] text-sm">{item.description}</p>
                      {item.actionTaken && (
                        <p className="text-[var(--text-secondary)] text-xs">
                          <strong className="text-[var(--accent-blue)]">Action:</strong>{' '}
                          {item.actionTaken}
                        </p>
                      )}
                    </div>
                    <span
                      className={`shrink-0 self-start rounded-full px-2.5 py-0.5 font-medium text-xs sm:self-center ${
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
          <GlassCard className="space-y-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-semibold text-[var(--text-heading)] text-base">
                  Daily Consolidated Production Trend (Day + Night Combined)
                </h3>
                <p className="text-[var(--text-muted)] text-xs">
                  Visual daily volume comparison (Haul BCM + Dozer Roll-over BCM) for CEO &amp;
                  Operational review
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5 text-[var(--accent-blue)]">
                  <span className="h-2.5 w-2.5 rounded-sm bg-[var(--accent-blue)]" />
                  Haul / Excavator BCM
                </span>
                <span className="flex items-center gap-1.5 text-accent-green">
                  <span className="h-2.5 w-2.5 rounded-sm bg-accent-green" />
                  Dozer Roll-over BCM (Hours &times; 250)
                </span>
              </div>
            </div>

            <div className="max-h-72 space-y-2.5 overflow-y-auto pr-1">
              {dailyAggregatedRows.slice(0, 14).map((d) => {
                const haulRatio = d.totalBcm > 0 ? (d.haulBcm / d.totalBcm) * d.bcmPct : 0;
                const dozerRatio =
                  d.totalBcm > 0 ? (d.dozerRolloverBcm / d.totalBcm) * d.bcmPct : 0;
                return (
                  <div key={d.date} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium font-mono text-[var(--text-heading)]">
                        {d.date}
                        {d.date === todayStr && (
                          <span className="ml-2 rounded bg-accent-green/10 px-1.5 py-0.5 text-[10px] text-accent-green">
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
                    <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-[var(--bg-tertiary)]">
                      <div
                        className="h-full bg-[var(--accent-blue)] transition-all"
                        style={{ width: `${Math.max(haulRatio, d.haulBcm > 0 ? 2 : 0)}%` }}
                      />
                      <div
                        className="h-full bg-accent-green transition-all"
                        style={{
                          width: `${Math.max(dozerRatio, d.dozerRolloverBcm > 0 ? 2 : 0)}%`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
              {dailyAggregatedRows.length === 0 && (
                <p className="py-8 text-center text-[var(--text-muted)] text-xs">
                  No daily production records found.
                </p>
              )}
            </div>
          </GlassCard>

          {/* Daily Consolidated Log Table */}
          <GlassCard className="overflow-hidden p-0">
            <div className="flex items-center justify-between border-[var(--border-default)] border-b px-6 py-4">
              <div>
                <h3 className="font-semibold text-[var(--text-heading)] text-base">
                  Daily Consolidated Operational Log
                </h3>
                <p className="text-[var(--text-muted)] text-xs">
                  Full-day (24h) aggregated metrics combining Day &amp; Night shifts per calendar
                  date
                </p>
              </div>
              <span className="font-mono text-[var(--text-muted)] text-xs">
                {dailyAggregatedRows.length} day{dailyAggregatedRows.length === 1 ? '' : 's'}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-[var(--border-default)] border-b bg-[var(--bg-secondary)]/60">
                    <th className="px-5 py-3 font-semibold text-[var(--text-muted)] text-xs uppercase">
                      Date
                    </th>
                    <th className="px-5 py-3 font-semibold text-[var(--text-muted)] text-xs uppercase">
                      Active Sites
                    </th>
                    <th className="px-5 py-3 text-right font-semibold text-[var(--text-muted)] text-xs uppercase">
                      Total Hours
                    </th>
                    <th className="px-5 py-3 text-right font-semibold text-[var(--text-muted)] text-xs uppercase">
                      Total Loads
                    </th>
                    <th className="px-5 py-3 text-right font-semibold text-[var(--text-muted)] text-xs uppercase">
                      Haul BCM
                    </th>
                    <th className="px-5 py-3 text-right font-semibold text-[var(--text-muted)] text-xs uppercase">
                      Dozer Roll-over BCM
                    </th>
                    <th className="px-5 py-3 text-right font-semibold text-[var(--text-muted)] text-xs uppercase">
                      Total Daily BCM
                    </th>
                    <th className="px-5 py-3 text-right font-semibold text-[var(--text-muted)] text-xs uppercase">
                      BCM / Hour
                    </th>
                    <th className="px-5 py-3 text-right font-semibold text-[var(--text-muted)] text-xs uppercase">
                      Delays (min)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-default)]">
                  {dailyAggregatedRows.map((d) => (
                    <tr key={d.date} className="transition-colors hover:bg-[var(--bg-tertiary)]/60">
                      <td className="px-5 py-3.5 font-medium font-mono text-[var(--text-heading)] text-sm">
                        {d.date}
                      </td>
                      <td className="px-5 py-3.5 text-[var(--text-secondary)] text-xs">
                        {d.siteList.length > 0 ? d.siteList.join(', ') : 'All Sites'} (
                        {d.shiftCount} shift{d.shiftCount === 1 ? '' : 's'})
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono text-[var(--text-heading)] text-sm">
                        {d.hours.toFixed(1)}h
                      </td>
                      <td className="px-5 py-3.5 text-right font-medium font-mono text-[var(--accent-blue)] text-sm">
                        {d.loads.toLocaleString()}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono text-[var(--text-secondary)] text-sm">
                        {Number(d.haulBcm.toFixed(1)).toLocaleString()}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono text-[var(--accent-blue)] text-sm">
                        {Number(d.dozerRolloverBcm.toFixed(1)).toLocaleString()}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono font-semibold text-accent-green text-sm">
                        {Number(d.totalBcm.toFixed(1)).toLocaleString()}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono text-[var(--accent-blue)] text-sm">
                        {d.bcmPerHour.toFixed(1)}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono text-[var(--text-secondary)] text-sm">
                        {d.delayMin}
                      </td>
                    </tr>
                  ))}
                  {dailyAggregatedRows.length === 0 && (
                    <tr>
                      <td
                        colSpan={9}
                        className="px-6 py-10 text-center text-[var(--text-muted)] text-sm"
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
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
              <div>
                <h3 className="font-semibold text-[var(--text-heading)] text-base">
                  Archived &amp; Historical Period Query
                </h3>
                <p className="text-[var(--text-muted)] text-xs">
                  Select a historical date range to inspect archived shift logs and monthly
                  production rollups
                </p>
              </div>
              <form method="GET" className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="mb-1 block text-[var(--text-muted)] text-xs">From Date</label>
                  <Input
                    type="date"
                    name="from"
                    defaultValue={fromDateStr}
                    className="px-3 py-1.5"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[var(--text-muted)] text-xs">To Date</label>
                  <Input type="date" name="to" defaultValue={toDateStr} className="px-3 py-1.5" />
                </div>
                <button
                  type="submit"
                  className="rounded-lg bg-[var(--accent-blue)] px-4 py-2 font-semibold text-[var(--bg-secondary)] text-xs transition-colors hover:bg-[var(--accent-blue)]/90"
                >
                  Load Archive Range
                </button>
              </form>
            </div>
          </GlassCard>

          {/* Monthly Archive Rollup Cards */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {archivedData.monthlyRollups.map((m) => (
              <GlassCard key={m.month} className="space-y-3 p-4">
                <div className="flex items-center justify-between">
                  <span className="font-bold font-mono text-[var(--text-heading)] text-sm">
                    Period: {m.month}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 font-medium text-[11px] ${
                      m.month === currentMonthPrefix
                        ? 'bg-[var(--accent-blue)]/10 text-[var(--accent-blue)]'
                        : 'bg-accent-green/10 text-accent-green'
                    }`}
                  >
                    {m.month === currentMonthPrefix ? 'Current Period' : 'Archived Period'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg bg-[var(--bg-secondary)] p-2.5">
                    <p className="text-[var(--text-muted)]">Total Volume</p>
                    <p className="mt-0.5 font-bold font-mono text-accent-green text-base">
                      {Number(m.totalBcm.toFixed(1)).toLocaleString()} BCM
                    </p>
                  </div>
                  <div className="rounded-lg bg-[var(--bg-secondary)] p-2.5">
                    <p className="text-[var(--text-muted)]">Haul Loads</p>
                    <p className="mt-0.5 font-bold font-mono text-[var(--accent-blue)] text-base">
                      {m.loads.toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-lg bg-[var(--bg-secondary)] p-2.5">
                    <p className="text-[var(--text-muted)]">Dozer Roll-over</p>
                    <p className="mt-0.5 font-mono font-semibold text-[var(--text-heading)] text-sm">
                      {Number(m.dozerRolloverBcm.toFixed(1)).toLocaleString()} BCM
                    </p>
                  </div>
                  <div className="rounded-lg bg-[var(--bg-secondary)] p-2.5">
                    <p className="text-[var(--text-muted)]">Operating Hours</p>
                    <p className="mt-0.5 font-mono font-semibold text-[var(--text-heading)] text-sm">
                      {m.hours.toFixed(1)}h ({m.shiftCount} shifts)
                    </p>
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>

          {/* Full Historical / Archived Shift Register */}
          <GlassCard className="overflow-hidden p-0">
            <div className="flex items-center justify-between border-[var(--border-default)] border-b px-6 py-4">
              <div>
                <h3 className="font-semibold text-[var(--text-heading)] text-base">
                  Archived Shift &amp; Production Register ({fromDateStr} — {toDateStr})
                </h3>
                <p className="text-[var(--text-muted)] text-xs">
                  Complete immutable historical log for executive auditing and compliance export
                </p>
              </div>
              <span className="font-mono text-[var(--text-muted)] text-xs">
                {archivedData.historicalRows.length} archived record
                {archivedData.historicalRows.length === 1 ? '' : 's'}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-[var(--border-default)] border-b bg-[var(--bg-secondary)]/60">
                    <th className="px-5 py-3 font-semibold text-[var(--text-muted)] text-xs uppercase">
                      Date
                    </th>
                    <th className="px-5 py-3 font-semibold text-[var(--text-muted)] text-xs uppercase">
                      Shift
                    </th>
                    <th className="px-5 py-3 font-semibold text-[var(--text-muted)] text-xs uppercase">
                      Site
                    </th>
                    <th className="px-5 py-3 text-right font-semibold text-[var(--text-muted)] text-xs uppercase">
                      Hours
                    </th>
                    <th className="px-5 py-3 text-right font-semibold text-[var(--text-muted)] text-xs uppercase">
                      Loads
                    </th>
                    <th className="px-5 py-3 text-right font-semibold text-[var(--text-muted)] text-xs uppercase">
                      Haul BCM
                    </th>
                    <th className="px-5 py-3 text-right font-semibold text-[var(--text-muted)] text-xs uppercase">
                      Dozer Roll-over BCM
                    </th>
                    <th className="px-5 py-3 text-right font-semibold text-[var(--text-muted)] text-xs uppercase">
                      Total BCM
                    </th>
                    <th className="px-5 py-3 text-right font-semibold text-[var(--text-muted)] text-xs uppercase">
                      Delay (min)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-default)]">
                  {archivedData.historicalRows.map((row) => (
                    <tr
                      key={`arch-${row.id}`}
                      className="transition-colors hover:bg-[var(--bg-tertiary)]/60"
                    >
                      <td className="px-5 py-3 font-mono text-[var(--text-heading)] text-sm">
                        {row.date}
                      </td>
                      <td className="px-5 py-3">
                        <span className="inline-flex rounded-full bg-[var(--bg-tertiary)] px-2 py-0.5 font-medium text-[var(--text-secondary)] text-xs uppercase">
                          {row.shift}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-[var(--text-secondary)] text-sm">
                        {row.site || 'All Sites'}
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-[var(--text-heading)] text-sm">
                        {row.hours.toFixed(1)}h
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-[var(--accent-blue)] text-sm">
                        {row.loads.toLocaleString()}
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-[var(--text-secondary)] text-sm">
                        {Number(row.haulBcm.toFixed(1)).toLocaleString()}
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-[var(--accent-blue)] text-sm">
                        {Number(row.dozerRolloverBcm.toFixed(1)).toLocaleString()}
                      </td>
                      <td className="px-5 py-3 text-right font-mono font-semibold text-accent-green text-sm">
                        {Number(row.totalBcm.toFixed(1)).toLocaleString()}
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-[var(--text-secondary)] text-sm">
                        {row.delayMin}
                      </td>
                    </tr>
                  ))}
                  {archivedData.historicalRows.length === 0 && (
                    <tr>
                      <td
                        colSpan={9}
                        className="px-6 py-10 text-center text-[var(--text-muted)] text-sm"
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
