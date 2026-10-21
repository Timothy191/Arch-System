'use client';

import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Copy,
  Database,
  Download,
  FileSpreadsheet,
  RotateCcw,
  Save,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { savePlantHourlySheetAction } from './actions';
import { loadStoredPlantSheets, saveStoredPlantSheet } from './storage';
import {
  buildDefaultHourlyRows,
  calculateRowYield,
  PLANT_SEAM_OPTIONS,
  type PlantHourlyRow,
  type PlantHourlySheetRecord,
  type PlantModuleId,
  type PlantShiftType,
} from './types';

interface PlantHourlySheetClientProps {
  initialDate: string;
  initialSheets: PlantHourlySheetRecord[];
}

type EditableColumnKey =
  | 'seamSource'
  | 'romFeedTonnes'
  | 'cleanCoalTonnes'
  | 'discardTonnes'
  | 'cycloneRd'
  | 'moisturePct'
  | 'runMinutes'
  | 'notes';

const COLUMN_META: ReadonlyArray<{
  letter: string;
  key: EditableColumnKey | 'hourSlot' | 'yieldPct';
  label: string;
  unit?: string;
  formulaHint?: string;
}> = [
  { letter: 'A', key: 'hourSlot', label: 'Hour Window', formulaHint: 'Locked Shift Window' },
  { letter: 'B', key: 'seamSource', label: 'Feed Seam / Blend', formulaHint: 'Source Stockpile' },
  {
    letter: 'C',
    key: 'romFeedTonnes',
    label: 'ROM Feed',
    unit: 't/hr',
    formulaHint: 'Input Value',
  },
  {
    letter: 'D',
    key: 'cleanCoalTonnes',
    label: 'Clean Coal',
    unit: 't/hr',
    formulaHint: 'Input Value (Auto-updates Discard & Yield)',
  },
  {
    letter: 'E',
    key: 'discardTonnes',
    label: 'Discard / Rejects',
    unit: 't/hr',
    formulaHint: '=MAX(0, C{row} - D{row})',
  },
  {
    letter: 'F',
    key: 'yieldPct',
    label: 'Plant Yield',
    unit: '%',
    formulaHint: '=ROUND((D{row} / C{row}) * 100, 1)',
  },
  {
    letter: 'G',
    key: 'cycloneRd',
    label: 'DMS Cyclone RD',
    unit: 'g/cm³',
    formulaHint: 'Medium Relative Density Setpoint',
  },
  {
    letter: 'H',
    key: 'moisturePct',
    label: 'Moisture',
    unit: '%',
    formulaHint: 'Clean Product Total Moisture',
  },
  {
    letter: 'I',
    key: 'runMinutes',
    label: 'Run Time',
    unit: 'min',
    formulaHint: 'Operating Minutes in Hour (0-60)',
  },
  {
    letter: 'J',
    key: 'notes',
    label: 'Circuit & Operator Notes',
    formulaHint: 'Process observations, density trims, or screen checks',
  },
];

export function PlantHourlySheetClient({
  initialDate,
  initialSheets,
}: PlantHourlySheetClientProps) {
  const [selectedDate, setSelectedDate] = useState<string>(initialDate);
  const [selectedShift, setSelectedShift] = useState<PlantShiftType>('day');
  const [selectedModule, setSelectedModule] = useState<PlantModuleId>('DMS-MOD-1');
  const [savedSheets, setSavedSheets] = useState<PlantHourlySheetRecord[]>(initialSheets);
  const [rows, setRows] = useState<PlantHourlyRow[]>(() =>
    initialSheets[0]?.rows ? initialSheets[0].rows : buildDefaultHourlyRows('day')
  );
  const [activeCell, setActiveCell] = useState<{
    rowIndex: number;
    colLetter: string;
    key: EditableColumnKey | 'hourSlot' | 'yieldPct';
  }>({
    rowIndex: 0,
    colLetter: 'C',
    key: 'romFeedTonnes',
  });
  const [autoCalcDiscard, setAutoCalcDiscard] = useState<boolean>(true);
  const [statusBanner, setStatusBanner] = useState<{
    type: 'success' | 'info';
    text: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const merged = loadStoredPlantSheets(initialSheets);
    setSavedSheets(merged);
  }, [initialSheets]);

  useEffect(() => {
    const sheetId = `sheet-${selectedDate}-${selectedShift}-${selectedModule}`;
    const match = savedSheets.find(
      (s) =>
        s.id === sheetId ||
        (s.date === selectedDate && s.shift === selectedShift && s.moduleId === selectedModule)
    );
    if (match && match.rows.length > 0) {
      setRows(match.rows);
    } else {
      setRows(buildDefaultHourlyRows(selectedShift));
    }
  }, [selectedDate, selectedShift, selectedModule, savedSheets]);

  const updateCell = (
    rowIndex: number,
    key: EditableColumnKey,
    rawValue: string | number
  ): void => {
    setRows((prev) =>
      prev.map((row, idx) => {
        if (idx !== rowIndex) return row;

        if (key === 'seamSource' || key === 'notes') {
          return { ...row, [key]: String(rawValue) };
        }

        const num = Math.max(0, Number(rawValue) || 0);
        const updated: PlantHourlyRow = { ...row, [key]: num };

        if (key === 'romFeedTonnes' || key === 'cleanCoalTonnes') {
          const rom = key === 'romFeedTonnes' ? num : row.romFeedTonnes;
          const clean =
            key === 'cleanCoalTonnes' ? Math.min(rom, num) : Math.min(rom, row.cleanCoalTonnes);
          updated.romFeedTonnes = rom;
          updated.cleanCoalTonnes = clean;
          if (autoCalcDiscard) {
            updated.discardTonnes = Number(Math.max(0, rom - clean).toFixed(1));
          }
          updated.yieldPct = calculateRowYield(rom, clean);
        } else if (key === 'discardTonnes') {
          updated.discardTonnes = num;
        } else if (key === 'runMinutes') {
          updated.runMinutes = Math.min(60, Math.round(num));
        } else if (key === 'cycloneRd') {
          updated.cycloneRd = Number(num.toFixed(2));
        } else if (key === 'moisturePct') {
          updated.moisturePct = Number(num.toFixed(1));
        }

        return updated;
      })
    );
  };

  const totals = useMemo(() => {
    const totalRom = rows.reduce((sum, r) => sum + (Number(r.romFeedTonnes) || 0), 0);
    const totalClean = rows.reduce((sum, r) => sum + (Number(r.cleanCoalTonnes) || 0), 0);
    const totalDiscard = rows.reduce((sum, r) => sum + (Number(r.discardTonnes) || 0), 0);
    const weightedYield = calculateRowYield(totalRom, totalClean);
    const avgRd =
      rows.length > 0
        ? Number((rows.reduce((sum, r) => sum + r.cycloneRd, 0) / rows.length).toFixed(2))
        : 1.48;
    const avgMoisture =
      rows.length > 0
        ? Number((rows.reduce((sum, r) => sum + r.moisturePct, 0) / rows.length).toFixed(1))
        : 8.0;
    const totalRunMins = rows.reduce((sum, r) => sum + (Number(r.runMinutes) || 0), 0);
    const runHours = Number((totalRunMins / 60).toFixed(1));
    const avgTph = runHours > 0 ? Math.round(totalRom / runHours) : 0;

    return {
      totalRom,
      totalClean,
      totalDiscard,
      weightedYield,
      avgRd,
      avgMoisture,
      totalRunMins,
      runHours,
      avgTph,
    };
  }, [rows]);

  const activeRow = rows[activeCell.rowIndex] ?? rows[0];
  const activeColMeta =
    COLUMN_META.find((c) => c.letter === activeCell.colLetter) ?? COLUMN_META[2]!;
  const activeCellAddress = `${activeColMeta.letter}${activeCell.rowIndex + 1}`;
  const activeFormulaDisplay = (activeColMeta.formulaHint ?? '').replaceAll(
    '{row}',
    String(activeCell.rowIndex + 1)
  );

  const handleFillDown = () => {
    const sourceRow = rows[activeCell.rowIndex];
    if (!sourceRow) return;
    const key = activeCell.key;
    if (key === 'hourSlot' || key === 'yieldPct') return;

    setRows((prev) =>
      prev.map((row, idx) => {
        if (idx <= activeCell.rowIndex) return row;
        const val = sourceRow[key];
        const nextRow = { ...row, [key]: val };
        if (key === 'romFeedTonnes' || key === 'cleanCoalTonnes') {
          const rom = nextRow.romFeedTonnes;
          const clean = Math.min(rom, nextRow.cleanCoalTonnes);
          nextRow.cleanCoalTonnes = clean;
          if (autoCalcDiscard) {
            nextRow.discardTonnes = Number(Math.max(0, rom - clean).toFixed(1));
          }
          nextRow.yieldPct = calculateRowYield(rom, clean);
        }
        return nextRow;
      })
    );
    setStatusBanner({
      type: 'info',
      text: `Filled column ${activeColMeta.letter} (${activeColMeta.label}) down from row ${activeCell.rowIndex + 1} to row ${rows.length}.`,
    });
  };

  const handleResetDefaults = () => {
    setRows(buildDefaultHourlyRows(selectedShift));
    setStatusBanner({
      type: 'info',
      text: `Reset ${selectedShift.toUpperCase()} shift hourly grid to baseline wash plant template.`,
    });
  };

  const handleExportCsv = () => {
    const headers = [
      'Row',
      'Hour Window',
      'Feed Seam',
      'ROM Feed (t/hr)',
      'Clean Coal (t/hr)',
      'Discard (t/hr)',
      'Plant Yield (%)',
      'DMS Cyclone RD (g/cm3)',
      'Moisture (%)',
      'Run Time (min)',
      'Notes',
    ];
    const csvLines = [
      headers.join(','),
      ...rows.map((r) =>
        [
          r.rowNumber,
          `"${r.hourSlot}"`,
          `"${r.seamSource}"`,
          r.romFeedTonnes,
          r.cleanCoalTonnes,
          r.discardTonnes,
          r.yieldPct,
          r.cycloneRd,
          r.moisturePct,
          r.runMinutes,
          `"${r.notes.replaceAll('"', '""')}"`,
        ].join(',')
      ),
      [
        'TOTAL/AVG',
        `"${selectedShift.toUpperCase()} SHIFT"`,
        '"ALL SEAMS"',
        totals.totalRom,
        totals.totalClean,
        totals.totalDiscard,
        totals.weightedYield,
        totals.avgRd,
        totals.avgMoisture,
        totals.totalRunMins,
        '"Shift Summary"',
      ].join(','),
    ];

    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `plant-processing-hourly-sheet-${selectedDate}-${selectedShift}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveSheet = () => {
    const sheetRecord: PlantHourlySheetRecord = {
      id: `sheet-${selectedDate}-${selectedShift}-${selectedModule}`,
      date: selectedDate,
      shift: selectedShift,
      moduleId: selectedModule,
      operatorName: 'Plant Control Operator',
      updatedAt: new Date().toISOString(),
      rows,
    };

    const nextSheets = saveStoredPlantSheet(sheetRecord, savedSheets);
    setSavedSheets(nextSheets);

    startTransition(async () => {
      const res = await savePlantHourlySheetAction({
        date: selectedDate,
        shift: selectedShift,
        moduleId: selectedModule,
        rows,
      });
      setStatusBanner({
        type: 'success',
        text: res.message,
      });
    });
  };

  return (
    <div className="p-4 sm:p-6 max-w-[1650px] mx-auto space-y-5">
      {/* Top Workbook Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-2xl p-4 sm:p-5 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold uppercase tracking-wider bg-amber-500/15 text-amber-700 border border-amber-500/30">
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Excel Grid Mode · Hourly Input Sheet
            </span>
            <span className="text-xs text-[var(--text-muted)] font-mono">
              Workbook: PLANT_WASH_LOG_{selectedDate.replaceAll('-', '_')}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-heading)] tracking-tight">
            Plant &amp; Processing — Hourly Input Sheet
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
            Interactive spreadsheet grid for ROM coal feed, DMS cyclone relative density, clean coal
            recovery, and hourly plant run-time tracking.
          </p>
        </div>

        {/* Controls & Quick Navigation */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/plant-processing/delays"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-amber-500/30 bg-amber-500/10 text-amber-800 hover:bg-amber-500/20 transition-colors"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Log Plant Delay
          </Link>
          <Link
            href="/plant-processing/history"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-heading)] hover:bg-black/[0.03] transition-colors"
          >
            <Database className="w-3.5 h-3.5 text-[var(--accent-blue)]" />
            History Database
          </Link>
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-heading)] hover:bg-black/[0.03] transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
          <button
            type="button"
            onClick={handleSaveSheet}
            disabled={isPending}
            data-testid="save-plant-hourly-sheet"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-[var(--accent-blue)] text-white hover:opacity-95 disabled:opacity-60 transition-all shadow-sm cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            {isPending ? 'Saving Sheet...' : 'Save Hourly Sheet'}
          </button>
        </div>
      </div>

      {/* Status Banner */}
      {statusBanner && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-900 text-xs font-medium"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{statusBanner.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusBanner(null)}
            className="text-[11px] underline opacity-75 hover:opacity-100 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* KPI Summary Ribbon */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-xl p-3.5">
          <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
            Σ ROM Feed (Col C)
          </div>
          <div className="mt-1 text-xl font-bold font-mono text-[var(--text-heading)]">
            {totals.totalRom.toLocaleString()} <span className="text-xs font-normal">t</span>
          </div>
          <div className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
            Avg {totals.avgTph.toLocaleString()} t/hr effective
          </div>
        </div>

        <div className="bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-xl p-3.5">
          <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
            Σ Clean Coal (Col D)
          </div>
          <div className="mt-1 text-xl font-bold font-mono text-emerald-700">
            {totals.totalClean.toLocaleString()} <span className="text-xs font-normal">t</span>
          </div>
          <div className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
            Washed product to stockpile
          </div>
        </div>

        <div className="bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-xl p-3.5">
          <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
            Σ Discard (Col E)
          </div>
          <div className="mt-1 text-xl font-bold font-mono text-amber-700">
            {totals.totalDiscard.toLocaleString()} <span className="text-xs font-normal">t</span>
          </div>
          <div className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
            Coarse rejects + fine tailings
          </div>
        </div>

        <div className="bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-xl p-3.5">
          <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
            Weighted Plant Yield
          </div>
          <div className="mt-1 text-xl font-bold font-mono text-[var(--accent-blue)]">
            {totals.weightedYield.toFixed(1)}%
          </div>
          <div className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
            Formula: =(ΣD / ΣC) × 100
          </div>
        </div>

        <div className="bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-xl p-3.5">
          <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
            Mean DMS RD &amp; Moisture
          </div>
          <div className="mt-1 text-xl font-bold font-mono text-[var(--text-heading)]">
            {totals.avgRd.toFixed(2)}{' '}
            <span className="text-xs font-normal text-[var(--text-secondary)]">
              g/cm³ · {totals.avgMoisture.toFixed(1)}%
            </span>
          </div>
          <div className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
            Target RD: 1.48 g/cm³
          </div>
        </div>

        <div className="bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-xl p-3.5">
          <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
            Shift Run Time (Col I)
          </div>
          <div className="mt-1 text-xl font-bold font-mono text-[var(--text-heading)]">
            {totals.runHours} <span className="text-xs font-normal">/ 12.0 hrs</span>
          </div>
          <div className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
            {totals.totalRunMins} / 720 operating mins
          </div>
        </div>
      </div>

      {/* Workbook Toolbar & Formula Bar */}
      <div className="bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-2xl overflow-hidden shadow-sm">
        {/* Sheet Parameters Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-[var(--border-default)] bg-black/[0.015]">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs font-medium text-[var(--text-secondary)]">
              <Calendar className="w-3.5 h-3.5 text-[var(--text-muted)]" />
              <span>Date:</span>
              <input
                type="date"
                aria-label="Operational Date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-2.5 py-1 rounded-md border border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-heading)] text-xs font-mono"
              />
            </label>

            <div
              className="inline-flex rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] p-0.5"
              role="group"
              aria-label="Shift selector"
            >
              <button
                type="button"
                onClick={() => setSelectedShift('day')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  selectedShift === 'day'
                    ? 'bg-[var(--accent-blue)] text-white'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-heading)]'
                }`}
              >
                Day Shift (06:00–18:00)
              </button>
              <button
                type="button"
                onClick={() => setSelectedShift('night')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  selectedShift === 'night'
                    ? 'bg-[var(--accent-blue)] text-white'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-heading)]'
                }`}
              >
                Night Shift (18:00–06:00)
              </button>
            </div>

            <label className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-secondary)]">
              <span>Circuit Module:</span>
              <select
                aria-label="Plant Circuit Module"
                value={selectedModule}
                onChange={(e) => setSelectedModule(e.target.value as PlantModuleId)}
                className="px-2.5 py-1 rounded-md border border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-heading)] text-xs"
              >
                <option value="DMS-MOD-1">DMS Module 1 — Primary Wash Plant</option>
                <option value="DMS-MOD-2">DMS Module 2 — Secondary &amp; Fines</option>
              </select>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoCalcDiscard}
                onChange={(e) => setAutoCalcDiscard(e.target.checked)}
                className="rounded border-[var(--border-default)]"
              />
              <span>Auto-calc Discard (=C-D)</span>
            </label>

            <button
              type="button"
              onClick={handleFillDown}
              title="Copy active cell value down to remaining rows in this column"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-[var(--border-default)] bg-[var(--bg-primary)] text-[11px] font-medium text-[var(--text-heading)] hover:bg-black/[0.04] transition-colors cursor-pointer"
            >
              <Copy className="w-3 h-3" />
              Fill Down ({activeColMeta.letter})
            </button>

            <button
              type="button"
              onClick={handleResetDefaults}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-[var(--border-default)] bg-[var(--bg-primary)] text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-heading)] hover:bg-black/[0.04] transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              Reset Sheet
            </button>
          </div>
        </div>

        {/* Excel Formula Bar */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--border-default)] bg-[var(--bg-primary)] text-xs font-mono">
          <span
            className="inline-flex items-center justify-center min-w-[44px] px-2 py-0.5 rounded border border-[var(--border-default)] bg-black/[0.03] font-bold text-[var(--text-heading)]"
            aria-label="Active Cell Reference"
          >
            {activeCellAddress}
          </span>
          <span className="inline-flex items-center gap-1 text-[var(--text-muted)] italic font-serif px-1.5">
            <Sparkles className="w-3 h-3 text-amber-600" />
            fx
          </span>
          <div className="flex-1 truncate text-[var(--text-secondary)]">
            <span className="font-semibold text-[var(--text-heading)]">{activeColMeta.label}:</span>{' '}
            <span>{activeFormulaDisplay}</span>
            {activeRow && (
              <span className="ml-3 text-[var(--text-muted)]">
                [Row {activeRow.rowNumber} · {activeRow.hourSlot} · Value:{' '}
                {String(activeRow[activeCell.key])}]
              </span>
            )}
          </div>
        </div>

        {/* Spreadsheet Grid Table */}
        <div className="overflow-x-auto">
          <table
            className="w-full border-collapse text-left text-xs"
            aria-label="Plant and Processing Hourly Input Sheet"
          >
            <thead>
              {/* Excel Column Letters Row */}
              <tr className="bg-black/[0.04] border-b border-[var(--border-default)] text-[11px] font-mono text-[var(--text-muted)] select-none">
                <th className="w-10 py-1.5 px-2 text-center border-r border-[var(--border-default)]">
                  #
                </th>
                {COLUMN_META.map((col) => (
                  <th
                    key={col.letter}
                    className={`py-1.5 px-2.5 text-center border-r border-[var(--border-default)] font-semibold ${
                      activeCell.colLetter === col.letter
                        ? 'bg-[var(--accent-blue)]/15 text-[var(--accent-blue)]'
                        : ''
                    }`}
                  >
                    {col.letter}
                  </th>
                ))}
              </tr>
              {/* Column Titles Row */}
              <tr className="bg-black/[0.02] border-b border-[var(--border-default)] text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                <th className="py-2.5 px-2 text-center border-r border-[var(--border-default)]">
                  Row
                </th>
                {COLUMN_META.map((col) => (
                  <th
                    key={col.key}
                    className="py-2.5 px-2.5 border-r border-[var(--border-default)] whitespace-nowrap"
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <span>{col.label}</span>
                      {col.unit && (
                        <span className="text-[10px] font-mono lowercase px-1.5 py-0.5 rounded bg-black/[0.04] text-[var(--text-muted)]">
                          {col.unit}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-[var(--border-default)] font-mono">
              {rows.map((row, rowIndex) => {
                const isActiveRow = activeCell.rowIndex === rowIndex;
                const yieldBadgeClass =
                  row.yieldPct >= 88
                    ? 'bg-emerald-500/15 text-emerald-800 border-emerald-500/30'
                    : row.yieldPct >= 80
                      ? 'bg-amber-500/15 text-amber-800 border-amber-500/30'
                      : 'bg-red-500/15 text-red-800 border-red-500/30';

                return (
                  <tr
                    key={row.hourSlot}
                    className={`transition-colors ${
                      isActiveRow ? 'bg-[var(--accent-blue)]/[0.04]' : 'hover:bg-black/[0.015]'
                    }`}
                  >
                    {/* Row Index */}
                    <td
                      className={`py-1.5 px-2 text-center border-r border-[var(--border-default)] text-[11px] select-none ${
                        isActiveRow
                          ? 'bg-[var(--accent-blue)]/15 font-bold text-[var(--accent-blue)]'
                          : 'bg-black/[0.02] text-[var(--text-muted)]'
                      }`}
                    >
                      {row.rowNumber}
                    </td>

                    {/* Col A: Hour Slot */}
                    <td
                      onClick={() => setActiveCell({ rowIndex, colLetter: 'A', key: 'hourSlot' })}
                      className="py-1.5 px-2.5 border-r border-[var(--border-default)] whitespace-nowrap font-medium text-[var(--text-heading)] bg-black/[0.01]"
                    >
                      {row.hourSlot}
                    </td>

                    {/* Col B: Seam Source */}
                    <td className="p-0 border-r border-[var(--border-default)] min-w-[150px]">
                      <select
                        aria-label={`Row ${row.rowNumber} Feed Seam`}
                        value={row.seamSource}
                        onFocus={() =>
                          setActiveCell({ rowIndex, colLetter: 'B', key: 'seamSource' })
                        }
                        onChange={(e) => updateCell(rowIndex, 'seamSource', e.target.value)}
                        className="w-full h-full py-2 px-2.5 bg-transparent font-sans text-xs text-[var(--text-heading)] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--accent-blue)]"
                      >
                        {PLANT_SEAM_OPTIONS.map((seam) => (
                          <option key={seam} value={seam}>
                            {seam}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Col C: ROM Feed */}
                    <td className="p-0 border-r border-[var(--border-default)] min-w-[110px]">
                      <input
                        type="number"
                        min={0}
                        max={2000}
                        step={5}
                        aria-label={`Row ${row.rowNumber} ROM Feed`}
                        value={row.romFeedTonnes}
                        onFocus={() =>
                          setActiveCell({ rowIndex, colLetter: 'C', key: 'romFeedTonnes' })
                        }
                        onChange={(e) => updateCell(rowIndex, 'romFeedTonnes', e.target.value)}
                        className="w-full py-2 px-2.5 bg-transparent text-right font-mono text-xs text-[var(--text-heading)] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--accent-blue)]"
                      />
                    </td>

                    {/* Col D: Clean Coal */}
                    <td className="p-0 border-r border-[var(--border-default)] min-w-[110px]">
                      <input
                        type="number"
                        min={0}
                        max={2000}
                        step={5}
                        aria-label={`Row ${row.rowNumber} Clean Coal`}
                        value={row.cleanCoalTonnes}
                        onFocus={() =>
                          setActiveCell({ rowIndex, colLetter: 'D', key: 'cleanCoalTonnes' })
                        }
                        onChange={(e) => updateCell(rowIndex, 'cleanCoalTonnes', e.target.value)}
                        className="w-full py-2 px-2.5 bg-transparent text-right font-mono text-xs font-semibold text-emerald-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--accent-blue)]"
                      />
                    </td>

                    {/* Col E: Discard Tonnes */}
                    <td className="p-0 border-r border-[var(--border-default)] min-w-[110px]">
                      <input
                        type="number"
                        min={0}
                        max={2000}
                        step={1}
                        aria-label={`Row ${row.rowNumber} Discard`}
                        value={row.discardTonnes}
                        onFocus={() =>
                          setActiveCell({ rowIndex, colLetter: 'E', key: 'discardTonnes' })
                        }
                        onChange={(e) => updateCell(rowIndex, 'discardTonnes', e.target.value)}
                        className="w-full py-2 px-2.5 bg-transparent text-right font-mono text-xs text-amber-800 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--accent-blue)]"
                      />
                    </td>

                    {/* Col F: Computed Plant Yield (%) */}
                    <td
                      onClick={() => setActiveCell({ rowIndex, colLetter: 'F', key: 'yieldPct' })}
                      className="py-1.5 px-2.5 border-r border-[var(--border-default)] text-right bg-black/[0.015] min-w-[105px]"
                    >
                      <span
                        className={`inline-block px-2 py-0.5 rounded border text-[11px] font-semibold ${yieldBadgeClass}`}
                      >
                        {row.yieldPct.toFixed(1)}%
                      </span>
                    </td>

                    {/* Col G: DMS Cyclone RD */}
                    <td className="p-0 border-r border-[var(--border-default)] min-w-[115px]">
                      <input
                        type="number"
                        min={1.2}
                        max={2.2}
                        step={0.01}
                        aria-label={`Row ${row.rowNumber} DMS Cyclone RD`}
                        value={row.cycloneRd}
                        onFocus={() =>
                          setActiveCell({ rowIndex, colLetter: 'G', key: 'cycloneRd' })
                        }
                        onChange={(e) => updateCell(rowIndex, 'cycloneRd', e.target.value)}
                        className="w-full py-2 px-2.5 bg-transparent text-right font-mono text-xs text-[var(--text-heading)] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--accent-blue)]"
                      />
                    </td>

                    {/* Col H: Product Moisture % */}
                    <td className="p-0 border-r border-[var(--border-default)] min-w-[100px]">
                      <input
                        type="number"
                        min={0}
                        max={30}
                        step={0.1}
                        aria-label={`Row ${row.rowNumber} Moisture`}
                        value={row.moisturePct}
                        onFocus={() =>
                          setActiveCell({ rowIndex, colLetter: 'H', key: 'moisturePct' })
                        }
                        onChange={(e) => updateCell(rowIndex, 'moisturePct', e.target.value)}
                        className="w-full py-2 px-2.5 bg-transparent text-right font-mono text-xs text-[var(--text-heading)] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--accent-blue)]"
                      />
                    </td>

                    {/* Col I: Run Time (mins) */}
                    <td className="p-0 border-r border-[var(--border-default)] min-w-[95px]">
                      <input
                        type="number"
                        min={0}
                        max={60}
                        step={1}
                        aria-label={`Row ${row.rowNumber} Run Time`}
                        value={row.runMinutes}
                        onFocus={() =>
                          setActiveCell({ rowIndex, colLetter: 'I', key: 'runMinutes' })
                        }
                        onChange={(e) => updateCell(rowIndex, 'runMinutes', e.target.value)}
                        className="w-full py-2 px-2.5 bg-transparent text-right font-mono text-xs text-[var(--text-heading)] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--accent-blue)]"
                      />
                    </td>

                    {/* Col J: Notes */}
                    <td className="p-0 min-w-[260px]">
                      <input
                        type="text"
                        aria-label={`Row ${row.rowNumber} Notes`}
                        value={row.notes}
                        placeholder="Add hourly circuit note..."
                        onFocus={() => setActiveCell({ rowIndex, colLetter: 'J', key: 'notes' })}
                        onChange={(e) => updateCell(rowIndex, 'notes', e.target.value)}
                        className="w-full py-2 px-2.5 bg-transparent font-sans text-xs text-[var(--text-secondary)] focus:text-[var(--text-heading)] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--accent-blue)]"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>

            {/* Spreadsheet Summary Footer Row (Row 13) */}
            <tfoot>
              <tr className="bg-black/[0.04] border-t-2 border-[var(--border-default)] font-mono text-xs font-bold text-[var(--text-heading)]">
                <td className="py-2.5 px-2 text-center border-r border-[var(--border-default)] text-[var(--accent-blue)]">
                  Σ
                </td>
                <td className="py-2.5 px-2.5 border-r border-[var(--border-default)] uppercase tracking-wider text-[11px]">
                  Shift Total / Avg
                </td>
                <td className="py-2.5 px-2.5 border-r border-[var(--border-default)] font-sans text-[11px] font-medium text-[var(--text-secondary)]">
                  12 Hourly Slots ({selectedModule})
                </td>
                <td className="py-2.5 px-2.5 text-right border-r border-[var(--border-default)]">
                  {totals.totalRom.toLocaleString()} t
                </td>
                <td className="py-2.5 px-2.5 text-right border-r border-[var(--border-default)] text-emerald-700">
                  {totals.totalClean.toLocaleString()} t
                </td>
                <td className="py-2.5 px-2.5 text-right border-r border-[var(--border-default)] text-amber-800">
                  {totals.totalDiscard.toLocaleString()} t
                </td>
                <td className="py-2.5 px-2.5 text-right border-r border-[var(--border-default)] text-[var(--accent-blue)]">
                  {totals.weightedYield.toFixed(1)}%
                </td>
                <td className="py-2.5 px-2.5 text-right border-r border-[var(--border-default)]">
                  {totals.avgRd.toFixed(2)} g/cm³
                </td>
                <td className="py-2.5 px-2.5 text-right border-r border-[var(--border-default)]">
                  {totals.avgMoisture.toFixed(1)}%
                </td>
                <td className="py-2.5 px-2.5 text-right border-r border-[var(--border-default)]">
                  {totals.totalRunMins} min ({totals.runHours}h)
                </td>
                <td className="py-2.5 px-2.5 font-sans text-[11px] font-normal text-[var(--text-secondary)]">
                  Auto-reconciled with Plant History Database
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
