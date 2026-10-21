'use client';

import {
  AlertTriangle,
  Calendar,
  Clock,
  Database,
  Download,
  FileSpreadsheet,
  Layers,
  Search,
} from 'lucide-react';
import Link from 'next/link';
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

export type PlantReportGranularity = 'monthly' | 'daily' | 'hourly';

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
  const [granularity, setGranularity] = useState<PlantReportGranularity>('daily');
  const [sheets, setSheets] = useState<PlantHourlySheetRecord[]>(initialSheets);
  const [delays, setDelays] = useState<PlantDelayEntry[]>(initialDelays);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [shiftFilter, setShiftFilter] = useState<'ALL' | 'day' | 'night'>('ALL');

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
    <div className="p-4 sm:p-6 max-w-[1600px] mx-auto space-y-6">
      {/* Database Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-2xl p-5 shadow-sm">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold uppercase tracking-wider bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] border border-[var(--accent-blue)]/25">
            <Database className="w-3.5 h-3.5" />
            Plant &amp; Processing Logged Telemetry Archive
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-heading)] tracking-tight">
            Plant &amp; Processing — Logged Info &amp; Reports Database
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
            Unified historical database of logged wash plant performance across Monthly, Daily, and
            Hourly report granularities.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/plant-processing/hourly-sheet"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-heading)] hover:bg-black/[0.03] transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-amber-600" />
            Hourly Input Sheet
          </Link>
          <Link
            href="/plant-processing/delays"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-heading)] hover:bg-black/[0.03] transition-colors"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            Delays Register
          </Link>
          <button
            type="button"
            onClick={handleExportReportCsv}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-[var(--accent-blue)] text-white hover:opacity-95 transition-all shadow-sm cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Export {granularity.charAt(0).toUpperCase() + granularity.slice(1)} Report CSV
          </button>
        </div>
      </div>

      {/* Granularity Switcher (Monthly / Daily / Hourly Reports) & Filter Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-2xl p-4 shadow-sm">
        <div
          className="inline-flex rounded-xl border border-[var(--border-default)] bg-[var(--bg-primary)] p-1 gap-1"
          role="tablist"
          aria-label="Report Granularity Database View"
        >
          <button
            type="button"
            role="tab"
            aria-selected={granularity === 'monthly'}
            onClick={() => setGranularity('monthly')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              granularity === 'monthly'
                ? 'bg-[var(--accent-blue)] text-white shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-heading)] hover:bg-black/[0.03]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Monthly Reports ({filteredMonthly.length})
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={granularity === 'daily'}
            onClick={() => setGranularity('daily')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              granularity === 'daily'
                ? 'bg-[var(--accent-blue)] text-white shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-heading)] hover:bg-black/[0.03]'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            Daily Reports ({filteredDaily.length})
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={granularity === 'hourly'}
            onClick={() => setGranularity('hourly')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              granularity === 'hourly'
                ? 'bg-[var(--accent-blue)] text-white shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-heading)] hover:bg-black/[0.03]'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Hourly Reports ({filteredHourly.length})
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {granularity !== 'monthly' && (
            <select
              aria-label="Filter database by shift"
              value={shiftFilter}
              onChange={(e) => setShiftFilter(e.target.value as 'ALL' | 'day' | 'night')}
              className="px-3 py-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] text-xs text-[var(--text-heading)]"
            >
              <option value="ALL">All Shifts (Day &amp; Night)</option>
              <option value="day">Day Shift Only</option>
              <option value="night">Night Shift Only</option>
            </select>
          )}

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              aria-label="Search logged database records"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by date, seam, module, or note..."
              className="pl-8 pr-3 py-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] text-xs text-[var(--text-heading)] min-w-[240px]"
            />
          </div>
        </div>
      </div>

      {/* Report Database Table Container */}
      <div className="bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-2xl overflow-hidden shadow-sm">
        {granularity === 'monthly' && (
          <div className="overflow-x-auto">
            <table
              className="w-full text-left border-collapse text-xs"
              aria-label="Monthly Plant Reports Database"
            >
              <thead>
                <tr className="bg-black/[0.03] border-b border-[var(--border-default)] text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                  <th className="py-3.5 px-4">Month Period</th>
                  <th className="py-3.5 px-4 text-right">Shifts Logged</th>
                  <th className="py-3.5 px-4 text-right">ROM Feed (t)</th>
                  <th className="py-3.5 px-4 text-right">Clean Coal (t)</th>
                  <th className="py-3.5 px-4 text-right">Discard (t)</th>
                  <th className="py-3.5 px-4 text-right">Plant Yield (%)</th>
                  <th className="py-3.5 px-4 text-right">Mean RD (g/cm³)</th>
                  <th className="py-3.5 px-4 text-right">Moisture (%)</th>
                  <th className="py-3.5 px-4 text-right">Run / Delay Hrs</th>
                  <th className="py-3.5 px-4 text-right">Availability</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-default)] font-mono">
                {filteredMonthly.map((m) => (
                  <tr key={m.month} className="hover:bg-black/[0.015] transition-colors">
                    <td className="py-3.5 px-4 font-sans">
                      <div className="font-bold text-[var(--text-heading)]">{m.monthLabel}</div>
                      <div className="text-[11px] font-mono text-[var(--text-muted)]">
                        {m.month}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right">{m.shiftsLogged}</td>
                    <td className="py-3.5 px-4 text-right font-semibold text-[var(--text-heading)]">
                      {m.romFeedTonnes.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-emerald-700">
                      {m.cleanCoalTonnes.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-right text-amber-800">
                      {m.discardTonnes.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <span className="inline-block px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-800 border border-emerald-500/30 font-bold">
                        {m.yieldPct.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">{m.avgCycloneRd.toFixed(2)}</td>
                    <td className="py-3.5 px-4 text-right">{m.avgMoisturePct.toFixed(1)}%</td>
                    <td className="py-3.5 px-4 text-right">
                      {m.totalRunHours}h /{' '}
                      <span className="text-amber-700">{m.totalDelayHours}h</span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-[var(--accent-blue)]">
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
              className="w-full text-left border-collapse text-xs"
              aria-label="Daily Plant Reports Database"
            >
              <thead>
                <tr className="bg-black/[0.03] border-b border-[var(--border-default)] text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4">Shift</th>
                  <th className="py-3.5 px-4">Plant Module</th>
                  <th className="py-3.5 px-4 text-right">ROM Feed (t)</th>
                  <th className="py-3.5 px-4 text-right">Clean Coal (t)</th>
                  <th className="py-3.5 px-4 text-right">Discard (t)</th>
                  <th className="py-3.5 px-4 text-right">Yield (%)</th>
                  <th className="py-3.5 px-4 text-right">Avg RD</th>
                  <th className="py-3.5 px-4 text-right">Moisture</th>
                  <th className="py-3.5 px-4 text-right">Run Hrs / Delay</th>
                  <th className="py-3.5 px-4">Logged By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-default)] font-mono">
                {filteredDaily.map((d) => (
                  <tr key={d.id} className="hover:bg-black/[0.015] transition-colors">
                    <td className="py-3 px-4 font-bold text-[var(--text-heading)]">{d.date}</td>
                    <td className="py-3 px-4 uppercase">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                          d.shift === 'day'
                            ? 'bg-amber-500/15 text-amber-800 border border-amber-500/30'
                            : 'bg-indigo-500/15 text-indigo-800 border border-indigo-500/30'
                        }`}
                      >
                        {d.shift}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[var(--text-secondary)]">{d.moduleId}</td>
                    <td className="py-3 px-4 text-right font-semibold text-[var(--text-heading)]">
                      {d.romFeedTonnes.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-emerald-700">
                      {d.cleanCoalTonnes.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right text-amber-800">
                      {d.discardTonnes.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="inline-block px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-800 border border-emerald-500/30 font-bold">
                        {d.yieldPct.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">{d.avgCycloneRd.toFixed(2)}</td>
                    <td className="py-3 px-4 text-right">{d.avgMoisturePct.toFixed(1)}%</td>
                    <td className="py-3 px-4 text-right">
                      {d.runHours}h / <span className="text-amber-700">{d.delayMinutes}m</span>
                    </td>
                    <td className="py-3 px-4 font-sans text-[var(--text-secondary)]">
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
              className="w-full text-left border-collapse text-xs"
              aria-label="Hourly Plant Reports Database"
            >
              <thead>
                <tr className="bg-black/[0.03] border-b border-[var(--border-default)] text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                  <th className="py-3 px-3.5">Date / Shift</th>
                  <th className="py-3 px-3.5">Hour Slot</th>
                  <th className="py-3 px-3.5">Feed Seam</th>
                  <th className="py-3 px-3.5 text-right">ROM Feed (t/hr)</th>
                  <th className="py-3 px-3.5 text-right">Clean Coal (t/hr)</th>
                  <th className="py-3 px-3.5 text-right">Discard (t/hr)</th>
                  <th className="py-3 px-3.5 text-right">Yield (%)</th>
                  <th className="py-3 px-3.5 text-right">DMS RD</th>
                  <th className="py-3 px-3.5 text-right">Moisture</th>
                  <th className="py-3 px-3.5 text-right">Run Mins</th>
                  <th className="py-3 px-3.5">Circuit Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-default)] font-mono">
                {filteredHourly.map((h) => (
                  <tr key={h.id} className="hover:bg-black/[0.015] transition-colors">
                    <td className="py-2.5 px-3.5 whitespace-nowrap">
                      <span className="font-semibold text-[var(--text-heading)]">{h.date}</span>{' '}
                      <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-black/[0.04] text-[var(--text-secondary)]">
                        {h.shift}
                      </span>
                    </td>
                    <td className="py-2.5 px-3.5 whitespace-nowrap font-semibold text-[var(--text-heading)]">
                      {h.hourSlot}
                    </td>
                    <td className="py-2.5 px-3.5 font-sans text-[var(--text-secondary)]">
                      {h.seamSource}
                    </td>
                    <td className="py-2.5 px-3.5 text-right font-semibold text-[var(--text-heading)]">
                      {h.romFeedTonnes}
                    </td>
                    <td className="py-2.5 px-3.5 text-right font-bold text-emerald-700">
                      {h.cleanCoalTonnes}
                    </td>
                    <td className="py-2.5 px-3.5 text-right text-amber-800">{h.discardTonnes}</td>
                    <td className="py-2.5 px-3.5 text-right font-bold text-[var(--accent-blue)]">
                      {h.yieldPct.toFixed(1)}%
                    </td>
                    <td className="py-2.5 px-3.5 text-right">{h.cycloneRd.toFixed(2)}</td>
                    <td className="py-2.5 px-3.5 text-right">{h.moisturePct.toFixed(1)}%</td>
                    <td className="py-2.5 px-3.5 text-right">{h.runMinutes}m</td>
                    <td className="py-2.5 px-3.5 font-sans text-[var(--text-secondary)] max-w-xs truncate">
                      {h.notes}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
