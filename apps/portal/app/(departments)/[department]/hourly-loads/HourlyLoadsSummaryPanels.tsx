'use client';

import { AnimatedDialog } from '@repo/ui';
import { GlassCard } from '@repo/ui/GlassCard';
import { Logo } from '@repo/ui/Logo';
import { SecondaryButton } from '@repo/ui/SecondaryButton';
import { Activity, Lock, Minus, Plus, TrendingUp, Truck } from 'lucide-react';
import { memo, useEffect, useState } from 'react';
import type { Excavator, HourlySlotSeries, Machine } from './hourly-loads-utils';
import { HOUR_PROP, HOURS_12, type HourlyMaterial, type HourlyShift } from './loads-utils';

/** Shared KPI tile shell — golden steel border over the vibrancy surface. */
const KPI_TILE_CLASS =
  'gold-steel-border gold-steel-border-slim rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3.5 shadow-xs';
const KPI_TILE_ROW_CLASS = `${KPI_TILE_CLASS} flex items-center justify-between`;
const KPI_TILE_STACK_CLASS = `${KPI_TILE_CLASS} flex flex-col justify-between`;

const SPLIT_TRIGGER_BTN_CLASS =
  'inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg bg-[var(--accent-blue)] px-4 py-2.5 font-semibold text-white text-xs shadow-sm transition-all hover:bg-[var(--accent-blue)]/90 focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]/30';

interface HourCellProps {
  value: number;
  rowIndex: number;
  hourProp: string;
  hourLabel?: string;
  editable: boolean;
  isLocked: boolean;
  startHour?: number;
  endHour?: number;
  onStep: (rowIndex: number, hourProp: string, delta: number) => void;
  onDirectEdit: (rowIndex: number, hourProp: string, value: number) => void;
}

export const HourCell = memo(function HourCell({
  value,
  rowIndex,
  hourProp,
  hourLabel,
  editable,
  isLocked,
  startHour,
  endHour,
  onStep,
  onDirectEdit,
}: HourCellProps) {
  const [localVal, setLocalVal] = useState<string>(String(value));

  useEffect(() => {
    setLocalVal(String(value));
  }, [value]);

  if (!editable) {
    return (
      <td
        className="bg-black/[0.02] px-1 py-2 text-center"
        title={
          isLocked ? 'Segment locked' : `Active hours: ${startHour ?? 1}:00 - ${endHour ?? 12}:59`
        }
      >
        <div className="flex items-center justify-center gap-1 text-[var(--text-muted)] opacity-60">
          <span className="font-mono text-xs">{value > 0 ? value : '-'}</span>
          <Lock className="h-2.5 w-2.5 opacity-50" />
        </div>
      </td>
    );
  }

  const commitValue = () => {
    const parsed = parseInt(localVal, 10);
    const valid = Number.isNaN(parsed) ? 0 : Math.max(0, Math.min(100, parsed));
    setLocalVal(String(valid));
    if (valid !== value) {
      onDirectEdit(rowIndex, hourProp, valid);
    }
  };

  return (
    <td className="px-1 py-1.5 text-center">
      <div
        className="inline-flex items-center justify-center gap-0.5 rounded border border-[var(--border-default)]/60 bg-[var(--bg-secondary)]/50 p-0.5 focus-within:border-[var(--accent-blue)] focus-within:ring-1 focus-within:ring-[var(--accent-blue)]"
        data-row={String(rowIndex)}
        data-hour={hourProp}
      >
        <button
          type="button"
          data-row={String(rowIndex)}
          data-hour={hourProp}
          data-action="down"
          onClick={(e) => {
            e.stopPropagation();
            onStep(rowIndex, hourProp, -1);
          }}
          disabled={value <= 0}
          aria-label={`Decrease ${hourLabel}:00 loads`}
          title={`Decrease ${hourLabel}:00 loads`}
          className="inline-flex h-6 w-5 cursor-pointer items-center justify-center rounded text-[var(--text-muted)] transition-colors hover:bg-black/5 hover:text-[var(--text-heading)] disabled:cursor-not-allowed disabled:opacity-20"
        >
          <Minus className="h-3 w-3" />
        </button>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={localVal}
          onChange={(e) => setLocalVal(e.target.value)}
          onBlur={commitValue}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              commitValue();
              (e.target as HTMLInputElement).blur();
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              onStep(rowIndex, hourProp, 1);
            } else if (e.key === 'ArrowDown') {
              e.preventDefault();
              onStep(rowIndex, hourProp, -1);
            }
          }}
          className="w-7 bg-transparent py-0.5 text-center font-mono font-semibold text-[var(--text-heading)] text-xs focus:outline-none"
        />
        <button
          type="button"
          data-row={String(rowIndex)}
          data-hour={hourProp}
          data-action="up"
          onClick={(e) => {
            e.stopPropagation();
            onStep(rowIndex, hourProp, 1);
          }}
          disabled={value >= 100}
          aria-label={`Increase ${hourLabel}:00 loads`}
          title={`Increase ${hourLabel}:00 loads`}
          className="inline-flex h-6 w-5 cursor-pointer items-center justify-center rounded text-[var(--text-muted)] transition-colors hover:bg-black/5 hover:text-[var(--text-heading)] disabled:cursor-not-allowed disabled:opacity-20"
        >
          <Plus className="h-3 w-3" />
        </button>
      </div>
    </td>
  );
});

interface HourlyLoadsTelemetryHeaderProps {
  selectedShift: HourlyShift;
  grandTotalLoads: number;
  grandTotalMaterial: number;
  activeMachinesCount: number;
  machinesCount: number;
  avgLoadsPerMachine: number;
  peakHour: HourlySlotSeries;
  wasteTotalLoads: number;
  coalTotalLoads: number;
  hourlySeries: HourlySlotSeries[];
  maxHourLoads: number;
}

export function HourlyLoadsTelemetryHeader({
  selectedShift,
  grandTotalLoads,
  grandTotalMaterial,
  activeMachinesCount,
  machinesCount,
  avgLoadsPerMachine,
  peakHour,
  wasteTotalLoads,
  coalTotalLoads,
  hourlySeries,
  maxHourLoads,
}: HourlyLoadsTelemetryHeaderProps) {
  return (
    <GlassCard className="space-y-4 border border-black/[0.06] bg-[var(--vibrancy-surface)] p-4 sm:p-5">
      {/* Redesigned Live KPI Strip */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {/* KPI 1: Total Loads Captured */}
        <div className={KPI_TILE_ROW_CLASS}>
          <div className="space-y-0.5">
            <span className="block font-semibold text-[11px] text-[var(--text-muted)] uppercase tracking-wider">
              Total Shift Loads
            </span>
            <div className="flex items-baseline gap-2">
              <span className="font-bold font-mono text-2xl text-[var(--text-heading)] tabular-nums">
                {grandTotalLoads}
              </span>
              <span className="font-medium text-[11px] text-[var(--accent-blue)]">
                {selectedShift === 'day' ? 'Day Shift' : 'Night Shift'}
              </span>
            </div>
            <span className="block text-[11px] text-[var(--text-muted)]">
              {grandTotalMaterial > 0
                ? `${grandTotalMaterial.toLocaleString()} t total material`
                : 'Real-time shift tally'}
            </span>
          </div>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--accent-blue)]/20 bg-[var(--accent-blue)]/10 text-[var(--accent-blue)]">
            <TrendingUp className="h-5 w-5" />
          </div>
        </div>

        {/* KPI 2: Machines Active */}
        <div className={KPI_TILE_ROW_CLASS}>
          <div className="space-y-0.5">
            <span className="block font-semibold text-[11px] text-[var(--text-muted)] uppercase tracking-wider">
              Machines Active
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="font-bold font-mono text-2xl text-[var(--text-heading)] tabular-nums">
                {activeMachinesCount}
              </span>
              <span className="font-medium text-[var(--text-muted)] text-xs">
                / {machinesCount} fleet
              </span>
            </div>
            <span className="block text-[11px] text-[var(--text-muted)]">
              {machinesCount > 0
                ? `${Math.round((activeMachinesCount / machinesCount) * 100)}% fleet utilization`
                : 'No fleet configured'}
            </span>
          </div>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--accent-green)]/20 bg-[var(--accent-green)]/10 text-[var(--accent-green)]">
            <Truck className="h-5 w-5" />
          </div>
        </div>

        {/* KPI 3: Avg Loads / Machine */}
        <div className={KPI_TILE_ROW_CLASS}>
          <div className="space-y-0.5">
            <span className="block font-semibold text-[11px] text-[var(--text-muted)] uppercase tracking-wider">
              Avg Loads / Machine
            </span>
            <div className="flex items-baseline gap-2">
              <span className="font-bold font-mono text-2xl text-[var(--text-heading)] tabular-nums">
                {avgLoadsPerMachine}
              </span>
              <span className="font-medium text-[11px] text-[var(--text-muted)]">loads/unit</span>
            </div>
            <span className="block text-[11px] text-[var(--text-muted)]">
              Peak:{' '}
              {peakHour.totalLoads > 0
                ? `${peakHour.hourLabel} (${peakHour.totalLoads})`
                : 'No loads yet'}
            </span>
          </div>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--accent-amber)]/30 bg-[var(--accent-amber)]/15 text-[var(--accent-amber)]">
            <Activity className="h-5 w-5" />
          </div>
        </div>

        {/* KPI 4: Waste vs Coal Split */}
        <div className={KPI_TILE_STACK_CLASS}>
          <div className="flex items-center justify-between">
            <span className="font-semibold text-[11px] text-[var(--text-muted)] uppercase tracking-wider">
              Material Split
            </span>
            <span className="font-mono font-semibold text-[11px] text-[var(--text-heading)]">
              W: {wasteTotalLoads} · C: {coalTotalLoads}
            </span>
          </div>
          <div className="my-2 flex h-2 w-full overflow-hidden rounded-full bg-black/[0.06]">
            <div
              className="h-full bg-[var(--accent-blue)] transition-all duration-300"
              style={{
                width: `${
                  grandTotalLoads > 0 ? Math.round((wasteTotalLoads / grandTotalLoads) * 100) : 50
                }%`,
              }}
              title={`Waste: ${wasteTotalLoads} loads`}
            />
            <div
              className="h-full bg-neutral-800 transition-all duration-300"
              style={{
                width: `${
                  grandTotalLoads > 0
                    ? 100 - Math.round((wasteTotalLoads / grandTotalLoads) * 100)
                    : 50
                }%`,
              }}
              title={`Coal: ${coalTotalLoads} loads`}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-[var(--accent-blue)]" />
              Waste (
              {grandTotalLoads > 0 ? Math.round((wasteTotalLoads / grandTotalLoads) * 100) : 0}%)
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-neutral-800" />
              Coal ({grandTotalLoads > 0 ? Math.round((coalTotalLoads / grandTotalLoads) * 100) : 0}
              %)
            </span>
          </div>
        </div>
      </div>

      {/* Live Hourly Timeline Graph */}
      <div className="space-y-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)]/80 p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Logo variant="gold" className="h-4 w-4 shrink-0" />
            <div>
              <h3 className="font-bold text-[var(--text-heading)] text-xs uppercase tracking-wider">
                Live Hourly Production Timeline (
                {selectedShift === 'day' ? '06:00 – 17:00' : '18:00 – 05:00'})
              </h3>
              <p className="text-[11px] text-[var(--text-muted)]">
                Updates dynamically as hourly machine loads are captured across the shift
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 font-medium text-[11px] text-[var(--text-muted)]">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-xs bg-[var(--accent-blue)]" />
              Waste Loads
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-xs bg-neutral-800" />
              Coal Loads
            </span>
            <span className="inline-flex items-center gap-1.5 font-mono text-[var(--text-heading)]">
              Cumulative: <strong>{grandTotalLoads}</strong>
            </span>
          </div>
        </div>

        {/* 12-Hour Interactive Bar + Cumulative Progress Timeline */}
        <div className="grid h-28 grid-cols-12 items-end gap-1.5 pt-2 sm:gap-2">
          {hourlySeries.map((slot) => {
            const heightPct =
              slot.totalLoads > 0
                ? Math.max(12, Math.round((slot.totalLoads / maxHourLoads) * 100))
                : 4;
            const wastePct =
              slot.totalLoads > 0 ? Math.round((slot.wasteLoads / slot.totalLoads) * 100) : 100;
            const coalPct = 100 - wastePct;

            return (
              <div
                key={slot.hourLabel}
                className="group flex h-full flex-col items-center justify-end"
                title={`${slot.hourLabel} — Total: ${slot.totalLoads} (Waste: ${slot.wasteLoads}, Coal: ${slot.coalLoads}) · Cumulative: ${slot.cumulativeLoads}`}
              >
                <span
                  className={`mb-1 font-bold font-mono text-[10px] tabular-nums transition-colors ${
                    slot.totalLoads > 0
                      ? 'text-[var(--text-heading)]'
                      : 'text-[var(--text-muted)] opacity-50'
                  }`}
                >
                  {slot.totalLoads}
                </span>
                <div className="gold-steel-border gold-steel-border-slim flex h-16 w-full max-w-[38px] flex-col justify-end overflow-hidden rounded-t-md border border-black/[0.05] bg-black/[0.04]">
                  {slot.totalLoads > 0 ? (
                    <div
                      className="flex w-full flex-col justify-end overflow-hidden rounded-t-sm transition-all duration-300"
                      style={{ height: `${heightPct}%` }}
                    >
                      {slot.coalLoads > 0 && (
                        <div
                          className="w-full bg-neutral-800 transition-all duration-300"
                          style={{ height: `${coalPct}%` }}
                        />
                      )}
                      {slot.wasteLoads > 0 && (
                        <div
                          className="w-full bg-[var(--accent-blue)] transition-all duration-300"
                          style={{ height: `${wastePct}%` }}
                        />
                      )}
                    </div>
                  ) : (
                    <div className="h-1 w-full bg-black/[0.08]" />
                  )}
                </div>
                <span className="mt-1.5 font-medium font-mono text-[10px] text-[var(--text-muted)] group-hover:text-[var(--text-heading)]">
                  {slot.shortLabel}:00
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </GlassCard>
  );
}

interface HourlyLoadsSplitSectionProps {
  isSplitModalOpen: boolean;
  isSubmittingSplit: boolean;
  splitMachineId: string;
  splitExcavatorId: string;
  splitMaterial: HourlyMaterial;
  splitStartHour: number;
  machines: Machine[];
  excavators: Excavator[];
  sites: { id: string; name: string; site_code: string }[];
  excavatorSites: Record<string, string>;
  hourLabels: string[];
  onOpenSplitModal: () => void;
  onCloseSplitModal: () => void;
  onSplitMachineChange: (machineId: string) => void;
  onSplitExcavatorChange: (excavatorId: string) => void;
  onSplitMaterialChange: (material: HourlyMaterial) => void;
  onSplitStartHourChange: (hour: number) => void;
  onConfirmSplit: () => void;
}

export function HourlyLoadsSplitSection({
  isSplitModalOpen,
  isSubmittingSplit,
  splitMachineId,
  splitExcavatorId,
  splitMaterial,
  splitStartHour,
  machines,
  excavators,
  sites,
  excavatorSites,
  hourLabels,
  onOpenSplitModal,
  onCloseSplitModal,
  onSplitMachineChange,
  onSplitExcavatorChange,
  onSplitMaterialChange,
  onSplitStartHourChange,
  onConfirmSplit,
}: HourlyLoadsSplitSectionProps) {
  return (
    <>
      {/* Bottom Action Area: Split Shift / Machine Lineup Change */}
      <GlassCard className="flex flex-col items-start justify-between gap-4 border border-black/[0.06] bg-[var(--vibrancy-surface)] p-4 sm:flex-row sm:items-center">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[var(--text-heading)] text-sm">
              Mid-Shift Machine Lineup & Excavator Reassignment
            </span>
          </div>
          <p className="max-w-2xl text-[var(--text-muted)] text-xs">
            Need to swap an excavator, change materials, or reassign a haul truck mid-day? Click
            below to add a split segment. The previous hours will automatically lock to ensure no
            duplicate work or double-counting occurs.
          </p>
        </div>

        <button type="button" onClick={onOpenSplitModal} className={SPLIT_TRIGGER_BTN_CLASS}>
          <Plus className="h-4 w-4" />
          <span>Add Machine Split / Excavator Swap</span>
        </button>
      </GlassCard>

      {/* Mid-Shift Split Modal Dialog */}
      <AnimatedDialog
        open={isSplitModalOpen}
        onClose={onCloseSplitModal}
        title="Add Mid-Shift Machine Split"
        description="Reassign a haul truck mid-shift to a different excavator or material. Previous hours will be locked against editing."
        className="max-w-md"
      >
        <div className="mt-2 space-y-4">
          {/* Machine Selection */}
          <div>
            <label className="mb-1 block font-semibold text-[var(--text-heading)] text-xs">
              Select Haul Truck
            </label>
            <select
              value={splitMachineId}
              onChange={(e) => onSplitMachineChange(e.target.value)}
              disabled={isSubmittingSplit}
              className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2 font-medium text-[var(--text-heading)] text-xs focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)]"
            >
              {machines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.machine_type})
                </option>
              ))}
            </select>
          </div>

          {/* Excavator Selection */}
          <div>
            <label className="mb-1 block font-semibold text-[var(--text-heading)] text-xs">
              Assigned Excavator
            </label>
            <select
              value={splitExcavatorId}
              onChange={(e) => onSplitExcavatorChange(e.target.value)}
              disabled={isSubmittingSplit}
              className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2 font-medium text-[var(--text-heading)] text-xs focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)]"
            >
              <option value="">No Excavator Assigned</option>
              {excavators.map((e) => {
                const site = sites.find((s) => s.id === excavatorSites[e.id]);
                return (
                  <option key={e.id} value={e.id}>
                    {e.name} {site ? `(${site.name})` : ''}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Material Selection */}
          <div>
            <label className="mb-1 block font-semibold text-[var(--text-heading)] text-xs">
              Material Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onSplitMaterialChange('Waste')}
                className={`rounded-lg border px-3 py-2 text-center font-medium text-xs transition-all ${
                  splitMaterial === 'Waste'
                    ? 'border-arch-border-primary bg-arch-surface-primary font-semibold text-arch-text-primary shadow-xs'
                    : 'border-[var(--border-default)] bg-transparent text-[var(--text-muted)]'
                }`}
              >
                Waste
              </button>
              <button
                type="button"
                onClick={() => onSplitMaterialChange('Coal')}
                className={`rounded-lg border px-3 py-2 text-center font-medium text-xs transition-all ${
                  splitMaterial === 'Coal'
                    ? 'border-arch-text-primary bg-arch-text-primary font-semibold text-white shadow-xs'
                    : 'border-[var(--border-default)] bg-transparent text-[var(--text-muted)]'
                }`}
              >
                Coal
              </button>
            </div>
          </div>

          {/* Switch-over Start Hour */}
          <div>
            <label className="mb-1 block font-semibold text-[var(--text-heading)] text-xs">
              Effective Starting Hour
            </label>
            <select
              value={splitStartHour}
              onChange={(e) => onSplitStartHourChange(parseInt(e.target.value, 10))}
              disabled={isSubmittingSplit}
              className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2 font-medium text-[var(--text-heading)] text-xs focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)]"
            >
              {HOURS_12.slice(1).map((hourNum) => (
                <option key={hourNum} value={hourNum}>
                  Hour {hourNum} ({hourLabels[hourNum - 1]}:00 - {hourLabels[hourNum - 1]}:59)
                </option>
              ))}
            </select>
          </div>

          {/* Information & Locking Preview */}
          <div className="space-y-1 rounded-lg border border-[var(--accent-blue)]/20 bg-[var(--accent-blue)]/10 p-3 text-[var(--text-heading)] text-xs">
            <div className="flex items-center gap-1.5 font-semibold text-[var(--accent-blue)]">
              <Lock className="h-3.5 w-3.5" />
              <span>Locking & Double-Counting Safeguard</span>
            </div>
            <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
              • Previous log will lock for Hours 1 to {splitStartHour - 1} ({hourLabels[0]}:00 to{' '}
              {hourLabels[splitStartHour - 2]}:59).
              <br />• New log will only accept loads from Hour {splitStartHour} (
              {hourLabels[splitStartHour - 1]}:00) onwards.
            </p>
          </div>

          {/* Modal Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <SecondaryButton
              size="sm"
              variant="rounded-lg"
              onClick={onCloseSplitModal}
              disabled={isSubmittingSplit}
            >
              Cancel
            </SecondaryButton>
            <button
              type="button"
              onClick={onConfirmSplit}
              disabled={isSubmittingSplit}
              className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-[var(--accent-blue)] px-4 py-2 font-semibold text-white text-xs transition-all hover:bg-[var(--accent-blue)]/90 disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />
              {isSubmittingSplit ? 'Adding Split...' : 'Confirm & Add Split'}
            </button>
          </div>
        </div>
      </AnimatedDialog>
    </>
  );
}

export function hourPropName(hourIndex: number): string {
  return HOUR_PROP(hourIndex);
}
