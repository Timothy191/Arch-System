'use client';

import { GlassCard } from '@repo/ui/GlassCard';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Save,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { savePlantHourlySheetAction } from './actions';
import { PlantDelaysWrapupSection } from './PlantDelaysWrapupSection';
import { type EditableColumnKey, PlantHourlyMatrixSection } from './PlantHourlyMatrixSection';
import { PlantHourlyRollupSection, type PlantHourlyTotals } from './PlantHourlyRollupSection';
import { loadStoredPlantSheets, saveStoredPlantSheet } from './storage';
import type { PlantDelayEntry } from './types';
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
  initialDelays?: PlantDelayEntry[];
  mode?: 'dashboard' | 'sheet' | 'combined';
}

const HEADER_GOLD_BTN_BASE =
  'gold-steel-border gold-steel-border-slim inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs';

export function PlantHourlySheetClient({
  initialDate,
  initialSheets,
  initialDelays,
  mode = 'combined',
}: PlantHourlySheetClientProps) {
  const showDashboard = mode === 'dashboard' || mode === 'combined';
  const showSheet = mode === 'sheet' || mode === 'combined';

  const [selectedDate] = useState<string>(initialDate);
  const [selectedShift, setSelectedShift] = useState<PlantShiftType>('day');
  const [selectedModule, setSelectedModule] = useState<PlantModuleId>('DMS-MOD-1');
  const [savedSheets, setSavedSheets] = useState<PlantHourlySheetRecord[]>(initialSheets);
  const [delays] = useState<PlantDelayEntry[]>(() => initialDelays ?? []);
  const [rows, setRows] = useState<PlantHourlyRow[]>(() =>
    initialSheets[0]?.rows ? initialSheets[0].rows : buildDefaultHourlyRows('day')
  );
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

  // Performance Optimization: Replaced 11 separate array iterations (.reduce, .filter, .map)
  // with a single-pass loop over `rows` to compute totals, averages, latest active slot, and peak ROM.
  const totals: PlantHourlyTotals = useMemo(() => {
    let totalRom = 0;
    let totalClean = 0;
    let totalDiscard = 0;
    let totalAsh = 0;
    let totalRd = 0;
    let totalMoisture = 0;
    let totalRunMins = 0;
    let peakHourRom = 1;
    let latestActiveRow: (typeof rows)[number] | undefined;

    for (const r of rows) {
      const rom = Number(r.romFeedTonnes) || 0;
      totalRom += rom;
      totalClean += Number(r.cleanCoalTonnes) || 0;
      totalDiscard += Number(r.discardTonnes) || 0;
      totalAsh += Number(r.productAshPct) || 14.0;
      totalRd += r.cycloneRd;
      totalMoisture += r.moisturePct;
      totalRunMins += Number(r.runMinutes) || 0;

      if (rom > 0) {
        latestActiveRow = r;
      }
      if (rom > peakHourRom) {
        peakHourRom = rom;
      }
    }

    const count = rows.length;
    const weightedYield = calculateRowYield(totalRom, totalClean);
    const discardPct = totalRom > 0 ? Number((100 - weightedYield).toFixed(1)) : 0;
    const avgAsh = count > 0 ? Number((totalAsh / count).toFixed(1)) : 14.0;
    const avgRd = count > 0 ? Number((totalRd / count).toFixed(2)) : 1.48;
    const avgMoisture = count > 0 ? Number((totalMoisture / count).toFixed(1)) : 8.0;
    const runHours = Number((totalRunMins / 60).toFixed(1));
    const avgTph = runHours > 0 ? Math.round(totalRom / runHours) : 0;

    // Latest active hour slot with non-zero ROM feed (or last row as fallback)
    const latestRow = latestActiveRow ?? rows[count - 1];
    const latestHourRom = latestRow?.romFeedTonnes ?? 450;
    const latestHourSlot = latestRow?.hourSlot ?? '17:00 - 18:00';
    const latestHourRd = latestRow?.cycloneRd ?? 1.48;
    const nominalRomTph = 460;
    const romCapacityPct = Number(Math.min(125, Math.round((latestHourRom / nominalRomTph) * 100)));

    // Prior shift comparison for Live Production Pulse Graph
    const priorShiftSheet = savedSheets.find(
      (s) => s.shift !== selectedShift || s.date !== selectedDate
    );
    let priorShiftRomTotal = 5180;
    let priorShiftRunHours = 11.8;

    if (priorShiftSheet) {
      let romSum = 0;
      let runMinsSum = 0;
      for (const pr of priorShiftSheet.rows) {
        romSum += Number(pr.romFeedTonnes) || 0;
        runMinsSum += Number(pr.runMinutes) || 0;
      }
      priorShiftRomTotal = romSum;
      priorShiftRunHours = Math.max(1, runMinsSum / 60);
    }
    const priorShiftTph = Math.round(priorShiftRomTotal / priorShiftRunHours);
    const throughputDeltaPct =
      priorShiftTph > 0 ? Number((((avgTph - priorShiftTph) / priorShiftTph) * 100).toFixed(1)) : 0;

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

  const handleSeamBlendChange = (nextSeam: string) => {
    setSelectedSeamBlend(nextSeam);
    setRows((prev) => prev.map((r) => ({ ...r, seamSource: nextSeam })));
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

  return (
    <div className="space-y-6">
      {/* Top Header GlassCard — Redesigned Command Banner without redundant badge */}
      <GlassCard className="p-5">
        <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
          <div className="flex items-start gap-3.5">
            <div className="gold-steel-border gold-steel-border-slim mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/25 bg-emerald-500/10">
              <Activity className="h-5 w-5 text-emerald-700" />
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="font-bold text-[var(--text-heading)] text-xl tracking-tight sm:text-2xl">
                  {mode === 'sheet'
                    ? 'Plant & Processing — Hourly Input Sheet'
                    : 'Plant & Processing — Wash Plant Telemetry'}
                </h1>
                <span className="gold-steel-border gold-steel-border-slim inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-0.5 font-medium font-mono text-[11px] text-emerald-800">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-600" />
                  {selectedModule} · {selectedShift === 'day' ? 'Day Shift' : 'Night Shift'} ·{' '}
                  {totals.runHours}h Run
                </span>
              </div>
              <p className="text-[var(--text-secondary)] text-xs">
                {mode === 'sheet'
                  ? 'Interactive hourly wash plant workbook for ROM belt-scale feed, clean coal recovery, product ash, and running density.'
                  : 'Real-time ROM belt-scale throughput, product recovery yield, washed ash quality, running medium density, and production mix.'}
              </p>
            </div>
          </div>

          <div className="gold-steel-border gold-steel-border-slim flex flex-wrap items-center gap-1.5 self-start rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)]/90 p-1.5 xl:self-auto">
            {mode === 'sheet' ? (
              <Link
                href="/plant-processing"
                className={`${HEADER_GOLD_BTN_BASE} border border-[var(--border-subtle)] bg-[var(--bg-primary)] font-medium text-[var(--text-heading)] transition-colors hover:bg-black/[0.03]`}
              >
                <BarChart3 className="h-3.5 w-3.5 text-[var(--accent-blue)]" />
                Telemetry Dashboard
              </Link>
            ) : (
              <Link
                href="/plant-processing/hourly-sheet"
                className={`${HEADER_GOLD_BTN_BASE} bg-[var(--accent-blue)] font-semibold text-white shadow-xs transition-all hover:opacity-95`}
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                Hourly Sheet
              </Link>
            )}
            <Link
              href="/plant-processing/delays"
              className={`${HEADER_GOLD_BTN_BASE} border border-amber-500/30 bg-amber-500/10 font-medium text-amber-800 transition-colors hover:bg-amber-500/20`}
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              Log Delay
            </Link>
            <button
              type="button"
              onClick={handleExportCsv}
              className={`${HEADER_GOLD_BTN_BASE} cursor-pointer border border-[var(--border-subtle)] bg-[var(--bg-primary)] font-medium text-[var(--text-heading)] transition-colors hover:bg-black/[0.03]`}
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </button>
            {showSheet && (
              <button
                type="button"
                onClick={handleSaveSheet}
                disabled={isPending}
                data-testid="save-plant-hourly-sheet"
                className={`${HEADER_GOLD_BTN_BASE} cursor-pointer bg-[var(--accent-blue)] font-semibold text-white shadow-xs transition-all hover:opacity-95 disabled:opacity-60`}
              >
                <Save className="h-3.5 w-3.5" />
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
          className="flex items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 font-medium text-emerald-900 text-xs"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>{statusBanner.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusBanner(null)}
            className="cursor-pointer text-[11px] underline opacity-75 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {showDashboard && (
        <>
          <PlantHourlyRollupSection rows={rows} totals={totals} delays={delays} />
          <PlantDelaysWrapupSection
            delays={delays}
            metrics={{
              totalEvents: delays.length,
              totalMinutes: delays.reduce((s, d) => s + d.durationMinutes, 0),
              totalHours: delays.reduce((s, d) => s + d.durationMinutes, 0) / 60,
              availabilityPct: 100,
              topCircuit: delays[0]?.circuit ?? '—',
              topMins: Math.max(0, ...delays.map((d) => d.durationMinutes)),
            }}
          />
        </>
      )}

      {showSheet && (
        <PlantHourlyMatrixSection
          rows={rows}
          totals={totals}
          selectedShift={selectedShift}
          onShiftChange={setSelectedShift}
          selectedModule={selectedModule}
          onModuleChange={setSelectedModule}
          selectedSeamBlend={selectedSeamBlend}
          onSeamBlendChange={handleSeamBlendChange}
          onUpdateCell={updateCell}
        />
      )}
    </div>
  );
}
