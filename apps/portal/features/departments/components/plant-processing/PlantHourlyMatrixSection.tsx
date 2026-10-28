'use client';

import { GlassCard } from '@repo/ui/GlassCard';
import { Minus, Plus, Search, X } from 'lucide-react';
import { Fragment, useMemo, useState } from 'react';
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
  | 'plantFeedTonnes'
  | 'cycloneFeedTonnes'
  | 'newProductScaleTonnes'
  | 'cleanCoalTonnes'
  | 'discardTonnes'
  | 'productAshPct'
  | 'cycloneRd'
  | 'moisturePct'
  | 'runMinutes'
  | 'notes';

type NumericStreamKey =
  | 'romFeedTonnes'
  | 'plantFeedTonnes'
  | 'cycloneFeedTonnes'
  | 'newProductScaleTonnes'
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

const STEPPER_BTN_CLASS =
  'inline-flex h-6 w-4 cursor-pointer items-center justify-center rounded text-[var(--text-muted)] transition-colors hover:bg-black/5 hover:text-[var(--text-heading)]';

const STEPPER_INPUT_CLASS =
  'w-12 bg-transparent py-0.5 text-center font-mono font-semibold text-[var(--text-heading)] text-xs [appearance:textfield] focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';

const STREAM_FILTER_INPUT_CLASS =
  'w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-primary)] py-1 pr-6 pl-6 font-normal text-[11px] text-[var(--text-heading)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)]';

const MATERIAL_SELECT_CLASS =
  'w-full cursor-pointer rounded-md border border-[var(--border-default)] bg-[var(--bg-secondary)] px-2 py-1 font-medium text-[11px] text-[var(--text-heading)] transition-colors hover:border-[var(--accent-blue)]/50 focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)]';

const HEADER_MATERIAL_SELECT_CLASS =
  'w-full cursor-pointer rounded-md border border-[var(--border-default)] bg-[var(--bg-primary)] px-2 py-1 font-medium text-[11px] text-[var(--text-heading)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)]';

const VARIANCE_BADGE_BASE_CLASS =
  'inline-flex min-w-[44px] items-center justify-center rounded border px-1.5 py-0.5 font-mono font-semibold text-[10px] tabular-nums';

const DECIMAL_THRESHOLD_TWO = 0.1;
const DECIMAL_THRESHOLD_ONE = 1;
const DECIMALS_TWO = 2;
const DECIMALS_ONE = 1;
const DECIMALS_ZERO = 0;
const YIELD_HIGH_THRESHOLD = 88;
const YIELD_MID_THRESHOLD = 80;

const PLANT_FEED_RATIO = 0.96;
const CYCLONE_FEED_RATIO = 0.82;

const PLANT_GRID_STREAMS: ReadonlyArray<PlantGridStreamMeta> = [
  {
    key: 'romFeedTonnes',
    streamName: 'ROM Scale',
    code: 'CV-101 ROM Scale Feed',
    unit: 't/hr',
    step: 5,
    min: 0,
    max: 2000,
    ariaPrefix: 'ROM Feed',
    editable: true,
    summaryType: 'sum',
  },
  {
    key: 'plantFeedTonnes',
    streamName: 'Plant Feed',
    code: 'CV-102 Desliming Feed',
    unit: 't/hr',
    step: 5,
    min: 0,
    max: 2000,
    ariaPrefix: 'Plant Feed',
    editable: true,
    summaryType: 'sum',
  },
  {
    key: 'cycloneFeedTonnes',
    streamName: 'Cyclone Feed',
    code: 'DM-301 DMS Cyclone Feed',
    unit: 't/hr',
    step: 5,
    min: 0,
    max: 2000,
    ariaPrefix: 'Cyclone Feed',
    editable: true,
    summaryType: 'sum',
  },
  {
    key: 'newProductScaleTonnes',
    streamName: 'New Product Scale',
    code: 'CV-204 New Product Belt',
    unit: 't/hr',
    step: 5,
    min: 0,
    max: 2000,
    ariaPrefix: 'New Product Scale',
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

function getStepDecimals(step: number): number {
  if (step < DECIMAL_THRESHOLD_TWO) return DECIMALS_TWO;
  if (step < DECIMAL_THRESHOLD_ONE) return DECIMALS_ONE;
  return DECIMALS_ZERO;
}

function getRowStreamMetric(row: PlantHourlyRow, streamKey: PlantGridStreamMeta['key']): number {
  if (streamKey === 'plantFeedTonnes') {
    return row.plantFeedTonnes ?? Math.round(row.romFeedTonnes * PLANT_FEED_RATIO);
  }
  if (streamKey === 'cycloneFeedTonnes') {
    return row.cycloneFeedTonnes ?? Math.round(row.romFeedTonnes * CYCLONE_FEED_RATIO);
  }
  if (streamKey === 'newProductScaleTonnes') {
    return row.newProductScaleTonnes ?? row.cleanCoalTonnes;
  }
  return Number(row[streamKey]) || 0;
}

function computeHourlyVariance(
  rows: readonly PlantHourlyRow[],
  hourIdx: number,
  streamKey: PlantGridStreamMeta['key']
): number {
  const currentRow = rows[hourIdx];
  if (!currentRow) return 0;
  const currentMetric = getRowStreamMetric(currentRow, streamKey);
  const nextRow = rows[hourIdx + 1];
  if (nextRow) {
    const nextMetric = getRowStreamMetric(nextRow, streamKey);
    return nextMetric - currentMetric;
  }
  const prevRow = rows[hourIdx - 1];
  if (prevRow) {
    const prevMetric = getRowStreamMetric(prevRow, streamKey);
    return currentMetric - prevMetric;
  }
  return 0;
}

function formatVarianceBadge(rawVariance: number, decimals: number, suffix = '') {
  const rounded = Number(rawVariance.toFixed(decimals));
  if (rounded > 0) {
    return {
      text: `+${rounded.toFixed(decimals)}${suffix}`,
      toneClass: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800',
    };
  }
  if (rounded < 0) {
    return {
      text: `${rounded.toFixed(decimals)}${suffix}`,
      toneClass: 'border-amber-500/30 bg-amber-500/10 text-amber-800',
    };
  }
  return {
    text: `0${suffix}`,
    toneClass:
      'border-[var(--border-default)] bg-[var(--bg-secondary)]/60 text-[var(--text-muted)]',
  };
}

function formatStreamSummary(
  streamKey: PlantGridStreamMeta['key'],
  totals: PlantHourlyTotals,
  rows: readonly PlantHourlyRow[]
) {
  const totalPlantFeed = rows.reduce((sum, r) => sum + getRowStreamMetric(r, 'plantFeedTonnes'), 0);
  const totalCycloneFeed = rows.reduce(
    (sum, r) => sum + getRowStreamMetric(r, 'cycloneFeedTonnes'),
    0
  );
  const totalNewProductScale = rows.reduce(
    (sum, r) => sum + getRowStreamMetric(r, 'newProductScaleTonnes'),
    0
  );
  const summaryMap: Record<PlantGridStreamMeta['key'], string> = {
    romFeedTonnes: `${totals.totalRom.toLocaleString()} t`,
    plantFeedTonnes: `${totalPlantFeed.toLocaleString()} t`,
    cycloneFeedTonnes: `${totalCycloneFeed.toLocaleString()} t`,
    newProductScaleTonnes: `${totalNewProductScale.toLocaleString()} t`,
    cleanCoalTonnes: `${totals.totalClean.toLocaleString()} t`,
    discardTonnes: `${totals.totalDiscard.toLocaleString()} t`,
    yieldPct: `${totals.weightedYield.toFixed(DECIMALS_ONE)}%`,
    productAshPct: `${totals.avgAsh.toFixed(DECIMALS_ONE)}%`,
    cycloneRd: `${totals.avgRd.toFixed(DECIMALS_TWO)}`,
    moisturePct: `${totals.avgMoisture.toFixed(DECIMALS_ONE)}%`,
    runMinutes: `${totals.totalRunMins}m`,
  };
  return summaryMap[streamKey];
}

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
  const [streamMaterials, setStreamMaterials] = useState<Record<string, string>>({});

  const filteredStreams = useMemo(() => {
    const query = streamSearch.trim().toLowerCase();
    if (!query) return PLANT_GRID_STREAMS;
    return PLANT_GRID_STREAMS.filter(
      (stream) =>
        stream.streamName.toLowerCase().includes(query) ||
        stream.code.toLowerCase().includes(query) ||
        stream.unit.toLowerCase().includes(query)
    );
  }, [streamSearch]);

  const handleGlobalMaterialChange = (nextSeam: string) => {
    setStreamMaterials({});
    onSeamBlendChange(nextSeam);
  };

  const handleStreamMaterialChange = (streamKey: string, nextSeam: string) => {
    setStreamMaterials((prev) => ({
      ...prev,
      [streamKey]: nextSeam,
    }));
    if (streamKey === 'romFeedTonnes') {
      onUpdateCell(0, 'seamSource', nextSeam);
    }
  };

  const stepCellValue = (rowIndex: number, stream: PlantGridStreamMeta, direction: 1 | -1) => {
    if (!stream.editable || stream.key === 'yieldPct') return;
    const row = rows[rowIndex];
    if (!row) return;
    const current = getRowStreamMetric(row, stream.key);
    const decimals = getStepDecimals(stream.step);
    const nextMetric = Number(
      Math.max(stream.min, Math.min(stream.max, current + direction * stream.step)).toFixed(
        decimals
      )
    );
    onUpdateCell(rowIndex, stream.key, nextMetric);
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
              Day Shift (05:00–17:00)
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
          <label
            htmlFor="plant-circuit-module-select"
            className="flex items-center gap-2 font-semibold text-[var(--text-heading)] text-xs"
          >
            <span>Circuit:</span>
            <select
              id="plant-circuit-module-select"
              name="plantCircuitModule"
              aria-label="Plant Circuit Module"
              value={selectedModule}
              onChange={(e) => onModuleChange(e.target.value as PlantModuleId)}
              className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-2.5 py-1.5 font-medium text-[var(--text-heading)] text-xs"
            >
              <option value="DMS-MOD-1">DMS Module 1 — Primary Wash Plant</option>
              <option value="DMS-MOD-2">DMS Module 2 — Secondary &amp; Fines</option>
            </select>
          </label>

          <label
            htmlFor="plant-feed-seam-blend-select"
            className="flex items-center gap-2 font-semibold text-[var(--text-heading)] text-xs"
          >
            <span>Feed Blend:</span>
            <select
              id="plant-feed-seam-blend-select"
              name="plantFeedSeamBlend"
              aria-label="Feed Seam Blend"
              value={selectedSeamBlend}
              onChange={(e) => handleGlobalMaterialChange(e.target.value)}
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

      {/* Main 12-Hour Matrix Grid Card with Auto-Calculated Hourly Variance Blocks */}
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
                          id="plant-stream-filter-input"
                          name="plantStreamFilter"
                          type="text"
                          value={streamSearch}
                          onChange={(e) => setStreamSearch(e.target.value)}
                          placeholder="Filter plant stream..."
                          aria-label="Filter plant stream"
                          className={STREAM_FILTER_INPUT_CLASS}
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
                  <th scope="col" className="min-w-[180px] px-3 py-2.5 text-left align-top">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="font-bold text-[var(--text-heading)] text-xs">
                          Circuit &amp; Unit
                        </span>
                        <span className="rounded bg-[var(--accent-blue)]/10 px-1.5 py-0.5 font-mono font-semibold text-[10px] text-[var(--accent-blue)]">
                          {selectedModule}
                        </span>
                      </div>
                      <select
                        id="circuit-unit-header-material"
                        name="circuitUnitHeaderMaterial"
                        aria-label="Circuit & Unit Material"
                        value={selectedSeamBlend}
                        onChange={(e) => handleGlobalMaterialChange(e.target.value)}
                        className={HEADER_MATERIAL_SELECT_CLASS}
                      >
                        {PLANT_SEAM_OPTIONS.map((seam) => (
                          <option key={seam} value={seam}>
                            {seam}
                          </option>
                        ))}
                      </select>
                    </div>
                  </th>
                  {rows.map((row) => {
                    const shortStart = row.hourSlot.split(' - ')[0] ?? row.hourSlot;
                    const compactWindow = row.hourSlot.replace(' - ', '-');
                    return (
                      <Fragment key={row.hourSlot}>
                        <th scope="col" className="min-w-[92px] px-1.5 py-2.5 text-center">
                          <span className="block font-bold font-mono text-[var(--text-heading)] text-xs">
                            {shortStart}
                          </span>
                          <span className="block font-mono font-normal text-[9px] text-[var(--text-muted)]">
                            {row.hourSlot}
                          </span>
                        </th>
                        <th
                          scope="col"
                          className="min-w-[64px] border-[var(--border-default)]/50 border-x bg-[var(--bg-secondary)]/85 px-1 py-2.5 text-center"
                        >
                          <span className="block font-bold font-mono text-[10px] text-[var(--accent-blue)]">
                            Δ Var
                          </span>
                          <span className="block font-mono font-normal text-[9px] text-[var(--text-muted)]">
                            {compactWindow}
                          </span>
                        </th>
                      </Fragment>
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
                  const summaryDisplay = formatStreamSummary(stream.key, totals, rows);
                  const activeMaterial = streamMaterials[stream.key] ?? selectedSeamBlend;
                  const streamDecimals = getStepDecimals(stream.step);

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

                      {/* Redesigned Circuit & Unit Column with Material Dropdown */}
                      <td className="min-w-[180px] px-3 py-2">
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-1.5">
                            <span className="font-mono font-semibold text-[10px] text-[var(--text-secondary)]">
                              {selectedModule}
                            </span>
                            <span className="shrink-0 rounded bg-[var(--accent-blue)]/10 px-1.5 py-0.5 font-mono font-semibold text-[10px] text-[var(--accent-blue)]">
                              {stream.unit}
                            </span>
                          </div>
                          <select
                            id={`circuit-material-${stream.key}`}
                            name={`circuitMaterial_${stream.key}`}
                            aria-label={`${stream.streamName} Material`}
                            data-testid={`material-select-${stream.key}`}
                            value={activeMaterial}
                            onChange={(e) => handleStreamMaterialChange(stream.key, e.target.value)}
                            className={MATERIAL_SELECT_CLASS}
                          >
                            {PLANT_SEAM_OPTIONS.map((seam) => (
                              <option key={seam} value={seam}>
                                {seam}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>

                      {/* 12 Hourly Cells + Auto-Calculated Hourly Variance Block After Each Hour */}
                      {rows.map((row, hourIdx) => {
                        const streamKey = stream.key;
                        const rawVariance = computeHourlyVariance(rows, hourIdx, streamKey);
                        const varianceSuffix = streamKey === 'yieldPct' ? '%' : '';
                        const varianceBadge = formatVarianceBadge(
                          rawVariance,
                          streamDecimals,
                          varianceSuffix
                        );

                        if (!stream.editable || streamKey === 'yieldPct') {
                          const yieldBadgeClass =
                            row.yieldPct >= YIELD_HIGH_THRESHOLD
                              ? 'bg-emerald-500/15 text-emerald-800 border-emerald-500/30'
                              : row.yieldPct >= YIELD_MID_THRESHOLD
                                ? 'bg-amber-500/15 text-amber-800 border-amber-500/30'
                                : 'bg-red-500/15 text-red-800 border-red-500/30';
                          return (
                            <Fragment key={`${streamKey}-${row.hourSlot}`}>
                              <td className="bg-black/[0.015] px-1 py-2 text-center">
                                <span
                                  className={`inline-block rounded border px-2 py-0.5 font-mono font-semibold text-[11px] ${yieldBadgeClass}`}
                                >
                                  {row.yieldPct.toFixed(DECIMALS_ONE)}%
                                </span>
                              </td>
                              <td
                                data-testid={`variance-${streamKey}-${row.rowNumber}`}
                                aria-label={`${stream.ariaPrefix} variance ${row.hourSlot}`}
                                className="border-[var(--border-default)]/40 border-x bg-[var(--bg-secondary)]/30 px-1 py-2 text-center"
                              >
                                <span
                                  className={`${VARIANCE_BADGE_BASE_CLASS} ${varianceBadge.toneClass}`}
                                >
                                  {varianceBadge.text}
                                </span>
                              </td>
                            </Fragment>
                          );
                        }

                        const cellMetric = getRowStreamMetric(row, streamKey);
                        return (
                          <Fragment key={`${streamKey}-${row.hourSlot}`}>
                            <td className="px-1 py-1.5 text-center">
                              <div className={STEPPER_WRAPPER_CLASS}>
                                <button
                                  type="button"
                                  onClick={() => stepCellValue(hourIdx, stream, -1)}
                                  aria-label={`Decrease Row ${row.rowNumber} ${stream.ariaPrefix}`}
                                  className={STEPPER_BTN_CLASS}
                                >
                                  <Minus className="h-2.5 w-2.5" />
                                </button>
                                <input
                                  id={`cell-${streamKey}-${row.rowNumber}`}
                                  name={`cell_${streamKey}_${row.rowNumber}`}
                                  type="number"
                                  min={stream.min}
                                  max={stream.max}
                                  step={stream.step}
                                  aria-label={`Row ${row.rowNumber} ${stream.ariaPrefix}`}
                                  value={cellMetric}
                                  onChange={(e) => onUpdateCell(hourIdx, streamKey, e.target.value)}
                                  className={STEPPER_INPUT_CLASS}
                                />
                                <button
                                  type="button"
                                  onClick={() => stepCellValue(hourIdx, stream, 1)}
                                  aria-label={`Increase Row ${row.rowNumber} ${stream.ariaPrefix}`}
                                  className={STEPPER_BTN_CLASS}
                                >
                                  <Plus className="h-2.5 w-2.5" />
                                </button>
                              </div>
                            </td>
                            <td
                              data-testid={`variance-${streamKey}-${row.rowNumber}`}
                              aria-label={`${stream.ariaPrefix} variance ${row.hourSlot}`}
                              className="border-[var(--border-default)]/40 border-x bg-[var(--bg-secondary)]/30 px-1 py-1.5 text-center"
                            >
                              <span
                                className={`${VARIANCE_BADGE_BASE_CLASS} ${varianceBadge.toneClass}`}
                              >
                                {varianceBadge.text}
                              </span>
                            </td>
                          </Fragment>
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
                  {rows.map((row, hourIdx) => {
                    const footerVariance = computeHourlyVariance(rows, hourIdx, 'yieldPct');
                    const footerBadge = formatVarianceBadge(footerVariance, DECIMALS_ONE, '%');
                    return (
                      <Fragment key={`footer-${row.hourSlot}`}>
                        <td className="px-1 py-2.5 text-center text-[var(--accent-blue)]">
                          {row.yieldPct.toFixed(DECIMALS_ONE)}%
                        </td>
                        <td className="border-[var(--border-default)]/40 border-x bg-[var(--bg-secondary)]/50 px-1 py-2.5 text-center">
                          <span className={`${VARIANCE_BADGE_BASE_CLASS} ${footerBadge.toneClass}`}>
                            {footerBadge.text}
                          </span>
                        </td>
                      </Fragment>
                    );
                  })}
                  <td className="px-3 py-2.5 text-right text-emerald-700">
                    {totals.weightedYield.toFixed(DECIMALS_ONE)}% ({totals.runHours}h)
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
