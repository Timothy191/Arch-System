'use client';

import { Badge } from '@repo/ui/components/ui/badge';
import { GlassCard } from '@repo/ui/GlassCard';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Calendar,
  CheckCircle2,
  Copy,
  Database,
  Download,
  FileSpreadsheet,
  Flame,
  Gauge,
  PieChart,
  RotateCcw,
  Save,
  Scale,
  Sparkles,
  TrendingUp,
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
  mode?: 'dashboard' | 'sheet' | 'combined';
}

type EditableColumnKey =
  | 'seamSource'
  | 'romFeedTonnes'
  | 'cleanCoalTonnes'
  | 'discardTonnes'
  | 'productAshPct'
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
    label: 'ROM Scale',
    unit: 't/hr',
    formulaHint: 'Input Value',
  },
  {
    letter: 'D',
    key: 'cleanCoalTonnes',
    label: 'Clean Product',
    unit: 't/hr',
    formulaHint: 'Input Value (Auto-updates Discard & Recovery %)',
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
    label: 'Product Yield',
    unit: '% Rec',
    formulaHint: '=ROUND((D{row} / C{row}) * 100, 1)',
  },
  {
    letter: 'G',
    key: 'productAshPct',
    label: 'Product Ash',
    unit: '% ADB',
    formulaHint: 'Washed Product Ash % (Spec <= 15.0%)',
  },
  {
    letter: 'H',
    key: 'cycloneRd',
    label: 'Running Density',
    unit: 'g/cm³',
    formulaHint: 'DMS Cyclone Medium Relative Density',
  },
  {
    letter: 'I',
    key: 'moisturePct',
    label: 'Moisture',
    unit: '%',
    formulaHint: 'Clean Product Total Moisture',
  },
  {
    letter: 'J',
    key: 'runMinutes',
    label: 'Run Time',
    unit: 'min',
    formulaHint: 'Operating Minutes in Hour (0-60)',
  },
  {
    letter: 'K',
    key: 'notes',
    label: 'Circuit & Operator Notes',
    formulaHint: 'Process observations, density trims, or screen checks',
  },
];

export function PlantHourlySheetClient({
  initialDate,
  initialSheets,
  mode = 'combined',
}: PlantHourlySheetClientProps) {
  const showDashboard = mode === 'dashboard' || mode === 'combined';
  const showSheet = mode === 'sheet' || mode === 'combined';

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
      setRows(
        match.rows.map((r) => ({
          ...r,
          productAshPct: typeof r.productAshPct === 'number' ? r.productAshPct : 14.0,
        }))
      );
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
        } else if (key === 'productAshPct') {
          updated.productAshPct = Number(Math.min(45, num).toFixed(1));
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
    const discardPct = totalRom > 0 ? Number((100 - weightedYield).toFixed(1)) : 0;
    const avgAsh =
      rows.length > 0
        ? Number(
            (
              rows.reduce((sum, r) => sum + (Number(r.productAshPct) || 14.0), 0) / rows.length
            ).toFixed(1)
          )
        : 14.0;
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

    // Latest active hour slot with non-zero ROM feed
    const activeRows = rows.filter((r) => r.romFeedTonnes > 0);
    const latestRow = activeRows[activeRows.length - 1] ?? rows[rows.length - 1];
    const latestHourRom = latestRow?.romFeedTonnes ?? 450;
    const latestHourSlot = latestRow?.hourSlot ?? '17:00 - 18:00';
    const latestHourRd = latestRow?.cycloneRd ?? 1.48;
    const nominalRomTph = 460;
    const romCapacityPct = Number(Math.min(125, Math.round((latestHourRom / nominalRomTph) * 100)));

    // Prior shift comparison for Live Production Pulse Graph
    const priorShiftSheet = savedSheets.find(
      (s) => s.shift !== selectedShift || s.date !== selectedDate
    );
    const priorShiftRomTotal = priorShiftSheet
      ? priorShiftSheet.rows.reduce((sum, r) => sum + (Number(r.romFeedTonnes) || 0), 0)
      : 5180;
    const priorShiftRunHours = priorShiftSheet
      ? Math.max(
          1,
          priorShiftSheet.rows.reduce((sum, r) => sum + (Number(r.runMinutes) || 0), 0) / 60
        )
      : 11.8;
    const priorShiftTph = Math.round(priorShiftRomTotal / priorShiftRunHours);
    const throughputDeltaPct =
      priorShiftTph > 0 ? Number((((avgTph - priorShiftTph) / priorShiftTph) * 100).toFixed(1)) : 0;
    const peakHourRom = Math.max(...rows.map((r) => r.romFeedTonnes), 1);

    return {
      totalRom,
      totalClean,
      totalDiscard,
      weightedYield,
      discardPct,
      avgAsh,
      avgRd,
      avgMoisture,
      totalRunMins,
      runHours,
      avgTph,
      latestHourRom,
      latestHourSlot,
      latestHourRd,
      nominalRomTph,
      romCapacityPct,
      priorShiftTph,
      throughputDeltaPct,
      peakHourRom,
    };
  }, [rows, savedSheets, selectedShift, selectedDate]);

  // SVG Pulse Graph coordinates (Card 5) — increased height & vertical padding for spacious layout
  const pulseChartGeometry = useMemo(() => {
    const width = 560;
    const height = 132;
    const padX = 20;
    const padY = 22;
    const usableW = width - padX * 2;
    const usableH = height - padY * 2;
    const minVal = 260;
    const maxVal = Math.max(530, totals.peakHourRom + 25);

    const toPoint = (val: number, idx: number) => {
      const x = padX + (idx / Math.max(1, rows.length - 1)) * usableW;
      const clamped = Math.max(minVal, Math.min(maxVal, val));
      const y = padY + usableH - ((clamped - minVal) / (maxVal - minVal)) * usableH;
      return { x: Number(x.toFixed(1)), y: Number(y.toFixed(1)) };
    };

    const romPoints = rows.map((r, idx) => toPoint(r.romFeedTonnes, idx));
    const cleanPoints = rows.map((r, idx) => toPoint(r.cleanCoalTonnes, idx));
    const romLine = romPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
    const cleanLine = cleanPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
    const romArea = `${romLine} L${romPoints[romPoints.length - 1]?.x ?? width},${height - padY} L${romPoints[0]?.x ?? padX},${height - padY} Z`;
    const priorY = toPoint(totals.priorShiftTph, 0).y;

    return {
      width,
      height,
      padX,
      padY,
      romPoints,
      cleanPoints,
      romLine,
      cleanLine,
      romArea,
      priorY,
    };
  }, [rows, totals.peakHourRom, totals.priorShiftTph]);

  // SVG Pie / Donut Chart geometry for Production Mix (Card 6)
  const pieGeometry = useMemo(() => {
    const radius = 44;
    const circumference = 2 * Math.PI * radius;
    const recoveryFraction = Math.max(0, Math.min(1, totals.weightedYield / 100));
    const productArc = Number((recoveryFraction * circumference).toFixed(2));
    const discardArc = Number(((1 - recoveryFraction) * circumference).toFixed(2));
    return {
      radius,
      circumference: Number(circumference.toFixed(2)),
      productArc,
      discardArc,
    };
  }, [totals.weightedYield]);

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
      'ROM Scale (t/hr)',
      'Clean Product (t/hr)',
      'Discard (t/hr)',
      'Product Yield (% Rec)',
      'Product Ash (% ADB)',
      'Running Density (g/cm3)',
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
          r.productAshPct,
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
        totals.avgAsh,
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

  const recoveryDelta = Number((totals.weightedYield - 90.0).toFixed(1));
  const densityDelta = Number((totals.avgRd - 1.48).toFixed(2));

  return (
    <div className="space-y-6">
      {/* Top Header GlassCard */}
      <GlassCard className="p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight text-[var(--text-heading)]">
                {mode === 'sheet'
                  ? 'Plant & Processing — Hourly Input Sheet'
                  : 'Plant & Processing — Wash Plant Telemetry'}
              </h1>
              <Badge
                variant="outline"
                className="text-xs font-mono bg-amber-500/15 text-amber-800 border-amber-500/30"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 mr-1" />
                {mode === 'sheet' ? 'Excel Grid Workbook' : 'Live DMS & Belt Scale SSoT'}
              </Badge>
            </div>
            <p className="text-xs text-[var(--text-secondary)]">
              {mode === 'sheet'
                ? 'Interactive hourly wash plant workbook for ROM belt-scale feed, clean coal recovery, product ash, and running density.'
                : 'Real-time ROM belt-scale throughput, product recovery yield, washed ash quality, running medium density, and production mix.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {mode === 'sheet' ? (
              <Link
                href="/plant-processing"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-heading)] hover:bg-black/[0.03] transition-colors"
              >
                <BarChart3 className="w-3.5 h-3.5 text-[var(--accent-blue)]" />
                Telemetry Dashboard
              </Link>
            ) : (
              <Link
                href="/plant-processing/hourly-sheet"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-[var(--accent-blue)] text-white hover:opacity-95 transition-all shadow-sm"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Open Hourly Sheet
              </Link>
            )}
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
            {showSheet && (
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
            )}
          </div>
        </div>
      </GlassCard>

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

      {showDashboard && (
        <>
          {/* ── 4 Primary Plant Telemetry GlassCards (ROM Scale, Product Yield, Product Ash, Running Density) ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {/* Card 1: ROM Scale (t/latest hour + graphs and visuals) */}
            <GlassCard className="p-5 space-y-3" data-testid="card-rom-scale">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-1.5">
                  <Scale className="w-3.5 h-3.5 text-emerald-600" />
                  ROM Scale (t / Latest Hour)
                </span>
                <Badge className="bg-emerald-500/15 text-emerald-700 border border-emerald-500/30 text-xs font-mono">
                  {totals.romCapacityPct}% of {totals.nominalRomTph} t/h
                </Badge>
              </div>

              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-2xl font-bold text-[var(--text-heading)] font-mono">
                    {totals.latestHourRom.toLocaleString()} t/hr
                  </p>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    Shift Σ:{' '}
                    <strong className="text-[var(--text-heading)]">
                      {totals.totalRom.toLocaleString()} t
                    </strong>{' '}
                    · Slot: {totals.latestHourSlot.split(' - ')[0]}
                  </p>
                </div>

                {/* Mini 12-Hour ROM Scale Bar Graph Visual */}
                <svg
                  viewBox="0 0 120 34"
                  className="w-28 h-9 shrink-0 overflow-visible"
                  aria-label="ROM Scale 12-hour mini bar graph"
                >
                  {rows.map((r, idx) => {
                    const barH = Math.max(
                      4,
                      Math.min(30, Math.round((r.romFeedTonnes / 520) * 30))
                    );
                    const x = idx * 9.8 + 2;
                    const y = 32 - barH;
                    const isLatest = idx === rows.length - 1;
                    return (
                      <rect
                        key={r.hourSlot}
                        x={x}
                        y={y}
                        width={6.8}
                        height={barH}
                        rx={1.5}
                        className={isLatest ? 'fill-emerald-600' : 'fill-emerald-500/45'}
                      />
                    );
                  })}
                </svg>
              </div>

              <div className="w-full h-2 rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
                <div
                  className="h-full bg-emerald-600 rounded-full transition-all"
                  style={{ width: `${Math.min(100, totals.romCapacityPct)}%` }}
                />
              </div>

              <p className="text-[11px] text-[var(--text-secondary)] font-mono">
                Avg Run-Rate: {totals.avgTph.toLocaleString()} t/hr · Peak: {totals.peakHourRom}{' '}
                t/hr
              </p>
            </GlassCard>

            {/* Card 2: Product Yield (% Recovery) */}
            <GlassCard className="p-5 space-y-3" data-testid="card-product-yield">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
                  Product Yield (% Recovery)
                </span>
                <Badge className="bg-blue-500/15 text-blue-700 border border-blue-500/30 text-xs font-mono">
                  {recoveryDelta >= 0 ? `+${recoveryDelta}%` : `${recoveryDelta}%`} vs Target
                </Badge>
              </div>

              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-2xl font-bold text-[var(--text-heading)] font-mono">
                    {totals.weightedYield.toFixed(1)}% Recovery
                  </p>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    Target: <strong className="text-[var(--text-heading)]">90.0%</strong> · Clean:{' '}
                    {totals.totalClean.toLocaleString()} t
                  </p>
                </div>

                {/* Mini Recovery Sparkline */}
                <svg
                  viewBox="0 0 110 32"
                  className="w-24 h-8 shrink-0"
                  aria-label="Product Yield recovery trend sparkline"
                >
                  <polyline
                    fill="none"
                    stroke="#2563eb"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={rows
                      .map((r, i) => {
                        const x = (i / Math.max(1, rows.length - 1)) * 102 + 4;
                        const y = 28 - Math.max(0, Math.min(24, ((r.yieldPct - 75) / 25) * 24));
                        return `${x.toFixed(1)},${y.toFixed(1)}`;
                      })
                      .join(' ')}
                  />
                </svg>
              </div>

              <div className="w-full h-2 rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
                <div
                  className="h-full bg-blue-600 rounded-full transition-all"
                  style={{ width: `${Math.min(100, totals.weightedYield)}%` }}
                />
              </div>

              <p className="text-[11px] text-[var(--text-secondary)] font-mono">
                Clean Product: {totals.totalClean.toLocaleString()} t · Discard:{' '}
                {totals.totalDiscard.toLocaleString()} t
              </p>
            </GlassCard>

            {/* Card 3: Product Ash (% ADB) */}
            <GlassCard className="p-5 space-y-3" data-testid="card-product-ash">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-indigo-600" />
                  Product Ash (% ADB)
                </span>
                <Badge
                  variant="outline"
                  className={`text-xs font-mono ${
                    totals.avgAsh <= 15.0
                      ? 'bg-indigo-500/10 text-indigo-700 border-indigo-500/30'
                      : 'bg-red-500/15 text-red-700 border-red-500/30'
                  }`}
                >
                  Spec ≤ 15.0% Ash
                </Badge>
              </div>

              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-2xl font-bold text-[var(--text-heading)] font-mono">
                    {totals.avgAsh.toFixed(1)}% Ash
                  </p>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    Raw Feed Ash: <strong className="text-[var(--text-heading)]">28.4%</strong> ·
                    Moisture: {totals.avgMoisture.toFixed(1)}%
                  </p>
                </div>

                {/* Mini Ash Profile Bars */}
                <svg
                  viewBox="0 0 110 32"
                  className="w-24 h-8 shrink-0"
                  aria-label="Product Ash hourly quality profile"
                >
                  {rows.map((r, i) => {
                    const ash = r.productAshPct || 14.0;
                    const h = Math.max(5, Math.min(28, Math.round(((ash - 10) / 8) * 28)));
                    return (
                      <rect
                        key={r.hourSlot}
                        x={i * 8.8 + 2}
                        y={30 - h}
                        width={6}
                        height={h}
                        rx={1.5}
                        className={ash <= 15.0 ? 'fill-indigo-500/65' : 'fill-red-500/75'}
                      />
                    );
                  })}
                </svg>
              </div>

              <div className="w-full h-2 rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
                <div
                  className="h-full bg-indigo-600 rounded-full transition-all"
                  style={{ width: `${Math.min(100, Math.round((totals.avgAsh / 20) * 100))}%` }}
                />
              </div>

              <p className="text-[11px] text-[var(--text-secondary)] font-mono">
                Ash Reduction: -{(28.4 - totals.avgAsh).toFixed(1)}% pts via DMS Cyclones
              </p>
            </GlassCard>

            {/* Card 4: Running Density (DMS RD g/cm³) */}
            <GlassCard className="p-5 space-y-3" data-testid="card-running-density">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-1.5">
                  <Gauge className="w-3.5 h-3.5 text-amber-600" />
                  Running Density
                </span>
                <Badge
                  variant="outline"
                  className="text-xs font-mono bg-amber-500/15 text-amber-800 border-amber-500/30"
                >
                  Setpoint: 1.48 g/cm³
                </Badge>
              </div>

              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-2xl font-bold text-[var(--text-heading)] font-mono">
                    {totals.avgRd.toFixed(2)} g/cm³
                  </p>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    Latest Hour:{' '}
                    <strong className="text-[var(--text-heading)]">
                      {totals.latestHourRd.toFixed(2)} g/cm³
                    </strong>{' '}
                    · Drift: {densityDelta >= 0 ? `+${densityDelta}` : densityDelta}
                  </p>
                </div>

                {/* Mini Running Density Trace */}
                <svg
                  viewBox="0 0 110 32"
                  className="w-24 h-8 shrink-0"
                  aria-label="Running Density hourly trace"
                >
                  <line
                    x1="2"
                    y1="16"
                    x2="108"
                    y2="16"
                    stroke="#d97706"
                    strokeDasharray="3 2"
                    strokeWidth="1"
                  />
                  <polyline
                    fill="none"
                    stroke="#b45309"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={rows
                      .map((r, i) => {
                        const x = (i / Math.max(1, rows.length - 1)) * 102 + 4;
                        const y = 16 - (r.cycloneRd - 1.48) * 180;
                        return `${x.toFixed(1)},${Math.max(4, Math.min(28, y)).toFixed(1)}`;
                      })
                      .join(' ')}
                  />
                </svg>
              </div>

              <div className="pt-1 border-t border-[var(--border-subtle)] flex items-center justify-between text-xs">
                <span className="text-[var(--text-muted)]">Plant Operating Hours:</span>
                <span className="font-mono font-semibold text-[var(--text-heading)]">
                  {totals.runHours} / 12.0 hrs ({totals.totalRunMins} min)
                </span>
              </div>
            </GlassCard>
          </div>

          {/* ── Row 2: Live Production Pulse Graph (lg:col-span-7) & Production Mix Pie Chart (lg:col-span-5) ── */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Card 5: Live Production Pulse Graph (Current throughput t/h + % vs prior shift) */}
            <GlassCard
              className="lg:col-span-7 p-5 flex flex-col gap-3"
              data-testid="card-live-production-pulse"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-[var(--accent-blue)]" />
                    Live Production Pulse Graph — Current Throughput (t/h)
                  </h3>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    Hourly ROM belt scale feed vs. washed clean coal output across active shift
                    windows
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-mono font-bold px-2.5 py-1 rounded-full border ${
                      totals.throughputDeltaPct >= 0
                        ? 'text-emerald-700 bg-emerald-500/10 border-emerald-500/25'
                        : 'text-amber-800 bg-amber-500/15 border-amber-500/30'
                    }`}
                  >
                    {totals.throughputDeltaPct >= 0
                      ? `+${totals.throughputDeltaPct}% vs Prior Shift`
                      : `${totals.throughputDeltaPct}% vs Prior Shift`}
                  </span>
                </div>
              </div>

              {/* Interactive SVG Pulse Chart — Positioned higher with expanded vertical breathing space & refined border */}
              <div className="relative -mt-0.5 rounded-2xl bg-[var(--bg-primary)]/80 border border-[var(--border-default)]/60 px-4 pt-4 pb-3 shadow-sm">
                <svg
                  viewBox={`0 0 ${pulseChartGeometry.width} ${pulseChartGeometry.height}`}
                  className="w-full h-36 overflow-visible"
                  role="img"
                  aria-label="Live Production Pulse Graph showing hourly throughput in tonnes per hour"
                >
                  <defs>
                    <linearGradient id="romPulseGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity="0.28" />
                      <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
                    </linearGradient>
                  </defs>

                  {/* Prior shift average dashed reference line */}
                  <line
                    x1={pulseChartGeometry.padX}
                    y1={pulseChartGeometry.priorY}
                    x2={pulseChartGeometry.width - pulseChartGeometry.padX}
                    y2={pulseChartGeometry.priorY}
                    stroke="#94a3b8"
                    strokeWidth="1.2"
                    strokeDasharray="4 4"
                  />
                  <text
                    x={pulseChartGeometry.width - pulseChartGeometry.padX}
                    y={Math.max(14, pulseChartGeometry.priorY - 6)}
                    textAnchor="end"
                    className="fill-[var(--text-muted)] text-[9.5px] font-mono"
                  >
                    Prior Shift Avg: {totals.priorShiftTph} t/h
                  </text>

                  {/* ROM Feed Area & Line */}
                  <path d={pulseChartGeometry.romArea} fill="url(#romPulseGrad)" />
                  <path
                    d={pulseChartGeometry.romLine}
                    fill="none"
                    stroke="#059669"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {/* Clean Coal Output Line */}
                  <path
                    d={pulseChartGeometry.cleanLine}
                    fill="none"
                    stroke="#2563eb"
                    strokeWidth="2"
                    strokeDasharray="5 3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {/* Hourly Data Nodes */}
                  {pulseChartGeometry.romPoints.map((pt, idx) => {
                    const isLast = idx === pulseChartGeometry.romPoints.length - 1;
                    return (
                      <g key={rows[idx]?.hourSlot ?? idx}>
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={isLast ? 4.5 : 2.5}
                          className={
                            isLast ? 'fill-emerald-600 stroke-white stroke-2' : 'fill-emerald-600'
                          }
                        />
                      </g>
                    );
                  })}
                </svg>

                <div className="flex items-center justify-between text-[10px] font-mono text-[var(--text-muted)] pt-2 mt-1 border-t border-[var(--border-subtle)]">
                  <span>{rows[0]?.hourSlot.split(' - ')[0] ?? '06:00'}</span>
                  <div className="flex items-center gap-4">
                    <span className="inline-flex items-center gap-1.5 text-emerald-700 font-semibold">
                      <span className="w-2 h-2 rounded-full bg-emerald-600" />
                      ROM Throughput (t/h)
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-blue-700 font-semibold">
                      <span className="w-2.5 h-0.5 bg-blue-600" />
                      Clean Coal (t/h)
                    </span>
                  </div>
                  <span>{rows[rows.length - 1]?.hourSlot.split(' - ')[1] ?? '18:00'}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs pt-0.5">
                <div className="p-2.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
                  <p className="text-[10px] text-[var(--text-muted)] font-mono uppercase">
                    Current Throughput
                  </p>
                  <p className="font-bold text-[var(--text-heading)] mt-0.5 font-mono">
                    {totals.avgTph.toLocaleString()} t/h
                  </p>
                </div>
                <div className="p-2.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
                  <p className="text-[10px] text-[var(--text-muted)] font-mono uppercase">
                    Latest Hour Scale
                  </p>
                  <p className="font-bold text-emerald-700 mt-0.5 font-mono">
                    {totals.latestHourRom.toLocaleString()} t/h
                  </p>
                </div>
                <div className="p-2.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
                  <p className="text-[10px] text-[var(--text-muted)] font-mono uppercase">
                    Prior Shift Avg
                  </p>
                  <p className="font-bold text-[var(--text-heading)] mt-0.5 font-mono">
                    {totals.priorShiftTph.toLocaleString()} t/h
                  </p>
                </div>
                <div className="p-2.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
                  <p className="text-[10px] text-[var(--text-muted)] font-mono uppercase">
                    vs Prior Shift
                  </p>
                  <p
                    className={`font-bold mt-0.5 font-mono ${
                      totals.throughputDeltaPct >= 0 ? 'text-emerald-700' : 'text-amber-700'
                    }`}
                  >
                    {totals.throughputDeltaPct >= 0
                      ? `+${totals.throughputDeltaPct}%`
                      : `${totals.throughputDeltaPct}%`}
                  </p>
                </div>
              </div>
            </GlassCard>

            {/* Card 6: Production Mix (Pie Chart with Product, Discard, Recovery) */}
            <GlassCard
              className="lg:col-span-5 p-5 flex flex-col justify-between gap-4"
              data-testid="card-production-mix"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-1.5">
                    <PieChart className="w-3.5 h-3.5 text-emerald-600" />
                    Production Mix — Product, Discard &amp; Recovery
                  </h3>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    Wash plant mass-balance split across Clean Product, Rejects Discard, and %
                    Recovery
                  </p>
                </div>
                <Badge className="bg-emerald-500/15 text-emerald-800 border border-emerald-500/30 font-mono text-xs">
                  {totals.weightedYield.toFixed(1)}% Recovery
                </Badge>
              </div>

              {/* Pie Chart + Mass Balance Breakdown */}
              <div className="flex flex-col sm:flex-row items-center gap-5 my-auto py-1">
                {/* SVG Donut / Pie Chart */}
                <div className="relative w-32 h-32 shrink-0 flex items-center justify-center">
                  <svg
                    viewBox="0 0 110 110"
                    className="w-32 h-32 -rotate-90"
                    role="img"
                    aria-label={`Production Mix Pie Chart: Product ${totals.weightedYield.toFixed(1)}%, Discard ${totals.discardPct.toFixed(1)}%`}
                  >
                    {/* Background / Discard Ring */}
                    <circle
                      cx="55"
                      cy="55"
                      r={pieGeometry.radius}
                      fill="transparent"
                      stroke="#f59e0b"
                      strokeWidth="16"
                    />
                    {/* Foreground / Clean Coal Product Slice */}
                    <circle
                      cx="55"
                      cy="55"
                      r={pieGeometry.radius}
                      fill="transparent"
                      stroke="#10b981"
                      strokeWidth="16"
                      strokeDasharray={`${pieGeometry.productArc} ${pieGeometry.circumference}`}
                      strokeLinecap="butt"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="text-[10px] font-mono uppercase text-[var(--text-muted)]">
                      Recovery
                    </span>
                    <span className="text-base font-bold font-mono text-[var(--text-heading)]">
                      {totals.weightedYield.toFixed(1)}%
                    </span>
                  </div>
                </div>

                {/* Product / Discard / Recovery Breakdown Pills */}
                <div className="flex-1 w-full space-y-2 text-xs">
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                      <span className="font-semibold text-[var(--text-heading)]">
                        Product (Clean Coal)
                      </span>
                    </div>
                    <span className="font-mono font-bold text-emerald-700">
                      {totals.totalClean.toLocaleString()} t ({totals.weightedYield.toFixed(1)}%)
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                      <span className="font-semibold text-[var(--text-heading)]">
                        Discard (Rejects)
                      </span>
                    </div>
                    <span className="font-mono font-bold text-amber-800">
                      {totals.totalDiscard.toLocaleString()} t ({totals.discardPct.toFixed(1)}%)
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-600 shrink-0" />
                      <span className="font-semibold text-[var(--text-heading)]">
                        Recovery Yield
                      </span>
                    </div>
                    <span className="font-mono font-bold text-blue-700">
                      {totals.weightedYield.toFixed(1)}% (Ash {totals.avgAsh.toFixed(1)}%)
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-1 border-t border-[var(--border-subtle)]">
                <Link
                  className="px-3 py-1.5 bg-[var(--accent-blue)] hover:bg-[var(--accent-blue)]/90 text-white font-medium rounded-lg text-xs transition-all"
                  href="/plant-processing/hourly-sheet"
                >
                  + Open Hourly Sheet
                </Link>
                <Link
                  className="px-3 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-heading)] font-medium rounded-lg text-xs transition-all"
                  href="/plant-processing/delays"
                >
                  Log Plant Delays
                </Link>
                <Link
                  className="px-3 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-heading)] font-medium rounded-lg text-xs transition-all"
                  href="/plant-processing/history"
                >
                  Reports Database
                </Link>
              </div>
            </GlassCard>
          </div>
        </>
      )}

      {/* ── Excel-Style Hourly Input Sheet Workbook (Dedicated /plant-processing/hourly-sheet Tab) ── */}
      {showSheet && (
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
              <span className="font-semibold text-[var(--text-heading)]">
                {activeColMeta.label}:
              </span>{' '}
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
                      <td className="p-0 border-r border-[var(--border-default)] min-w-[145px]">
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
                      <td className="p-0 border-r border-[var(--border-default)] min-w-[105px]">
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
                      <td className="p-0 border-r border-[var(--border-default)] min-w-[105px]">
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
                      <td className="p-0 border-r border-[var(--border-default)] min-w-[105px]">
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

                      {/* Col F: Computed Plant Yield (% Recovery) */}
                      <td
                        onClick={() => setActiveCell({ rowIndex, colLetter: 'F', key: 'yieldPct' })}
                        className="py-1.5 px-2.5 border-r border-[var(--border-default)] text-right bg-black/[0.015] min-w-[100px]"
                      >
                        <span
                          className={`inline-block px-2 py-0.5 rounded border text-[11px] font-semibold ${yieldBadgeClass}`}
                        >
                          {row.yieldPct.toFixed(1)}%
                        </span>
                      </td>

                      {/* Col G: Product Ash (% ADB) */}
                      <td className="p-0 border-r border-[var(--border-default)] min-w-[105px]">
                        <input
                          type="number"
                          min={5}
                          max={40}
                          step={0.1}
                          aria-label={`Row ${row.rowNumber} Product Ash`}
                          value={row.productAshPct}
                          onFocus={() =>
                            setActiveCell({ rowIndex, colLetter: 'G', key: 'productAshPct' })
                          }
                          onChange={(e) => updateCell(rowIndex, 'productAshPct', e.target.value)}
                          className="w-full py-2 px-2.5 bg-transparent text-right font-mono text-xs text-indigo-700 font-semibold focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--accent-blue)]"
                        />
                      </td>

                      {/* Col H: Running Density (DMS Cyclone RD) */}
                      <td className="p-0 border-r border-[var(--border-default)] min-w-[110px]">
                        <input
                          type="number"
                          min={1.2}
                          max={2.2}
                          step={0.01}
                          aria-label={`Row ${row.rowNumber} DMS Cyclone RD`}
                          value={row.cycloneRd}
                          onFocus={() =>
                            setActiveCell({ rowIndex, colLetter: 'H', key: 'cycloneRd' })
                          }
                          onChange={(e) => updateCell(rowIndex, 'cycloneRd', e.target.value)}
                          className="w-full py-2 px-2.5 bg-transparent text-right font-mono text-xs text-[var(--text-heading)] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--accent-blue)]"
                        />
                      </td>

                      {/* Col I: Product Moisture % */}
                      <td className="p-0 border-r border-[var(--border-default)] min-w-[95px]">
                        <input
                          type="number"
                          min={0}
                          max={30}
                          step={0.1}
                          aria-label={`Row ${row.rowNumber} Moisture`}
                          value={row.moisturePct}
                          onFocus={() =>
                            setActiveCell({ rowIndex, colLetter: 'I', key: 'moisturePct' })
                          }
                          onChange={(e) => updateCell(rowIndex, 'moisturePct', e.target.value)}
                          className="w-full py-2 px-2.5 bg-transparent text-right font-mono text-xs text-[var(--text-heading)] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--accent-blue)]"
                        />
                      </td>

                      {/* Col J: Run Time (mins) */}
                      <td className="p-0 border-r border-[var(--border-default)] min-w-[90px]">
                        <input
                          type="number"
                          min={0}
                          max={60}
                          step={1}
                          aria-label={`Row ${row.rowNumber} Run Time`}
                          value={row.runMinutes}
                          onFocus={() =>
                            setActiveCell({ rowIndex, colLetter: 'J', key: 'runMinutes' })
                          }
                          onChange={(e) => updateCell(rowIndex, 'runMinutes', e.target.value)}
                          className="w-full py-2 px-2.5 bg-transparent text-right font-mono text-xs text-[var(--text-heading)] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--accent-blue)]"
                        />
                      </td>

                      {/* Col K: Notes */}
                      <td className="p-0 min-w-[240px]">
                        <input
                          type="text"
                          aria-label={`Row ${row.rowNumber} Notes`}
                          value={row.notes}
                          placeholder="Add hourly circuit note..."
                          onFocus={() => setActiveCell({ rowIndex, colLetter: 'K', key: 'notes' })}
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
                  <td className="py-2.5 px-2.5 text-right border-r border-[var(--border-default)] text-indigo-700">
                    {totals.avgAsh.toFixed(1)}%
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
      )}
    </div>
  );
}
