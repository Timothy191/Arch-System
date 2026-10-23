'use client';

import { Badge } from '@repo/ui/components/ui/badge';
import { GlassCard } from '@repo/ui/GlassCard';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Flame,
  Gauge,
  Minus,
  PieChart,
  Plus,
  Save,
  Scale,
  Search,
  TrendingUp,
  X,
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

type NumericStreamKey =
  | 'romFeedTonnes'
  | 'cleanCoalTonnes'
  | 'discardTonnes'
  | 'productAshPct'
  | 'cycloneRd'
  | 'moisturePct'
  | 'runMinutes';

interface PlantGridStreamMeta {
  key: NumericStreamKey | 'yieldPct';
  streamName: string;
  code: string;
  unit: string;
  step: number;
  min: number;
  max: number;
  ariaPrefix: string;
  editable: boolean;
  summaryType: 'sum' | 'avg' | 'yield';
}

const PLANT_GRID_STREAMS: ReadonlyArray<PlantGridStreamMeta> = [
  {
    key: 'romFeedTonnes',
    streamName: 'ROM Scale Feed',
    code: 'CV-101 Belt Scale',
    unit: 't/hr',
    step: 5,
    min: 0,
    max: 2000,
    ariaPrefix: 'ROM Feed',
    editable: true,
    summaryType: 'sum',
  },
  {
    key: 'cleanCoalTonnes',
    streamName: 'Clean Coal Product',
    code: 'CV-204 Product Scale',
    unit: 't/hr',
    step: 5,
    min: 0,
    max: 2000,
    ariaPrefix: 'Clean Coal',
    editable: true,
    summaryType: 'sum',
  },
  {
    key: 'discardTonnes',
    streamName: 'Discard / Rejects',
    code: 'CV-301 Rejects Belt',
    unit: 't/hr',
    step: 1,
    min: 0,
    max: 2000,
    ariaPrefix: 'Discard',
    editable: true,
    summaryType: 'sum',
  },
  {
    key: 'yieldPct',
    streamName: 'Product Yield',
    code: 'Mass Balance Rec %',
    unit: '% Rec',
    step: 0.1,
    min: 0,
    max: 100,
    ariaPrefix: 'Product Yield',
    editable: false,
    summaryType: 'yield',
  },
  {
    key: 'productAshPct',
    streamName: 'Product Ash',
    code: 'On-Line Ash Analyzer',
    unit: '% ADB',
    step: 0.1,
    min: 5,
    max: 45,
    ariaPrefix: 'Product Ash',
    editable: true,
    summaryType: 'avg',
  },
  {
    key: 'cycloneRd',
    streamName: 'Running Density',
    code: 'DMS Cyclone Medium',
    unit: 'g/cm³',
    step: 0.01,
    min: 1.2,
    max: 2.2,
    ariaPrefix: 'DMS Cyclone RD',
    editable: true,
    summaryType: 'avg',
  },
  {
    key: 'moisturePct',
    streamName: 'Product Moisture',
    code: 'Centrifuge Dewatering',
    unit: '%',
    step: 0.1,
    min: 0,
    max: 30,
    ariaPrefix: 'Moisture',
    editable: true,
    summaryType: 'avg',
  },
  {
    key: 'runMinutes',
    streamName: 'Circuit Run Time',
    code: 'PLC Run Timer',
    unit: 'min',
    step: 1,
    min: 0,
    max: 60,
    ariaPrefix: 'Run Time',
    editable: true,
    summaryType: 'sum',
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
  const [streamSearch, setStreamSearch] = useState<string>('');
  const [selectedSeamBlend, setSelectedSeamBlend] = useState<string>(
    initialSheets[0]?.rows?.[0]?.seamSource || PLANT_SEAM_OPTIONS[0] || 'Seam 2 ROM'
  );
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
          updated.discardTonnes = Number(Math.max(0, rom - clean).toFixed(1));
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

  // SVG Pulse Graph coordinates (Card 5) — Alternative Paired-Column & Smooth Spline Matrix Design
  const pulseChartGeometry = useMemo(() => {
    const width = 580;
    const height = 164;
    const padLeft = 38;
    const padRight = 14;
    const padTop = 18;
    const padBottom = 26;
    const usableW = width - padLeft - padRight;
    const usableH = height - padTop - padBottom;
    const minVal = 330;
    const maxVal = Math.max(510, totals.peakHourRom + 20);

    const toY = (val: number) => {
      const clamped = Math.max(minVal, Math.min(maxVal, val));
      const y = padTop + usableH - ((clamped - minVal) / (maxVal - minVal)) * usableH;
      return Number(y.toFixed(1));
    };

    const slotStep = usableW / Math.max(1, rows.length);
    const bars = rows.map((r, idx) => {
      const centerX = Number((padLeft + idx * slotStep + slotStep / 2).toFixed(1));
      const romY = toY(r.romFeedTonnes);
      const cleanY = toY(r.cleanCoalTonnes);
      const baselineY = padTop + usableH;
      return {
        hourLabel: r.hourSlot.split(' - ')[0] ?? `${idx + 6}:00`,
        centerX,
        romY,
        romH: Number(Math.max(4, baselineY - romY).toFixed(1)),
        cleanY,
        cleanH: Number(Math.max(4, baselineY - cleanY).toFixed(1)),
        romVal: r.romFeedTonnes,
        cleanVal: r.cleanCoalTonnes,
        yieldPct: r.yieldPct,
      };
    });

    // Smooth cubic bezier curve through ROM feed tops
    const smoothRomPath = bars
      .map((b, i) => {
        if (i === 0) return `M${b.centerX},${b.romY}`;
        const prev = bars[i - 1]!;
        const cpx = Number(((prev.centerX + b.centerX) / 2).toFixed(1));
        return `C${cpx},${prev.romY} ${cpx},${b.romY} ${b.centerX},${b.romY}`;
      })
      .join(' ');

    const priorY = toY(totals.priorShiftTph);
    const gridLevels = [500, 450, 400, 350].map((v) => ({
      val: v,
      y: toY(v),
    }));

    return {
      width,
      height,
      padLeft,
      padRight,
      padTop,
      padBottom,
      baselineY: padTop + usableH,
      bars,
      smoothRomPath,
      priorY,
      gridLevels,
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

  const filteredStreams = useMemo(() => {
    const q = streamSearch.trim().toLowerCase();
    if (!q) return PLANT_GRID_STREAMS;
    return PLANT_GRID_STREAMS.filter(
      (s) =>
        s.streamName.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q) ||
        s.unit.toLowerCase().includes(q)
    );
  }, [streamSearch]);

  const handleSeamBlendChange = (nextSeam: string) => {
    setSelectedSeamBlend(nextSeam);
    setRows((prev) => prev.map((r) => ({ ...r, seamSource: nextSeam })));
  };

  const stepCellValue = (rowIndex: number, stream: PlantGridStreamMeta, direction: 1 | -1) => {
    if (!stream.editable || stream.key === 'yieldPct') return;
    const row = rows[rowIndex];
    if (!row) return;
    const current = Number(row[stream.key]) || 0;
    const decimals = stream.step < 0.1 ? 2 : stream.step < 1 ? 1 : 0;
    const nextVal = Number(
      Math.max(stream.min, Math.min(stream.max, current + direction * stream.step)).toFixed(
        decimals
      )
    );
    updateCell(rowIndex, stream.key, nextVal);
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
      {/* Top Header GlassCard — Redesigned Command Banner without redundant badge */}
      <GlassCard className="p-5">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center shrink-0 mt-0.5">
              <Activity className="w-5 h-5 text-emerald-700" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-heading)]">
                  {mode === 'sheet'
                    ? 'Plant & Processing — Hourly Input Sheet'
                    : 'Plant & Processing — Wash Plant Telemetry'}
                </h1>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium bg-emerald-500/10 text-emerald-800 border border-emerald-500/25">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                  {selectedModule} · {selectedShift === 'day' ? 'Day Shift' : 'Night Shift'} ·{' '}
                  {totals.runHours}h Run
                </span>
              </div>
              <p className="text-xs text-[var(--text-secondary)]">
                {mode === 'sheet'
                  ? 'Interactive hourly wash plant workbook for ROM belt-scale feed, clean coal recovery, product ash, and running density.'
                  : 'Real-time ROM belt-scale throughput, product recovery yield, washed ash quality, running medium density, and production mix.'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-xl bg-[var(--bg-secondary)]/90 border border-[var(--border-default)] self-start xl:self-auto">
            {mode === 'sheet' ? (
              <Link
                href="/plant-processing"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--bg-primary)] text-[var(--text-heading)] border border-[var(--border-subtle)] hover:bg-black/[0.03] transition-colors shadow-2xs"
              >
                <BarChart3 className="w-3.5 h-3.5 text-[var(--accent-blue)]" />
                Telemetry Dashboard
              </Link>
            ) : (
              <Link
                href="/plant-processing/hourly-sheet"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--accent-blue)] text-white hover:opacity-95 transition-all shadow-xs"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Hourly Sheet
              </Link>
            )}
            <Link
              href="/plant-processing/delays"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-amber-500/30 bg-amber-500/10 text-amber-800 hover:bg-amber-500/20 transition-colors"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              Log Delay
            </Link>
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--bg-primary)] text-[var(--text-heading)] border border-[var(--border-subtle)] hover:bg-black/[0.03] transition-colors cursor-pointer"
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
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[var(--accent-blue)] text-white hover:opacity-95 disabled:opacity-60 transition-all shadow-xs cursor-pointer"
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

              {/* Alternative Design: Paired Hourly Column & Smooth Pulse Spline Telemetry Matrix */}
              <div className="relative rounded-2xl bg-[var(--bg-secondary)]/70 border border-[var(--border-default)] p-3.5 space-y-2.5 shadow-xs">
                {/* Top Legend & Benchmark Strip */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[var(--border-subtle)] text-[10px] font-mono">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="inline-flex items-center gap-1.5 text-emerald-800 font-semibold">
                      <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600 inline-block" />
                      ROM Throughput (t/h)
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-blue-800 font-semibold">
                      <span className="w-2.5 h-2.5 rounded-xs bg-blue-600 inline-block" />
                      Clean Coal (t/h)
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-amber-800 font-medium">
                      <span className="w-3 h-0 border-t-2 border-dashed border-amber-600 inline-block" />
                      Prior Shift Avg: {totals.priorShiftTph} t/h
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded-md bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-secondary)] font-semibold">
                    Peak: {totals.peakHourRom} t/h
                  </span>
                </div>

                {/* Paired Hourly Columns + Cubic Bezier Pulse Spline SVG */}
                <svg
                  viewBox={`0 0 ${pulseChartGeometry.width} ${pulseChartGeometry.height}`}
                  className="w-full h-40 overflow-visible"
                  role="img"
                  aria-label="Live Production Pulse Graph showing hourly throughput in tonnes per hour"
                >
                  <defs>
                    <linearGradient id="romColGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#059669" stopOpacity="0.92" />
                      <stop offset="100%" stopColor="#10b981" stopOpacity="0.38" />
                    </linearGradient>
                    <linearGradient id="cleanColGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2563eb" stopOpacity="0.9" />
                      <stop offset="100%" stopColor="#60a5fa" stopOpacity="0.38" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal Y-Axis Gridlines & Labels */}
                  {pulseChartGeometry.gridLevels.map((lvl) => (
                    <g key={lvl.val}>
                      <line
                        x1={pulseChartGeometry.padLeft}
                        y1={lvl.y}
                        x2={pulseChartGeometry.width - pulseChartGeometry.padRight}
                        y2={lvl.y}
                        stroke="currentColor"
                        strokeOpacity="0.08"
                        strokeWidth="1"
                      />
                      <text
                        x={pulseChartGeometry.padLeft - 6}
                        y={lvl.y + 3}
                        textAnchor="end"
                        className="fill-[var(--text-muted)] text-[9px] font-mono"
                      >
                        {lvl.val}
                      </text>
                    </g>
                  ))}

                  {/* Paired Hourly Columns (ROM Feed + Clean Coal) */}
                  {pulseChartGeometry.bars.map((b, idx) => {
                    const isLatest = idx === pulseChartGeometry.bars.length - 1;
                    return (
                      <g key={b.hourLabel}>
                        {/* Subtle slot hover/active column backdrop */}
                        {isLatest && (
                          <rect
                            x={b.centerX - 15}
                            y={pulseChartGeometry.padTop - 4}
                            width={30}
                            height={pulseChartGeometry.baselineY - pulseChartGeometry.padTop + 6}
                            rx={5}
                            className="fill-emerald-500/8 stroke-emerald-500/25"
                            strokeWidth="1"
                          />
                        )}
                        {/* ROM Feed Bar */}
                        <rect
                          x={b.centerX - 10.5}
                          y={b.romY}
                          width={9.5}
                          height={b.romH}
                          rx={2.5}
                          fill="url(#romColGrad)"
                        />
                        {/* Clean Coal Bar */}
                        <rect
                          x={b.centerX + 1}
                          y={b.cleanY}
                          width={9.5}
                          height={b.cleanH}
                          rx={2.5}
                          fill="url(#cleanColGrad)"
                        />
                        {/* X-Axis Hour Label */}
                        <text
                          x={b.centerX}
                          y={pulseChartGeometry.baselineY + 15}
                          textAnchor="middle"
                          className={`text-[9px] font-mono ${
                            isLatest ? 'fill-emerald-700 font-bold' : 'fill-[var(--text-muted)]'
                          }`}
                        >
                          {b.hourLabel}
                        </text>
                      </g>
                    );
                  })}

                  {/* Prior Shift Average Benchmark Dashed Line */}
                  <line
                    x1={pulseChartGeometry.padLeft}
                    y1={pulseChartGeometry.priorY}
                    x2={pulseChartGeometry.width - pulseChartGeometry.padRight}
                    y2={pulseChartGeometry.priorY}
                    stroke="#d97706"
                    strokeWidth="1.5"
                    strokeDasharray="5 3"
                  />

                  {/* Smooth Cubic Bezier ROM Pulse Trend Line + Nodes */}
                  <path
                    d={pulseChartGeometry.smoothRomPath}
                    fill="none"
                    stroke="#047857"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  {pulseChartGeometry.bars.map((b, idx) => {
                    const isLatest = idx === pulseChartGeometry.bars.length - 1;
                    return (
                      <circle
                        key={`node-${b.hourLabel}`}
                        cx={b.centerX - 5.75}
                        cy={b.romY}
                        r={isLatest ? 3.8 : 2.2}
                        className={
                          isLatest ? 'fill-emerald-600 stroke-white stroke-2' : 'fill-emerald-700'
                        }
                      />
                    );
                  })}
                </svg>
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
              </div>
            </GlassCard>
          </div>
        </>
      )}

      {/* ── Control Room Style 12-Hour Matrix Grid (Dedicated /plant-processing/hourly-sheet Tab) ── */}
      {showSheet && (
        <div className="space-y-4">
          {/* Shift & Circuit Module Selector Row (Matching Control Room Hourly Loads Layout) */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[var(--text-secondary)] text-xs font-semibold uppercase tracking-wider">
                Shift:
              </span>
              <div className="flex gap-2" role="group" aria-label="Shift selector">
                <button
                  type="button"
                  onClick={() => setSelectedShift('day')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer gold-steel-border gold-steel-border-slim ${
                    selectedShift === 'day'
                      ? 'bg-[var(--accent-blue)] text-white'
                      : 'bg-[var(--bg-secondary)] border border-[var(--border-default)] text-[var(--text-heading)] hover:bg-[var(--bg-tertiary)]'
                  }`}
                >
                  Day Shift (06:00–18:00)
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedShift('night')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer gold-steel-border gold-steel-border-slim ${
                    selectedShift === 'night'
                      ? 'bg-[var(--accent-blue)] text-white'
                      : 'bg-[var(--bg-secondary)] border border-[var(--border-default)] text-[var(--text-heading)] hover:bg-[var(--bg-tertiary)]'
                  }`}
                >
                  Night Shift (18:00–06:00)
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-xs font-semibold text-[var(--text-heading)]">
                <span>Circuit:</span>
                <select
                  aria-label="Plant Circuit Module"
                  value={selectedModule}
                  onChange={(e) => setSelectedModule(e.target.value as PlantModuleId)}
                  className="px-2.5 py-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-heading)] text-xs font-medium"
                >
                  <option value="DMS-MOD-1">DMS Module 1 — Primary Wash Plant</option>
                  <option value="DMS-MOD-2">DMS Module 2 — Secondary &amp; Fines</option>
                </select>
              </label>

              <label className="flex items-center gap-2 text-xs font-semibold text-[var(--text-heading)]">
                <span>Feed Blend:</span>
                <select
                  aria-label="Feed Seam Blend"
                  value={selectedSeamBlend}
                  onChange={(e) => handleSeamBlendChange(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-heading)] text-xs font-medium"
                >
                  {PLANT_SEAM_OPTIONS.map((seam) => (
                    <option key={seam} value={seam}>
                      {seam}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {/* Main 12-Hour Matrix Grid Card (Matching Control Room HourlyLoadsGrid) */}
          <div className="revo-grid-visible">
            <GlassCard className="p-0 overflow-hidden border border-[var(--border-default)] bg-[var(--bg-primary)] shadow-sm">
              <div className="overflow-x-auto w-full">
                <table
                  className="w-full text-left border-collapse"
                  aria-label="Plant and Processing Hourly Input Sheet"
                >
                  <thead>
                    <tr className="border-b border-[var(--border-default)] bg-[var(--bg-secondary)]/60 text-xs font-semibold text-[var(--text-muted)]">
                      <th
                        scope="col"
                        className="py-2.5 px-3 text-left min-w-[190px] sticky left-0 z-20 bg-[var(--bg-secondary)] shadow-[1px_0_0_0_var(--border-default)] align-top"
                      >
                        <div className="space-y-1.5">
                          <span className="block text-xs font-bold text-[var(--text-heading)]">
                            Plant Stream / Metric
                          </span>
                          <div className="relative">
                            <Search className="w-3 h-3 text-[var(--text-muted)] absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <input
                              type="text"
                              value={streamSearch}
                              onChange={(e) => setStreamSearch(e.target.value)}
                              placeholder="Filter plant stream..."
                              aria-label="Filter plant stream"
                              className="w-full bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-md pl-6 pr-6 py-1 text-[11px] font-normal text-[var(--text-heading)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)]"
                            />
                            {streamSearch && (
                              <button
                                type="button"
                                onClick={() => setStreamSearch('')}
                                aria-label="Clear stream filter"
                                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-heading)]"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      </th>
                      <th scope="col" className="py-2.5 px-3 text-left min-w-[155px] align-top">
                        <div className="space-y-1">
                          <span className="block text-xs font-bold text-[var(--text-heading)]">
                            Circuit &amp; Unit
                          </span>
                          <span className="block text-[11px] font-mono text-[var(--text-secondary)]">
                            {selectedModule}
                          </span>
                        </div>
                      </th>
                      {rows.map((row) => {
                        const shortStart = row.hourSlot.split(' - ')[0] ?? row.hourSlot;
                        return (
                          <th
                            key={row.hourSlot}
                            scope="col"
                            className="py-2.5 px-1.5 text-center min-w-[92px]"
                          >
                            <span className="block font-mono font-bold text-xs text-[var(--text-heading)]">
                              {shortStart}
                            </span>
                            <span className="block font-mono text-[9px] text-[var(--text-muted)] font-normal">
                              {row.hourSlot}
                            </span>
                          </th>
                        );
                      })}
                      <th scope="col" className="py-2.5 px-3 text-right min-w-[95px] align-middle">
                        <span className="block text-xs font-bold text-[var(--text-heading)]">
                          Total / Avg
                        </span>
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-[var(--border-default)]/60 text-xs text-[var(--text-heading)]">
                    {filteredStreams.map((stream) => {
                      let summaryDisplay = '';
                      if (stream.key === 'romFeedTonnes') {
                        summaryDisplay = `${totals.totalRom.toLocaleString()} t`;
                      } else if (stream.key === 'cleanCoalTonnes') {
                        summaryDisplay = `${totals.totalClean.toLocaleString()} t`;
                      } else if (stream.key === 'discardTonnes') {
                        summaryDisplay = `${totals.totalDiscard.toLocaleString()} t`;
                      } else if (stream.key === 'yieldPct') {
                        summaryDisplay = `${totals.weightedYield.toFixed(1)}%`;
                      } else if (stream.key === 'productAshPct') {
                        summaryDisplay = `${totals.avgAsh.toFixed(1)}%`;
                      } else if (stream.key === 'cycloneRd') {
                        summaryDisplay = `${totals.avgRd.toFixed(2)}`;
                      } else if (stream.key === 'moisturePct') {
                        summaryDisplay = `${totals.avgMoisture.toFixed(1)}%`;
                      } else if (stream.key === 'runMinutes') {
                        summaryDisplay = `${totals.totalRunMins}m`;
                      }

                      return (
                        <tr
                          key={stream.key}
                          className="transition-colors hover:bg-[var(--bg-secondary)]/40"
                        >
                          {/* Stream Name Column (Sticky Left) */}
                          <td className="py-2.5 px-3 font-medium sticky left-0 z-10 bg-[var(--bg-primary)] shadow-[1px_0_0_0_var(--border-default)]">
                            <div className="min-w-[160px]">
                              <span className="block font-bold text-xs text-[var(--text-heading)]">
                                {stream.streamName}
                              </span>
                              <span className="block text-[10px] text-[var(--text-secondary)]">
                                {stream.code}
                              </span>
                            </div>
                          </td>

                          {/* Circuit / Unit Column */}
                          <td className="py-2.5 px-3 min-w-[140px]">
                            <div className="flex items-center justify-between gap-1.5">
                              <span className="text-[11px] font-medium text-[var(--text-secondary)] truncate">
                                {selectedSeamBlend}
                              </span>
                              <span className="px-1.5 py-0.5 rounded bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] font-mono font-semibold text-[10px] shrink-0">
                                {stream.unit}
                              </span>
                            </div>
                          </td>

                          {/* 12 Hourly Cells (Control Room Stepper + Direct Input Format) */}
                          {rows.map((row, hourIdx) => {
                            const streamKey = stream.key;
                            if (!stream.editable || streamKey === 'yieldPct') {
                              const yieldBadgeClass =
                                row.yieldPct >= 88
                                  ? 'bg-emerald-500/15 text-emerald-800 border-emerald-500/30'
                                  : row.yieldPct >= 80
                                    ? 'bg-amber-500/15 text-amber-800 border-amber-500/30'
                                    : 'bg-red-500/15 text-red-800 border-red-500/30';
                              return (
                                <td
                                  key={`${streamKey}-${row.hourSlot}`}
                                  className="py-2 px-1 text-center bg-black/[0.015]"
                                >
                                  <span
                                    className={`inline-block px-2 py-0.5 rounded border font-mono text-[11px] font-semibold ${yieldBadgeClass}`}
                                  >
                                    {row.yieldPct.toFixed(1)}%
                                  </span>
                                </td>
                              );
                            }

                            const cellValue = row[streamKey];
                            return (
                              <td
                                key={`${streamKey}-${row.hourSlot}`}
                                className="py-1.5 px-1 text-center"
                              >
                                <div className="inline-flex items-center justify-center gap-0.5 rounded border border-[var(--border-default)]/60 bg-[var(--bg-secondary)]/50 p-0.5 focus-within:border-[var(--accent-blue)] focus-within:ring-1 focus-within:ring-[var(--accent-blue)]">
                                  <button
                                    type="button"
                                    onClick={() => stepCellValue(hourIdx, stream, -1)}
                                    aria-label={`Decrease Row ${row.rowNumber} ${stream.ariaPrefix}`}
                                    className="h-6 w-4 inline-flex items-center justify-center rounded text-[var(--text-muted)] hover:bg-black/5 hover:text-[var(--text-heading)] cursor-pointer transition-colors"
                                  >
                                    <Minus className="w-2.5 h-2.5" />
                                  </button>
                                  <input
                                    type="number"
                                    min={stream.min}
                                    max={stream.max}
                                    step={stream.step}
                                    aria-label={`Row ${row.rowNumber} ${stream.ariaPrefix}`}
                                    value={cellValue}
                                    onChange={(e) => updateCell(hourIdx, streamKey, e.target.value)}
                                    className="w-12 text-center font-mono text-xs font-semibold py-0.5 bg-transparent text-[var(--text-heading)] focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => stepCellValue(hourIdx, stream, 1)}
                                    aria-label={`Increase Row ${row.rowNumber} ${stream.ariaPrefix}`}
                                    className="h-6 w-4 inline-flex items-center justify-center rounded text-[var(--text-muted)] hover:bg-black/5 hover:text-[var(--text-heading)] cursor-pointer transition-colors"
                                  >
                                    <Plus className="w-2.5 h-2.5" />
                                  </button>
                                </div>
                              </td>
                            );
                          })}

                          {/* Shift Total / Avg Column */}
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-xs text-[var(--text-heading)] tabular-nums min-w-[95px] bg-[var(--bg-secondary)]/30">
                            {summaryDisplay}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>

                  <tfoot>
                    <tr className="bg-[var(--bg-secondary)]/80 border-t-2 border-[var(--border-default)] font-mono text-xs font-bold text-[var(--text-heading)]">
                      <td className="py-2.5 px-3 sticky left-0 z-10 bg-[var(--bg-secondary)] shadow-[1px_0_0_0_var(--border-default)]">
                        Net Mass Balance
                      </td>
                      <td className="py-2.5 px-3 text-[11px] font-sans font-medium text-[var(--text-secondary)]">
                        Recovery Yield %
                      </td>
                      {rows.map((row) => (
                        <td
                          key={`footer-${row.hourSlot}`}
                          className="py-2.5 px-1 text-center text-[var(--accent-blue)]"
                        >
                          {row.yieldPct.toFixed(1)}%
                        </td>
                      ))}
                      <td className="py-2.5 px-3 text-right text-emerald-700">
                        {totals.weightedYield.toFixed(1)}% ({totals.runHours}h)
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </GlassCard>
          </div>
        </div>
      )}
    </div>
  );
}
