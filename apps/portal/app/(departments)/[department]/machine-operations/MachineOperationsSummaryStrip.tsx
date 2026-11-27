'use client';

import { GlassCard } from '@repo/ui/GlassCard';
import { cn } from '@repo/ui/lib/utils';
import { AlertCircle, CheckCircle2, Clock, Plus, Search } from 'lucide-react';
import { useState } from 'react';
import {
  type Breakdown,
  type FilterStatus,
  formatTime,
  MACHINE_CATEGORY_LABELS,
  type MachineCategory,
  type MachineItem,
  type MachineOperation,
  type MachineStatusCounts,
} from './machine-operations-constants';

interface MachineOperationsFilterStripProps {
  filterStatus: FilterStatus;
  onFilterStatusChange: (status: FilterStatus) => void;
  counts: MachineStatusCounts;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  selectedCategory?: MachineCategory;
  onCategoryChange?: (category: MachineCategory) => void;
}

const SUMMARY_SURFACE_CLASS =
  'liquid-glass-light gold-steel-border gold-steel-border-slim border border-white/25 bg-[var(--material-ultra-thin)] shadow-diffusion-sm backdrop-blur-md';

const FOCUS_RING_CLASS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)]';

const FILTER_BUTTON_CLASS = cn(
  'flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 font-medium text-xs transition-all motion-reduce:transition-none',
  FOCUS_RING_CLASS
);

const SEARCH_INPUT_CLASS = cn(
  'gold-steel-border gold-steel-border-slim h-9 w-full rounded-full border border-[var(--accent-gold)]/60 bg-[var(--bg-secondary)] py-1.5 pr-4 pl-9 font-medium text-[var(--text-heading)] text-xs shadow-xs ring-1 ring-[var(--accent-gold)]/30 transition-[box-shadow,border-color] duration-200 motion-reduce:transition-none',
  FOCUS_RING_CLASS
);

const FILTER_TONES = {
  neutral: {
    selected:
      'border border-[var(--accent-charcoal)] bg-[var(--accent-charcoal)] text-white shadow-sm',
    idle: 'border border-[var(--border-default)] bg-[var(--bg-secondary)]/80 text-[var(--text-secondary)] hover:text-[var(--text-heading)]',
  },
  green: {
    selected: 'border border-[var(--accent-green)] bg-[var(--accent-green)] text-white shadow-sm',
    idle: 'border border-[var(--border-default)] bg-[var(--bg-secondary)]/80 text-[var(--text-secondary)] hover:text-[var(--text-heading)]',
  },
  amber: {
    selected: 'border border-[var(--accent-amber)] bg-[var(--accent-amber)] text-white shadow-sm',
    idle: 'border border-[var(--border-default)] bg-[var(--bg-secondary)]/80 text-[var(--text-secondary)] hover:text-[var(--text-heading)]',
  },
  red: {
    selected: 'border border-[var(--accent-red)] bg-[var(--accent-red)] text-white shadow-sm',
    idle: 'border border-[var(--accent-red)]/30 bg-[var(--accent-red)]/10 text-[var(--accent-red)] hover:bg-[var(--accent-red)]/20',
  },
} as const;

const SUMMARY_TITLE_CLASS = 'font-semibold text-sm text-[var(--text-heading)]';

const SUMMARY_META_CLASS = 'text-xs text-[var(--text-muted)]';

export function MachineOperationsFilterStrip({
  filterStatus,
  onFilterStatusChange,
  counts,
  searchQuery,
  onSearchQueryChange,
  selectedCategory = 'all',
  onCategoryChange,
}: MachineOperationsFilterStripProps) {
  const categories: MachineCategory[] = ['all', 'adt', 'excavator', 'drill', 'dozer', 'ancillary'];

  const getCategoryCount = (cat: MachineCategory): number => {
    switch (cat) {
      case 'all':
        return counts.allCategories ?? counts.total;
      case 'adt':
        return counts.adt ?? 0;
      case 'excavator':
        return counts.excavator ?? 0;
      case 'drill':
        return counts.drill ?? 0;
      case 'dozer':
        return counts.dozer ?? 0;
      case 'ancillary':
        return counts.ancillary ?? 0;
    }
  };

  return (
    <div
      data-testid="machine-operations-filter-panel"
      className={cn(SUMMARY_SURFACE_CLASS, 'space-y-4 rounded-2xl p-4')}
    >
      {/* Panel Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-[var(--border-subtle)] border-b pb-3">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg border border-[var(--accent-gold)]/40 bg-[var(--accent-gold)]/10 text-[var(--accent-blue)]">
            <Search className="h-3.5 w-3.5" />
          </span>
          <span className={SUMMARY_TITLE_CLASS}>Fleet Filter &amp; Search Console</span>
        </div>
        <span className="gold-steel-border gold-steel-border-slim rounded-full border border-[var(--accent-gold)]/40 bg-[var(--accent-gold)]/10 px-2.5 py-0.5 font-mono font-semibold text-[var(--accent-blue)] text-xs">
          {counts.total} Machines Tracked
        </span>
      </div>

      {/* Category Tabs Strip */}
      {onCategoryChange && (
        <div className="space-y-1.5">
          <span className="block font-medium text-[11px] text-[var(--text-muted)] uppercase tracking-wider">
            Machine Category
          </span>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {categories.map((cat) => {
              const isSelected = selectedCategory === cat;
              const count = getCategoryCount(cat);
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => onCategoryChange(cat)}
                  className={cn(
                    FILTER_BUTTON_CLASS,
                    isSelected
                      ? 'gold-steel-border gold-steel-border-slim border border-[var(--accent-gold)] bg-[var(--accent-blue)] text-white shadow-xs'
                      : cn(
                          FILTER_TONES.neutral.idle,
                          'hover:border-[var(--accent-gold)]/40 hover:bg-[var(--accent-gold)]/10'
                        )
                  )}
                >
                  {MACHINE_CATEGORY_LABELS[cat]} ({count})
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Status Filter and Search Strip */}
      <div className="flex flex-col items-stretch justify-between gap-3 pt-1 sm:flex-row sm:items-center">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => onFilterStatusChange('all')}
            className={cn(
              FILTER_BUTTON_CLASS,
              filterStatus === 'all'
                ? cn('gold-steel-border gold-steel-border-slim', FILTER_TONES.neutral.selected)
                : FILTER_TONES.neutral.idle
            )}
          >
            All Machines ({counts.total})
          </button>
          <button
            type="button"
            onClick={() => onFilterStatusChange('operating')}
            className={cn(
              FILTER_BUTTON_CLASS,
              filterStatus === 'operating'
                ? cn('gold-steel-border gold-steel-border-slim', FILTER_TONES.green.selected)
                : FILTER_TONES.green.idle
            )}
          >
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent-green" />
            Operating ({counts.operating})
          </button>
          <button
            type="button"
            onClick={() => onFilterStatusChange('standby')}
            className={cn(
              FILTER_BUTTON_CLASS,
              filterStatus === 'standby'
                ? cn('gold-steel-border gold-steel-border-slim', FILTER_TONES.amber.selected)
                : FILTER_TONES.amber.idle
            )}
          >
            Standby ({counts.standby})
          </button>
          <button
            type="button"
            onClick={() => onFilterStatusChange('breakdown')}
            className={cn(
              FILTER_BUTTON_CLASS,
              filterStatus === 'breakdown'
                ? cn('gold-steel-border gold-steel-border-slim', FILTER_TONES.red.selected)
                : FILTER_TONES.red.idle
            )}
          >
            <AlertCircle size={12} />
            Breakdowns ({counts.breakdown})
          </button>
          <button
            type="button"
            onClick={() => onFilterStatusChange('inactive')}
            className={cn(
              FILTER_BUTTON_CLASS,
              filterStatus === 'inactive'
                ? cn('gold-steel-border gold-steel-border-slim', FILTER_TONES.neutral.selected)
                : FILTER_TONES.neutral.idle
            )}
          >
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--text-muted)]" />
            Inactive ({counts.inactive})
          </button>
        </div>

        {/* Search Input */}
        <div className="relative min-w-[240px]">
          <Search
            size={14}
            className="pointer-events-none absolute top-1/2 left-3.5 z-10 -translate-y-1/2 text-[var(--accent-blue)]"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            placeholder="Search machine, type, or SN..."
            className={SEARCH_INPUT_CLASS}
          />
        </div>
      </div>
    </div>
  );
}

export function FleetMachineCard({
  machine,
  breakdown,
  operations,
  status,
  totalHours,
  loadsByMachine,
  breakdownsByFleetId,
  engineeringDelay,
}: {
  machine: MachineItem;
  breakdown?: Breakdown;
  operations: MachineOperation[];
  status: 'breakdown' | 'in-progress' | 'operating' | 'standby' | 'inactive';
  totalHours: number;
  loadsByMachine: Map<string, number>;
  breakdownsByFleetId: Map<string, Breakdown>;
  engineeringDelay?: { hours: number; reasons: string[]; status: string };
}) {
  const [isExpanded, setIsExpanded] = useState(operations.length > 0);

  const scrollToForm = () => {
    const formElem = document.getElementById('machine-operations-form');
    if (formElem) {
      formElem.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <GlassCard className={cn(SUMMARY_SURFACE_CLASS, 'px-4 py-3')}>
      <div className="space-y-3">
        {/* Machine Header Row */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Left: Indicator, Machine Name, Type, SN */}
          <div className="flex min-w-0 items-center gap-3">
            {/* Status Indicator */}
            <div
              className={cn(
                'h-2.5 w-2.5 shrink-0 rounded-full',
                status === 'breakdown'
                  ? 'animate-pulse bg-[var(--accent-red)] motion-reduce:animate-none'
                  : status === 'in-progress'
                    ? 'animate-pulse bg-[var(--accent-blue)] motion-reduce:animate-none'
                    : status === 'operating'
                      ? 'bg-[var(--accent-green)]'
                      : 'bg-[var(--text-muted)]/50'
              )}
            />

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={SUMMARY_TITLE_CLASS}>{machine.name}</span>
                <span className="rounded-md border border-[var(--border-default)] bg-[var(--bg-secondary)] px-2 py-0.5 font-medium text-[11px] text-[var(--text-secondary)]">
                  {machine.machine_type}
                </span>
                {machine.bin_factor != null && machine.bin_factor > 0 && (
                  <span className="rounded-md border border-[var(--accent-blue)]/20 bg-[var(--accent-blue)]/10 px-2 py-0.5 font-medium font-mono text-[11px] text-[var(--accent-blue)]">
                    {machine.bin_factor} BCM/load
                  </span>
                )}
                {machine.serial_number && (
                  <span className="font-mono text-[11px] text-[var(--text-muted)]">
                    {machine.serial_number}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right: SMR, Status Badge & Actions */}
          <div className="flex shrink-0 items-center gap-3">
            {/* Latest SMR */}
            {machine.latest_smu != null && (
              <span className="rounded-md border border-[var(--border-default)] bg-[var(--bg-secondary)] px-2 py-0.5 font-mono text-[var(--text-heading)] text-xs">
                SMR {machine.latest_smu.toFixed(1)}
              </span>
            )}

            {/* Status Badge */}
            {status === 'breakdown' && (
              <span className="inline-flex items-center gap-1 rounded-md border border-[var(--accent-red)]/20 bg-[var(--accent-red)]/10 px-2 py-0.5 font-medium text-[var(--accent-red)] text-xs">
                <AlertCircle size={12} />
                Breakdown
              </span>
            )}
            {status === 'in-progress' && (
              <span className="inline-flex animate-pulse items-center gap-1 rounded-md border border-[var(--accent-blue)]/20 bg-[var(--accent-blue)]/10 px-2 py-0.5 font-medium text-[var(--accent-blue)] text-xs motion-reduce:animate-none">
                <Clock size={12} />
                In Progress
              </span>
            )}
            {status === 'operating' && (
              <span className="inline-flex items-center gap-1 rounded-md border border-[var(--accent-green)]/20 bg-[var(--accent-green)]/10 px-2 py-0.5 font-medium text-[var(--accent-green)] text-xs">
                <CheckCircle2 size={12} />
                {totalHours.toFixed(1)}h logged
              </span>
            )}
            {status === 'standby' && (
              <span
                className={cn(
                  SUMMARY_META_CLASS,
                  'inline-flex items-center gap-1 rounded-md border border-[var(--border-default)] bg-[var(--bg-secondary)] px-2 py-0.5 font-medium'
                )}
              >
                Standby
              </span>
            )}
            {status === 'inactive' && (
              <span className="inline-flex items-center gap-1 rounded-md border border-[var(--border-default)] bg-[var(--bg-secondary)] px-2 py-0.5 font-medium text-[var(--text-muted)] text-xs">
                Inactive
              </span>
            )}

            {/* Shift Count / Toggle button */}
            {operations.length > 0 && (
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className={cn(
                  'ml-1 font-medium text-[var(--accent-blue)] text-xs hover:underline',
                  FOCUS_RING_CLASS
                )}
              >
                {operations.length} shift{operations.length !== 1 ? 's' : ''} (
                {isExpanded ? 'Hide' : 'Show'})
              </button>
            )}
          </div>
        </div>

        {/* Breakdown Alert Banner */}
        {breakdown && breakdown.status === 'active' && (
          <div className="rounded-lg border border-[var(--accent-red)]/20 bg-[var(--accent-red)]/10 p-2.5 text-xs">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                <AlertCircle size={14} className="mt-0.5 shrink-0 text-[var(--accent-red)]" />
                <div>
                  <p className="font-semibold text-[var(--accent-red)]">
                    Engineering Breakdown: {breakdown.reason}
                  </p>
                  {breakdown.repair_notes && (
                    <p className="mt-0.5 text-[var(--text-secondary)]">{breakdown.repair_notes}</p>
                  )}
                </div>
              </div>
              {engineeringDelay && engineeringDelay.hours > 0 && (
                <span className="rounded-full border border-[var(--accent-amber)]/40 bg-[var(--accent-amber)]/15 px-2 py-0.5 font-mono font-semibold text-[11px] text-[var(--accent-amber)]">
                  Eng Delay: {engineeringDelay.hours.toFixed(1)}h · Remaining Shift Cap:{' '}
                  {Math.max(0, 12 - engineeringDelay.hours).toFixed(1)}h
                </span>
              )}
            </div>
          </div>
        )}

        {/* Today's Shifts for this machine */}
        {operations.length > 0 ? (
          isExpanded && (
            <div className="space-y-2 border-[var(--border-default)] border-t pt-2">
              {operations.map((op) => (
                <OperationCard
                  key={op.id}
                  operation={op}
                  loadsByMachine={loadsByMachine}
                  breakdownsByFleetId={breakdownsByFleetId}
                />
              ))}
            </div>
          )
        ) : (
          /* Standby notice when no operations logged */
          <div className="flex items-center justify-between border-[var(--border-default)] border-t pt-2 text-[var(--text-muted)] text-xs">
            <span className="italic">Standby — No operations logged today</span>
            <button
              type="button"
              onClick={scrollToForm}
              className={cn(
                'inline-flex items-center gap-1 font-medium text-[var(--accent-blue)] transition-colors hover:text-[var(--accent-blue)]/80 motion-reduce:transition-none',
                FOCUS_RING_CLASS
              )}
            >
              <Plus size={12} />
              Log Shift
            </button>
          </div>
        )}
      </div>
    </GlassCard>
  );
}

export function OperationCard({
  operation,
  loadsByMachine,
  breakdownsByFleetId,
}: {
  operation: MachineOperation;
  loadsByMachine: Map<string, number>;
  breakdownsByFleetId: Map<string, Breakdown>;
}) {
  const isComplete =
    (operation.end_smu != null || operation.end_time !== null) && operation.hours_worked !== null;
  const isInProgress = operation.end_smu == null && operation.end_time === null;

  const isDozer =
    operation.machine?.machine_type === 'Dozer' ||
    Boolean(operation.machine?.machine_type?.toLowerCase().includes('dozer'));
  const isDozerOtherActivity =
    isDozer && Boolean(operation.block_drilled?.toLowerCase().startsWith('other'));
  const isDozerRollover = isDozer && !isDozerOtherActivity;

  const binFactor = operation.machine?.bin_factor || 0;
  const machineLoads = loadsByMachine.get(operation.machine_id) || 0;
  const materialBCM = isDozerRollover
    ? (operation.hours_worked || 0) * 250
    : isDozerOtherActivity
      ? 0
      : machineLoads * binFactor;
  const bcmPerHour = isDozerRollover
    ? 250
    : isDozerOtherActivity
      ? 0
      : (operation.hours_worked || 0) > 0
        ? materialBCM / (operation.hours_worked || 1)
        : 0;

  const machineBreakdown =
    breakdownsByFleetId.get(operation.machine_id) ||
    (operation.machine?.name ? breakdownsByFleetId.get(operation.machine.name) : undefined) ||
    (operation.machine?.serial_number
      ? breakdownsByFleetId.get(operation.machine.serial_number)
      : undefined);

  const delayEntries = operation.delay_entries || [];
  const totalDelayHours = delayEntries.reduce((sum, d) => sum + d.duration_hours, 0);
  const draftDelayHours = delayEntries
    .filter((d) => d.status === 'draft')
    .reduce((sum, d) => sum + d.duration_hours, 0);

  const delaysByCategory = delayEntries.reduce(
    (acc, delay) => {
      const categoryName = delay.delay_category?.name || 'Unknown';
      if (!acc[categoryName]) {
        acc[categoryName] = 0;
      }
      acc[categoryName] += delay.duration_hours;
      return acc;
    },
    {} as Record<string, number>
  );

  const [showDelays, setShowDelays] = useState(false);

  return (
    <GlassCard className={cn(SUMMARY_SURFACE_CLASS, 'px-3 py-2.5')}>
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Status Indicator */}
            <div
              className={cn(
                'h-2 w-2 rounded-full',
                machineBreakdown?.status === 'active'
                  ? 'animate-pulse bg-[var(--accent-red)] motion-reduce:animate-none'
                  : isComplete
                    ? 'bg-[var(--accent-green)]'
                    : isInProgress
                      ? 'animate-pulse bg-[var(--accent-blue)] motion-reduce:animate-none'
                      : 'bg-[var(--text-secondary)]'
              )}
            />

            {/* Machine & Details */}
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium text-[var(--text-heading)] text-xs sm:text-sm">
                  {operation.machine?.name || 'Unknown Machine'}
                </p>
                <span
                  className={`rounded px-1.5 py-0.5 font-medium text-[10px] uppercase tracking-wider ${
                    operation.shift_type === 'day'
                      ? 'border border-[var(--accent-amber)]/30 bg-[var(--accent-amber)]/15 text-[var(--accent-amber)]'
                      : 'border border-[var(--accent-blue)]/30 bg-[var(--accent-blue)]/15 text-[var(--accent-blue)]'
                  }`}
                >
                  {operation.shift_type} shift
                </span>
                {machineBreakdown && (
                  <span
                    className={cn(
                      'flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px]',
                      machineBreakdown.status === 'active'
                        ? 'bg-[var(--accent-red)]/10 text-[var(--accent-red)]'
                        : 'bg-[var(--accent-green)]/10 text-[var(--accent-green)]'
                    )}
                  >
                    <AlertCircle size={10} />
                    {machineBreakdown.status === 'active' ? 'Active Breakdown' : 'Repaired'}
                  </span>
                )}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[var(--text-muted)] text-xs">
                <span>{operation.operator?.full_name || 'No Operator'}</span>
                <span className="text-[var(--border-emphasis)]">|</span>
                <span>{operation.site?.name || 'No Site'}</span>
                {operation.block_drilled && (
                  <>
                    <span className="text-[var(--border-emphasis)]">|</span>
                    <span className="font-medium text-[var(--text-heading)]">
                      {isDozer
                        ? `Activity: ${operation.block_drilled}`
                        : `Block: ${operation.block_drilled}`}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Time, Hours, Drilling Metrics & BCM */}
          <div className="text-right">
            <p className="text-[var(--text-heading)] text-xs sm:text-sm">
              {operation.start_smu != null && operation.end_smu != null ? (
                <>
                  SMR {operation.start_smu.toFixed(1)} – {operation.end_smu.toFixed(1)}
                </>
              ) : operation.start_smu != null ? (
                <>SMR {operation.start_smu.toFixed(1)} – In Progress</>
              ) : (
                <>
                  {formatTime(operation.start_time)} -{' '}
                  {operation.end_time ? formatTime(operation.end_time) : 'In Progress'}
                </>
              )}
            </p>
            <div className="mt-0.5 flex flex-wrap items-center justify-end gap-2 text-xs">
              {operation.start_smu != null ? (
                <span className="font-mono text-[11px] text-[var(--text-muted)]">
                  {formatTime(operation.start_time)}
                  {operation.end_time ? ` - ${formatTime(operation.end_time)}` : ''}
                </span>
              ) : null}
              {operation.hours_worked !== null && (
                <span className="font-medium text-[var(--accent-green)]">
                  {operation.hours_worked.toFixed(2)}h
                </span>
              )}
              {operation.meters_drilled != null && (
                <>
                  <span className="text-[var(--border-emphasis)]">|</span>
                  <span className="font-medium text-[var(--accent-green)]">
                    {Number(operation.meters_drilled).toFixed(1)}m
                  </span>
                </>
              )}
              {operation.holes_drilled != null && (
                <>
                  <span className="text-[var(--border-emphasis)]">|</span>
                  <span className="font-medium text-[var(--accent-blue)]">
                    {operation.holes_drilled} holes
                  </span>
                </>
              )}
              {(binFactor > 0 || isDozerRollover) && (
                <>
                  <span className="text-[var(--border-emphasis)]">|</span>
                  <span className="text-[var(--accent-blue)]">
                    {isDozerRollover
                      ? `Roll-over: ${materialBCM.toFixed(1)} BCM`
                      : `${materialBCM.toFixed(1)} BCM`}
                  </span>
                  <span className="text-[var(--border-emphasis)]">|</span>
                  <span className="text-[var(--accent-blue)]">{bcmPerHour.toFixed(1)} BCM/h</span>
                </>
              )}
              {isDozerOtherActivity && (
                <>
                  <span className="text-[var(--border-emphasis)]">|</span>
                  <span className="text-[var(--text-secondary)]">Other Dozer Activity</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Breakdown Summary */}
        {machineBreakdown && (
          <div className="border-[var(--border-default)] border-t pt-2">
            <div className="flex items-start gap-2 text-xs">
              <AlertCircle
                size={14}
                className={cn(
                  'mt-0.5 shrink-0',
                  machineBreakdown.status === 'active'
                    ? 'text-[var(--accent-red)]'
                    : 'text-[var(--accent-green)]'
                )}
              />
              <div>
                <p
                  className={cn(
                    'font-medium',
                    machineBreakdown.status === 'active'
                      ? 'text-[var(--accent-red)]'
                      : 'text-[var(--accent-green)]'
                  )}
                >
                  Engineering Breakdown: {machineBreakdown.reason}
                </p>
                {machineBreakdown.repair_notes && (
                  <p className="mt-0.5 text-[var(--text-muted)]">{machineBreakdown.repair_notes}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Delay Summary */}
        {delayEntries.length > 0 && (
          <div className="border-[var(--border-default)] border-t pt-2">
            <button
              type="button"
              onClick={() => setShowDelays(!showDelays)}
              className={cn(
                'flex items-center gap-2 text-[var(--text-muted)] text-xs transition-colors hover:text-[var(--text-heading)] motion-reduce:transition-none',
                FOCUS_RING_CLASS
              )}
            >
              <Clock size={14} />
              <span className="font-medium">
                {delayEntries.length} delay{delayEntries.length > 1 ? 's' : ''}
              </span>
              <span className="text-[var(--accent-red)]">{totalDelayHours.toFixed(2)}h total</span>
              {draftDelayHours > 0 && (
                <span className="text-[var(--accent-amber)]">
                  ({draftDelayHours.toFixed(2)}h draft)
                </span>
              )}
            </button>

            {showDelays && (
              <div className="mt-2 space-y-1 pl-6">
                {Object.entries(delaysByCategory).map(([category, hours]) => (
                  <div key={category} className="flex items-center justify-between text-xs">
                    <span className="text-[var(--text-muted)]">{category}</span>
                    <span className="text-[var(--text-heading)]">{hours.toFixed(2)}h</span>
                  </div>
                ))}
                {delayEntries.some((d) => d.is_manual_override) && (
                  <div className="flex items-center gap-1 text-[var(--accent-amber)] text-xs">
                    <AlertCircle size={12} />
                    <span>Includes manual override entries</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </GlassCard>
  );
}
