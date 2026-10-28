'use client';

import {
  AlertTriangle,
  Calendar,
  Check,
  Clock,
  Copy,
  Database,
  Download,
  FileSpreadsheet,
  Layers,
  MessageSquare,
  Search,
} from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { loadStoredPlantDelays, loadStoredPlantSheets } from './storage';
import {
  calculateRowYield,
  type PlantDailyRollupRecord,
  type PlantDelayEntry,
  type PlantHourlySheetRecord,
  type PlantMonthlyRollupRecord,
} from './types';

interface PlantHistoryDatabaseClientProps {
  initialDate: string;
  initialSheets: PlantHourlySheetRecord[];
  initialDelays: PlantDelayEntry[];
}

export type PlantReportGranularity = 'monthly' | 'daily' | 'hourly' | 'whatsapp';

const GRANULARITY_TAB_BTN_BASE =
  'inline-flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2 font-semibold text-xs transition-all';

const HISTORICAL_DAILY_BASELINE: PlantDailyRollupRecord[] = [
  {
    id: 'daily-2026-10-19-day',
    date: '2026-10-19',
    shift: 'day',
    moduleId: 'DMS-MOD-1',
    romFeedTonnes: 5340,
    cleanCoalTonnes: 4880,
    discardTonnes: 460,
    yieldPct: 91.4,
    avgCycloneRd: 1.48,
    avgMoisturePct: 8.0,
    runHours: 11.5,
    delayMinutes: 30,
    operatorName: 'K. Dlamini (Plant Supervisor)',
  },
  {
    id: 'daily-2026-10-19-night',
    date: '2026-10-19',
    shift: 'night',
    moduleId: 'DMS-MOD-1',
    romFeedTonnes: 5190,
    cleanCoalTonnes: 4712,
    discardTonnes: 478,
    yieldPct: 90.8,
    avgCycloneRd: 1.49,
    avgMoisturePct: 8.1,
    runHours: 11.4,
    delayMinutes: 36,
    operatorName: 'T. Nkosi (Night Metallurgist)',
  },
  {
    id: 'daily-2026-10-18-day',
    date: '2026-10-18',
    shift: 'day',
    moduleId: 'DMS-MOD-1',
    romFeedTonnes: 5480,
    cleanCoalTonnes: 5025,
    discardTonnes: 455,
    yieldPct: 91.7,
    avgCycloneRd: 1.48,
    avgMoisturePct: 7.9,
    runHours: 11.8,
    delayMinutes: 12,
    operatorName: 'S. Mokoena (Plant Control)',
  },
  {
    id: 'daily-2026-09-30-day',
    date: '2026-09-30',
    shift: 'day',
    moduleId: 'DMS-MOD-1',
    romFeedTonnes: 5410,
    cleanCoalTonnes: 4934,
    discardTonnes: 476,
    yieldPct: 91.2,
    avgCycloneRd: 1.48,
    avgMoisturePct: 8.1,
    runHours: 11.6,
    delayMinutes: 24,
    operatorName: 'S. Mokoena (Plant Control)',
  },
];

const HISTORICAL_MONTHLY_BASELINE: PlantMonthlyRollupRecord[] = [
  {
    month: '2026-10',
    monthLabel: 'October 2026 (Current MTD)',
    shiftsLogged: 42,
    romFeedTonnes: 224850,
    cleanCoalTonnes: 205512,
    discardTonnes: 19338,
    yieldPct: 91.4,
    avgCycloneRd: 1.48,
    avgMoisturePct: 8.0,
    totalRunHours: 484.5,
    totalDelayHours: 19.5,
    availabilityPct: 96.1,
  },
  {
    month: '2026-09',
    monthLabel: 'September 2026',
    shiftsLogged: 60,
    romFeedTonnes: 318400,
    cleanCoalTonnes: 289425,
    discardTonnes: 28975,
    yieldPct: 90.9,
    avgCycloneRd: 1.49,
    avgMoisturePct: 8.1,
    totalRunHours: 688.0,
    totalDelayHours: 32.0,
    availabilityPct: 95.6,
  },
  {
    month: '2026-08',
    monthLabel: 'August 2026',
    shiftsLogged: 62,
    romFeedTonnes: 326900,
    cleanCoalTonnes: 295844,
    discardTonnes: 31056,
    yieldPct: 90.5,
    avgCycloneRd: 1.48,
    avgMoisturePct: 8.2,
    totalRunHours: 709.5,
    totalDelayHours: 34.5,
    availabilityPct: 95.4,
  },
  {
    month: '2026-07',
    monthLabel: 'July 2026',
    shiftsLogged: 62,
    romFeedTonnes: 319200,
    cleanCoalTonnes: 287918,
    discardTonnes: 31282,
    yieldPct: 90.2,
    avgCycloneRd: 1.47,
    avgMoisturePct: 8.3,
    totalRunHours: 702.0,
    totalDelayHours: 42.0,
    availabilityPct: 94.4,
  },
];

export function PlantHistoryDatabaseClient({
  initialDate,
  initialSheets,
  initialDelays,
}: PlantHistoryDatabaseClientProps) {
  const searchParams = useSearchParams?.() ?? null;
  const activeTabParam = searchParams?.get?.('tab') ?? null;
  const [granularity, setGranularity] = useState<PlantReportGranularity>(() =>
    activeTabParam === 'whatsapp-report' ? 'whatsapp' : 'daily'
  );
  const [sheets, setSheets] = useState<PlantHourlySheetRecord[]>(initialSheets);
  const [delays, setDelays] = useState<PlantDelayEntry[]>(initialDelays);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [shiftFilter, setShiftFilter] = useState<'ALL' | 'day' | 'night'>('ALL');
  const [copiedWhatsapp, setCopiedWhatsapp] = useState(false);

  useEffect(() => {
    if (activeTabParam === 'whatsapp-report') {
      setGranularity('whatsapp');
    }
  }, [activeTabParam]);

  useEffect(() => {
    setSheets(loadStoredPlantSheets(initialSheets));
    setDelays(loadStoredPlantDelays(initialDelays));
  }, [initialSheets, initialDelays]);

  // Build Daily Rollup rows from saved Hourly Sheets + Historical Daily Baseline
  const dailyRecords = useMemo<PlantDailyRollupRecord[]>(() => {
    const delayMinsByDateShift = new Map<string, number>();
    for (const d of delays) {
      const key = `${d.date}-${d.shift}`;
      delayMinsByDateShift.set(key, (delayMinsByDateShift.get(key) ?? 0) + d.durationMinutes);
    }

    const fromSheets: PlantDailyRollupRecord[] = sheets.map((sheet) => {
      const romFeedTonnes = sheet.rows.reduce((s, r) => s + (Number(r.romFeedTonnes) || 0), 0);
      const cleanCoalTonnes = sheet.rows.reduce((s, r) => s + (Number(r.cleanCoalTonnes) || 0), 0);
      const discardTonnes = sheet.rows.reduce((s, r) => s + (Number(r.discardTonnes) || 0), 0);
      const yieldPct = calculateRowYield(romFeedTonnes, cleanCoalTonnes);
      const avgCycloneRd =
        sheet.rows.length > 0
          ? Number((sheet.rows.reduce((s, r) => s + r.cycloneRd, 0) / sheet.rows.length).toFixed(2))
          : 1.48;
      const avgMoisturePct =
        sheet.rows.length > 0
          ? Number(
              (sheet.rows.reduce((s, r) => s + r.moisturePct, 0) / sheet.rows.length).toFixed(1)
            )
          : 8.0;
      const runMins = sheet.rows.reduce((s, r) => s + (Number(r.runMinutes) || 0), 0);
      const runHours = Number((runMins / 60).toFixed(1));
      const delayMinutes =
        delayMinsByDateShift.get(`${sheet.date}-${sheet.shift}`) ?? Math.max(0, 720 - runMins);

      return {
        id: sheet.id,
        date: sheet.date,
        shift: sheet.shift,
        moduleId: sheet.moduleId,
        romFeedTonnes,
        cleanCoalTonnes,
        discardTonnes,
        yieldPct,
        avgCycloneRd,
        avgMoisturePct,
        runHours,
        delayMinutes,
        operatorName: sheet.operatorName,
      };
    });

    const mergedMap = new Map<string, PlantDailyRollupRecord>();
    for (const item of HISTORICAL_DAILY_BASELINE) {
      mergedMap.set(`${item.date}-${item.shift}-${item.moduleId}`, item);
    }
    for (const item of fromSheets) {
      mergedMap.set(`${item.date}-${item.shift}-${item.moduleId}`, item);
    }

    return Array.from(mergedMap.values()).sort((a, b) => b.date.localeCompare(a.date));
  }, [sheets, delays]);

  // Flatten Hourly rows across all sheets for Hourly Reports view
  const hourlyRecords = useMemo(() => {
    const list: Array<{
      id: string;
      date: string;
      shift: 'day' | 'night';
      moduleId: string;
      hourSlot: string;
      seamSource: string;
      romFeedTonnes: number;
      cleanCoalTonnes: number;
      discardTonnes: number;
      yieldPct: number;
      cycloneRd: number;
      moisturePct: number;
      runMinutes: number;
      notes: string;
    }> = [];

    for (const sheet of sheets) {
      for (const row of sheet.rows) {
        list.push({
          id: `${sheet.id}-r${row.rowNumber}`,
          date: sheet.date,
          shift: sheet.shift,
          moduleId: sheet.moduleId,
          hourSlot: row.hourSlot,
          seamSource: row.seamSource,
          romFeedTonnes: row.romFeedTonnes,
          cleanCoalTonnes: row.cleanCoalTonnes,
          discardTonnes: row.discardTonnes,
          yieldPct: row.yieldPct,
          cycloneRd: row.cycloneRd,
          moisturePct: row.moisturePct,
          runMinutes: row.runMinutes,
          notes: row.notes,
        });
      }
    }
    return list;
  }, [sheets]);

  const whatsappReportText = useMemo(() => {
    const latestDaily = dailyRecords[0];
    if (!latestDaily) {
      return `*ARCH OS — PLANT & PROCESSING SHIFT REPORT*\nDate: ${initialDate}\nNo shift telemetry logged.`;
    }
    const shiftDelays = delays.filter(
      (d) => d.date === latestDaily.date && d.shift === latestDaily.shift
    );
    const delayLines =
      shiftDelays.length > 0
        ? shiftDelays
            .map(
              (d) =>
                `• ${d.startTime}${d.endTime ? `–${d.endTime}` : ' (Active)'} | ${d.circuit}: ${d.reason} (${d.durationMinutes}m)`
            )
            .join('\n')
        : '• Zero unplanned circuit stoppages recorded';

    return [
      `*ARCH OS — PLANT & PROCESSING SHIFT REPORT*`,
      `📅 *Date:* ${latestDaily.date} (${latestDaily.shift.toUpperCase()} SHIFT)`,
      `🏭 *Module:* ${latestDaily.moduleId} | *Operator:* ${latestDaily.operatorName}`,
      ``,
      `*MASS BALANCE & SCALE SUMMARY*`,
      `• *ROM Scale Feed:* ${latestDaily.romFeedTonnes.toLocaleString()} t`,
      `• *New Product Scale (Clean Coal):* ${latestDaily.cleanCoalTonnes.toLocaleString()} t`,
      `• *Discard / Rejects:* ${latestDaily.discardTonnes.toLocaleString()} t`,
      `• *Product Recovery Yield:* ${latestDaily.yieldPct.toFixed(1)}%`,
      `• *Mean Cyclone RD:* ${latestDaily.avgCycloneRd.toFixed(2)} g/cm³ | *Moisture:* ${latestDaily.avgMoisturePct.toFixed(1)}%`,
      `• *Circuit Run / Delay:* ${latestDaily.runHours}h run / ${latestDaily.delayMinutes}m downtime`,
      ``,
      `*PLANT DELAYS & INTERLOCKS*`,
      delayLines,
    ].join('\n');
  }, [dailyRecords, delays, initialDate]);

  const handleCopyWhatsappReport = async () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(whatsappReportText);
      setCopiedWhatsapp(true);
      setTimeout(() => setCopiedWhatsapp(false), 2000);
    }
  };

  const filteredMonthly = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return HISTORICAL_MONTHLY_BASELINE;
    return HISTORICAL_MONTHLY_BASELINE.filter(
      (m) => m.month.toLowerCase().includes(q) || m.monthLabel.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const filteredDaily = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return dailyRecords.filter((r) => {
      if (shiftFilter !== 'ALL' && r.shift !== shiftFilter) return false;
      if (!q) return true;
      return (
        r.date.toLowerCase().includes(q) ||
        r.moduleId.toLowerCase().includes(q) ||
        r.operatorName.toLowerCase().includes(q)
      );
    });
  }, [dailyRecords, shiftFilter, searchQuery]);

  const filteredHourly = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return hourlyRecords.filter((r) => {
      if (shiftFilter !== 'ALL' && r.shift !== shiftFilter) return false;
      if (!q) return true;
      return (
        r.date.toLowerCase().includes(q) ||
        r.hourSlot.toLowerCase().includes(q) ||
        r.seamSource.toLowerCase().includes(q) ||
        r.notes.toLowerCase().includes(q)
      );
    });
  }, [hourlyRecords, shiftFilter, searchQuery]);

  const handleExportReportCsv = () => {
    let csvContent = '';
    if (granularity === 'monthly') {
      csvContent = [
        'Month,Label,Shifts Logged,ROM Feed (t),Clean Coal (t),Discard (t),Yield (%),Avg Cyclone RD,Avg Moisture (%),Run Hours,Delay Hours,Availability (%)',
        ...filteredMonthly.map((m) =>
          [
            m.month,
            `"${m.monthLabel}"`,
            m.shiftsLogged,
            m.romFeedTonnes,
            m.cleanCoalTonnes,
            m.discardTonnes,
            m.yieldPct,
            m.avgCycloneRd,
            m.avgMoisturePct,
            m.totalRunHours,
            m.totalDelayHours,
            m.availabilityPct,
          ].join(',')
        ),
      ].join('\n');
    } else if (granularity === 'daily') {
      csvContent = [
        'Date,Shift,Module,ROM Feed (t),Clean Coal (t),Discard (t),Yield (%),Avg RD,Avg Moisture (%),Run Hours,Delay Mins,Operator',
        ...filteredDaily.map((d) =>
          [
            d.date,
            d.shift,
            d.moduleId,
            d.romFeedTonnes,
            d.cleanCoalTonnes,
            d.discardTonnes,
            d.yieldPct,
            d.avgCycloneRd,
            d.avgMoisturePct,
            d.runHours,
            d.delayMinutes,
            `"${d.operatorName}"`,
          ].join(',')
        ),
      ].join('\n');
    } else {
      csvContent = [
        'Date,Shift,Module,Hour Window,Seam Source,ROM Feed (t/hr),Clean Coal (t/hr),Discard (t/hr),Yield (%),DMS RD,Moisture (%),Run Mins,Notes',
        ...filteredHourly.map((h) =>
          [
            h.date,
            h.shift,
            h.moduleId,
            `"${h.hourSlot}"`,
            `"${h.seamSource}"`,
            h.romFeedTonnes,
            h.cleanCoalTonnes,
            h.discardTonnes,
            h.yieldPct,
            h.cycloneRd,
            h.moisturePct,
            h.runMinutes,
            `"${h.notes.replaceAll('"', '""')}"`,
          ].join(',')
        ),
      ].join('\n');
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `plant-processing-${granularity}-report-${initialDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 p-4 sm:p-6">
      {/* Database Header */}
      <div className="flex flex-col gap-4 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 rounded-md border border-[var(--accent-blue)]/25 bg-[var(--accent-blue)]/10 px-2.5 py-1 font-semibold text-[11px] text-[var(--accent-blue)] uppercase tracking-wider">
            <Database className="h-3.5 w-3.5" />
            Plant &amp; Processing Logged Telemetry Archive
          </div>
          <h1 className="font-bold text-[var(--text-heading)] text-xl tracking-tight sm:text-2xl">
            Plant &amp; Processing — Logged Info &amp; Reports Database
          </h1>
          <p className="text-[var(--text-secondary)] text-xs sm:text-sm">
            Unified historical database of logged wash plant performance across Monthly, Daily, and
            Hourly report granularities.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/plant-processing/hourly-sheet"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 py-2 font-medium text-[var(--text-heading)] text-xs transition-colors hover:bg-black/[0.03]"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-amber-600" />
            Hourly Input Sheet
          </Link>
          <Link
            href="/plant-processing/delays"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 py-2 font-medium text-[var(--text-heading)] text-xs transition-colors hover:bg-black/[0.03]"
          >
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
            Delays Register
          </Link>
          <button
            type="button"
            onClick={handleExportReportCsv}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[var(--accent-blue)] px-3.5 py-2 font-semibold text-white text-xs shadow-sm transition-all hover:opacity-95"
          >
            <Download className="h-3.5 w-3.5" />
            Export {granularity.charAt(0).toUpperCase() + granularity.slice(1)} Report CSV
          </button>
        </div>
      </div>

      {/* Granularity Switcher (Monthly / Daily / Hourly Reports) & Filter Controls */}
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4 shadow-sm md:flex-row md:items-center">
        <div
          className="inline-flex gap-1 rounded-xl border border-[var(--border-default)] bg-[var(--bg-primary)] p-1"
          role="tablist"
          aria-label="Report Granularity Database View"
        >
          <button
            type="button"
            role="tab"
            aria-selected={granularity === 'monthly'}
            onClick={() => setGranularity('monthly')}
            className={`${GRANULARITY_TAB_BTN_BASE} ${
              granularity === 'monthly'
                ? 'bg-[var(--accent-blue)] text-white shadow-sm'
                : 'text-[var(--text-secondary)] hover:bg-black/[0.03] hover:text-[var(--text-heading)]'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            Monthly Reports ({filteredMonthly.length})
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={granularity === 'daily'}
            onClick={() => setGranularity('daily')}
            className={`${GRANULARITY_TAB_BTN_BASE} ${
              granularity === 'daily'
                ? 'bg-[var(--accent-blue)] text-white shadow-sm'
                : 'text-[var(--text-secondary)] hover:bg-black/[0.03] hover:text-[var(--text-heading)]'
            }`}
          >
            <Calendar className="h-3.5 w-3.5" />
            Daily Reports ({filteredDaily.length})
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={granularity === 'hourly'}
            onClick={() => setGranularity('hourly')}
            className={`${GRANULARITY_TAB_BTN_BASE} ${
              granularity === 'hourly'
                ? 'bg-[var(--accent-blue)] text-white shadow-sm'
                : 'text-[var(--text-secondary)] hover:bg-black/[0.03] hover:text-[var(--text-heading)]'
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            Hourly Reports ({filteredHourly.length})
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={granularity === 'whatsapp'}
            onClick={() => setGranularity('whatsapp')}
            className={`${GRANULARITY_TAB_BTN_BASE} ${
              granularity === 'whatsapp'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-[var(--text-secondary)] hover:bg-black/[0.03] hover:text-[var(--text-heading)]'
            }`}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            WhatsApp Report
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {granularity !== 'monthly' && (
            <select
              aria-label="Filter database by shift"
              value={shiftFilter}
              onChange={(e) => setShiftFilter(e.target.value as 'ALL' | 'day' | 'night')}
              className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-heading)] text-xs"
            >
              <option value="ALL">All Shifts (Day &amp; Night)</option>
              <option value="day">Day Shift Only</option>
              <option value="night">Night Shift Only</option>
            </select>
          )}

          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="search"
              aria-label="Search logged database records"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by date, seam, module, or note..."
              className="min-w-[240px] rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] py-2 pr-3 pl-8 text-[var(--text-heading)] text-xs"
            />
          </div>
        </div>
      </div>

      {/* Report Database Table Container */}
      <div className="overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] shadow-sm">
        {granularity === 'monthly' && (
          <div className="overflow-x-auto">
            <table
              className="w-full border-collapse text-left text-xs"
              aria-label="Monthly Plant Reports Database"
            >
              <thead>
                <tr className="border-[var(--border-default)] border-b bg-black/[0.03] font-semibold text-[11px] text-[var(--text-secondary)] uppercase tracking-wider">
                  <th className="px-4 py-3.5">Month Period</th>
                  <th className="px-4 py-3.5 text-right">Shifts Logged</th>
                  <th className="px-4 py-3.5 text-right">ROM Feed (t)</th>
                  <th className="px-4 py-3.5 text-right">Clean Coal (t)</th>
                  <th className="px-4 py-3.5 text-right">Discard (t)</th>
                  <th className="px-4 py-3.5 text-right">Plant Yield (%)</th>
                  <th className="px-4 py-3.5 text-right">Mean RD (g/cm³)</th>
                  <th className="px-4 py-3.5 text-right">Moisture (%)</th>
                  <th className="px-4 py-3.5 text-right">Run / Delay Hrs</th>
                  <th className="px-4 py-3.5 text-right">Availability</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-default)] font-mono">
                {filteredMonthly.map((m) => (
                  <tr key={m.month} className="transition-colors hover:bg-black/[0.015]">
                    <td className="px-4 py-3.5 font-sans">
                      <div className="font-bold text-[var(--text-heading)]">{m.monthLabel}</div>
                      <div className="font-mono text-[11px] text-[var(--text-muted)]">
                        {m.month}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-right">{m.shiftsLogged}</td>
                    <td className="px-4 py-3.5 text-right font-semibold text-[var(--text-heading)]">
                      {m.romFeedTonnes.toLocaleString()}
                    </td>
                    <td className="px-4 py-3.5 text-right font-bold text-emerald-700">
                      {m.cleanCoalTonnes.toLocaleString()}
                    </td>
                    <td className="px-4 py-3.5 text-right text-amber-800">
                      {m.discardTonnes.toLocaleString()}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <span className="inline-block rounded border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 font-bold text-emerald-800">
                        {m.yieldPct.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">{m.avgCycloneRd.toFixed(2)}</td>
                    <td className="px-4 py-3.5 text-right">{m.avgMoisturePct.toFixed(1)}%</td>
                    <td className="px-4 py-3.5 text-right">
                      {m.totalRunHours}h /{' '}
                      <span className="text-amber-700">{m.totalDelayHours}h</span>
                    </td>
                    <td className="px-4 py-3.5 text-right font-bold text-[var(--accent-blue)]">
                      {m.availabilityPct.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {granularity === 'daily' && (
          <div className="overflow-x-auto">
            <table
              className="w-full border-collapse text-left text-xs"
              aria-label="Daily Plant Reports Database"
            >
              <thead>
                <tr className="border-[var(--border-default)] border-b bg-black/[0.03] font-semibold text-[11px] text-[var(--text-secondary)] uppercase tracking-wider">
                  <th className="px-4 py-3.5">Date</th>
                  <th className="px-4 py-3.5">Shift</th>
                  <th className="px-4 py-3.5">Plant Module</th>
                  <th className="px-4 py-3.5 text-right">ROM Feed (t)</th>
                  <th className="px-4 py-3.5 text-right">Clean Coal (t)</th>
                  <th className="px-4 py-3.5 text-right">Discard (t)</th>
                  <th className="px-4 py-3.5 text-right">Yield (%)</th>
                  <th className="px-4 py-3.5 text-right">Avg RD</th>
                  <th className="px-4 py-3.5 text-right">Moisture</th>
                  <th className="px-4 py-3.5 text-right">Run Hrs / Delay</th>
                  <th className="px-4 py-3.5">Logged By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-default)] font-mono">
                {filteredDaily.map((d) => (
                  <tr key={d.id} className="transition-colors hover:bg-black/[0.015]">
                    <td className="px-4 py-3 font-bold text-[var(--text-heading)]">{d.date}</td>
                    <td className="px-4 py-3 uppercase">
                      <span
                        className={`inline-block rounded px-2 py-0.5 font-semibold text-[10px] ${
                          d.shift === 'day'
                            ? 'border border-amber-500/30 bg-amber-500/15 text-amber-800'
                            : 'border border-indigo-500/30 bg-indigo-500/15 text-indigo-800'
                        }`}
                      >
                        {d.shift}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">{d.moduleId}</td>
                    <td className="px-4 py-3 text-right font-semibold text-[var(--text-heading)]">
                      {d.romFeedTonnes.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-700">
                      {d.cleanCoalTonnes.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-amber-800">
                      {d.discardTonnes.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="inline-block rounded border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 font-bold text-emerald-800">
                        {d.yieldPct.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">{d.avgCycloneRd.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right">{d.avgMoisturePct.toFixed(1)}%</td>
                    <td className="px-4 py-3 text-right">
                      {d.runHours}h / <span className="text-amber-700">{d.delayMinutes}m</span>
                    </td>
                    <td className="px-4 py-3 font-sans text-[var(--text-secondary)]">
                      {d.operatorName}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {granularity === 'hourly' && (
          <div className="overflow-x-auto">
            <table
              className="w-full border-collapse text-left text-xs"
              aria-label="Hourly Plant Reports Database"
            >
              <thead>
                <tr className="border-[var(--border-default)] border-b bg-black/[0.03] font-semibold text-[11px] text-[var(--text-secondary)] uppercase tracking-wider">
                  <th className="px-3.5 py-3">Date / Shift</th>
                  <th className="px-3.5 py-3">Hour Slot</th>
                  <th className="px-3.5 py-3">Feed Seam</th>
                  <th className="px-3.5 py-3 text-right">ROM Feed (t/hr)</th>
                  <th className="px-3.5 py-3 text-right">Clean Coal (t/hr)</th>
                  <th className="px-3.5 py-3 text-right">Discard (t/hr)</th>
                  <th className="px-3.5 py-3 text-right">Yield (%)</th>
                  <th className="px-3.5 py-3 text-right">DMS RD</th>
                  <th className="px-3.5 py-3 text-right">Moisture</th>
                  <th className="px-3.5 py-3 text-right">Run Mins</th>
                  <th className="px-3.5 py-3">Circuit Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-default)] font-mono">
                {filteredHourly.map((h) => (
                  <tr key={h.id} className="transition-colors hover:bg-black/[0.015]">
                    <td className="whitespace-nowrap px-3.5 py-2.5">
                      <span className="font-semibold text-[var(--text-heading)]">{h.date}</span>{' '}
                      <span className="rounded bg-black/[0.04] px-1.5 py-0.5 text-[10px] text-[var(--text-secondary)] uppercase">
                        {h.shift}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3.5 py-2.5 font-semibold text-[var(--text-heading)]">
                      {h.hourSlot}
                    </td>
                    <td className="px-3.5 py-2.5 font-sans text-[var(--text-secondary)]">
                      {h.seamSource}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-semibold text-[var(--text-heading)]">
                      {h.romFeedTonnes}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-bold text-emerald-700">
                      {h.cleanCoalTonnes}
                    </td>
                    <td className="px-3.5 py-2.5 text-right text-amber-800">{h.discardTonnes}</td>
                    <td className="px-3.5 py-2.5 text-right font-bold text-[var(--accent-blue)]">
                      {h.yieldPct.toFixed(1)}%
                    </td>
                    <td className="px-3.5 py-2.5 text-right">{h.cycloneRd.toFixed(2)}</td>
                    <td className="px-3.5 py-2.5 text-right">{h.moisturePct.toFixed(1)}%</td>
                    <td className="px-3.5 py-2.5 text-right">{h.runMinutes}m</td>
                    <td className="max-w-xs truncate px-3.5 py-2.5 font-sans text-[var(--text-secondary)]">
                      {h.notes}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {granularity === 'whatsapp' && (
          <div className="space-y-4 p-5" data-testid="whatsapp-report-panel">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 font-bold text-[var(--text-heading)] text-base">
                  <MessageSquare className="h-4 w-4 text-emerald-600" />
                  WhatsApp Shift Dispatch Report
                </h2>
                <p className="text-[var(--text-secondary)] text-xs">
                  Formatted wash plant mass-balance &amp; downtime summary ready for instant shift
                  handover dispatch.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyWhatsappReport}
                  data-testid="copy-whatsapp-report-btn"
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2 font-semibold text-emerald-800 text-xs transition-colors hover:bg-emerald-500/20"
                >
                  {copiedWhatsapp ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  {copiedWhatsapp ? 'Copied to Clipboard' : 'Copy WhatsApp Text'}
                </button>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(whatsappReportText)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="share-whatsapp-report-link"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 font-semibold text-white text-xs shadow-xs transition-opacity hover:opacity-95"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  Send via WhatsApp
                </a>
              </div>
            </div>
            <pre className="overflow-x-auto whitespace-pre-wrap rounded-xl border border-[var(--border-default)] bg-[var(--bg-primary)] p-4 font-mono text-[var(--text-heading)] text-xs leading-relaxed">
              {whatsappReportText}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
