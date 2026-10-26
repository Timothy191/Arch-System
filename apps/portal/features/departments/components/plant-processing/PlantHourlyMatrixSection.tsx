'use client';

import { GlassCard } from '@repo/ui/GlassCard';
import { Minus, Plus, Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { PlantHourlyTotals } from './PlantHourlyRollupSection';
import {
  PLANT_SEAM_OPTIONS,
  type PlantHourlyRow,
  type PlantModuleId,
  type PlantShiftType,
} from './types';

export type EditableColumnKey =
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

const STEPPER_WRAPPER_CLASS =
  'inline-flex items-center justify-center gap-0.5 rounded border border-[var(--border-default)]/60 bg-[var(--bg-secondary)]/50 p-0.5 focus-within:border-[var(--accent-blue)] focus-within:ring-1 focus-within:ring-[var(--accent-blue)]';

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

interface PlantHourlyMatrixSectionProps {
  rows: PlantHourlyRow[];
  totals: PlantHourlyTotals;
  selectedShift: PlantShiftType;
  onShiftChange: (shift: PlantShiftType) => void;
  selectedModule: PlantModuleId;
  onModuleChange: (moduleId: PlantModuleId) => void;
  selectedSeamBlend: string;
  onSeamBlendChange: (seam: string) => void;
  onUpdateCell: (rowIndex: number, key: EditableColumnKey, rawValue: string | number) => void;
}

export function PlantHourlyMatrixSection({
  rows,
  totals,
  selectedShift,
  onShiftChange,
  selectedModule,
  onModuleChange,
  selectedSeamBlend,
  onSeamBlendChange,
  onUpdateCell,
}: PlantHourlyMatrixSectionProps) {
  const [streamSearch, setStreamSearch] = useState<string>('');

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
    onUpdateCell(rowIndex, stream.key, nextVal);
  };

  return (
    <div className="space-y-4">
      {/* Shift & Circuit Module Selector Row (Matching Control Room Hourly Loads Layout) */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-semibold text-[var(--text-secondary)] text-xs uppercase tracking-wider">
            Shift:
          </span>
          <div className="flex gap-2" role="group" aria-label="Shift selector">
            <button
              type="button"
              onClick={() => onShiftChange('day')}
              className={`gold-steel-border gold-steel-border-slim cursor-pointer rounded-lg px-3.5 py-1.5 font-semibold text-xs transition-colors ${
                selectedShift === 'day'
                  ? 'bg-[var(--accent-blue)] text-white'
                  : 'border border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-heading)] hover:bg-[var(--bg-tertiary)]'
              }`}
            >
              Day Shift (06:00–18:00)
            </button>
            <button
              type="button"
              onClick={() => onShiftChange('night')}
              className={`gold-steel-border gold-steel-border-slim cursor-pointer rounded-lg px-3.5 py-1.5 font-semibold text-xs transition-colors ${
                selectedShift === 'night'
                  ? 'bg-[var(--accent-blue)] text-white'
                  : 'border border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-heading)] hover:bg-[var(--bg-tertiary)]'
              }`}
            >
              Night Shift (18:00–06:00)
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 font-semibold text-[var(--text-heading)] text-xs">
            <span>Circuit:</span>
            <select
              aria-label="Plant Circuit Module"
              value={selectedModule}
              onChange={(e) => onModuleChange(e.target.value as PlantModuleId)}
              className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-2.5 py-1.5 font-medium text-[var(--text-heading)] text-xs"
            >
              <option value="DMS-MOD-1">DMS Module 1 — Primary Wash Plant</option>
              <option value="DMS-MOD-2">DMS Module 2 — Secondary &amp; Fines</option>
            </select>
          </label>

          <label className="flex items-center gap-2 font-semibold text-[var(--text-heading)] text-xs">
            <span>Feed Blend:</span>
            <select
              aria-label="Feed Seam Blend"
              value={selectedSeamBlend}
              onChange={(e) => onSeamBlendChange(e.target.value)}
              className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-2.5 py-1.5 font-medium text-[var(--text-heading)] text-xs"
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
        <GlassCard className="overflow-hidden border border-[var(--border-default)] bg-[var(--bg-primary)] p-0 shadow-sm">
          <div className="w-full overflow-x-auto">
            <table
              className="w-full border-collapse text-left"
              aria-label="Plant and Processing Hourly Input Sheet"
            >
              <thead>
                <tr className="border-[var(--border-default)] border-b bg-[var(--bg-secondary)]/60 font-semibold text-[var(--text-muted)] text-xs">
                  <th
                    scope="col"
                    className="sticky left-0 z-20 min-w-[190px] bg-[var(--bg-secondary)] px-3 py-2.5 text-left align-top shadow-[1px_0_0_0_var(--border-default)]"
                  >
                    <div className="space-y-1.5">
                      <span className="block font-bold text-[var(--text-heading)] text-xs">
                        Plant Stream / Metric
                      </span>
                      <div className="relative">
                        <Search className="pointer-events-none absolute top-1/2 left-2 h-3 w-3 -translate-y-1/2 text-[var(--text-muted)]" />
                        <input
                          type="text"
                          value={streamSearch}
                          onChange={(e) => setStreamSearch(e.target.value)}
                          placeholder="Filter plant stream..."
                          aria-label="Filter plant stream"
                          className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-primary)] py-1 pr-6 pl-6 font-normal text-[11px] text-[var(--text-heading)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)]"
                        />
                        {streamSearch && (
                          <button
                            type="button"
                            onClick={() => setStreamSearch('')}
                            aria-label="Clear stream filter"
                            className="absolute top-1/2 right-1.5 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-heading)]"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </th>
                  <th scope="col" className="min-w-[155px] px-3 py-2.5 text-left align-top">
                    <div className="space-y-1">
                      <span className="block font-bold text-[var(--text-heading)] text-xs">
                        Circuit &amp; Unit
                      </span>
                      <span className="block font-mono text-[11px] text-[var(--text-secondary)]">
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
                        className="min-w-[92px] px-1.5 py-2.5 text-center"
                      >
                        <span className="block font-bold font-mono text-[var(--text-heading)] text-xs">
                          {shortStart}
                        </span>
                        <span className="block font-mono font-normal text-[9px] text-[var(--text-muted)]">
                          {row.hourSlot}
                        </span>
                      </th>
                    );
                  })}
                  <th scope="col" className="min-w-[95px] px-3 py-2.5 text-right align-middle">
                    <span className="block font-bold text-[var(--text-heading)] text-xs">
                      Total / Avg
                    </span>
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[var(--border-default)]/60 text-[var(--text-heading)] text-xs">
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
                      <td className="sticky left-0 z-10 bg-[var(--bg-primary)] px-3 py-2.5 font-medium shadow-[1px_0_0_0_var(--border-default)]">
                        <div className="min-w-[160px]">
                          <span className="block font-bold text-[var(--text-heading)] text-xs">
                            {stream.streamName}
                          </span>
                          <span className="block text-[10px] text-[var(--text-secondary)]">
                            {stream.code}
                          </span>
                        </div>
                      </td>

                      {/* Circuit / Unit Column */}
                      <td className="min-w-[140px] px-3 py-2.5">
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="truncate font-medium text-[11px] text-[var(--text-secondary)]">
                            {selectedSeamBlend}
                          </span>
                          <span className="shrink-0 rounded bg-[var(--accent-blue)]/10 px-1.5 py-0.5 font-mono font-semibold text-[10px] text-[var(--accent-blue)]">
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
                              className="bg-black/[0.015] px-1 py-2 text-center"
                            >
                              <span
                                className={`inline-block rounded border px-2 py-0.5 font-mono font-semibold text-[11px] ${yieldBadgeClass}`}
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
                            className="px-1 py-1.5 text-center"
                          >
                            <div className={STEPPER_WRAPPER_CLASS}>
                              <button
                                type="button"
                                onClick={() => stepCellValue(hourIdx, stream, -1)}
                                aria-label={`Decrease Row ${row.rowNumber} ${stream.ariaPrefix}`}
                                className="inline-flex h-6 w-4 cursor-pointer items-center justify-center rounded text-[var(--text-muted)] transition-colors hover:bg-black/5 hover:text-[var(--text-heading)]"
                              >
                                <Minus className="h-2.5 w-2.5" />
                              </button>
                              <input
                                type="number"
                                min={stream.min}
                                max={stream.max}
                                step={stream.step}
                                aria-label={`Row ${row.rowNumber} ${stream.ariaPrefix}`}
                                value={cellValue}
                                onChange={(e) => onUpdateCell(hourIdx, streamKey, e.target.value)}
                                className="w-12 bg-transparent py-0.5 text-center font-mono font-semibold text-[var(--text-heading)] text-xs [appearance:textfield] focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                              />
                              <button
                                type="button"
                                onClick={() => stepCellValue(hourIdx, stream, 1)}
                                aria-label={`Increase Row ${row.rowNumber} ${stream.ariaPrefix}`}
                                className="inline-flex h-6 w-4 cursor-pointer items-center justify-center rounded text-[var(--text-muted)] transition-colors hover:bg-black/5 hover:text-[var(--text-heading)]"
                              >
                                <Plus className="h-2.5 w-2.5" />
                              </button>
                            </div>
                          </td>
                        );
                      })}

                      {/* Shift Total / Avg Column */}
                      <td className="min-w-[95px] bg-[var(--bg-secondary)]/30 px-3 py-2.5 text-right font-bold font-mono text-[var(--text-heading)] text-xs tabular-nums">
                        {summaryDisplay}
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              <tfoot>
                <tr className="border-[var(--border-default)] border-t-2 bg-[var(--bg-secondary)]/80 font-bold font-mono text-[var(--text-heading)] text-xs">
                  <td className="sticky left-0 z-10 bg-[var(--bg-secondary)] px-3 py-2.5 shadow-[1px_0_0_0_var(--border-default)]">
                    Net Mass Balance
                  </td>
                  <td className="px-3 py-2.5 font-medium font-sans text-[11px] text-[var(--text-secondary)]">
                    Recovery Yield %
                  </td>
                  {rows.map((row) => (
                    <td
                      key={`footer-${row.hourSlot}`}
                      className="px-1 py-2.5 text-center text-[var(--accent-blue)]"
                    >
                      {row.yieldPct.toFixed(1)}%
                    </td>
                  ))}
                  <td className="px-3 py-2.5 text-right text-emerald-700">
                    {totals.weightedYield.toFixed(1)}% ({totals.runHours}h)
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
