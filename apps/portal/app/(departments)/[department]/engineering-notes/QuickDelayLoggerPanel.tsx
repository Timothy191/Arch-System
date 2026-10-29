'use client';

import { GlassCard } from '@repo/ui/GlassCard';
import {
  CheckCircle2,
  Clock,
  Filter,
  PlusCircle,
  Save,
  Search,
  Sparkles,
  Wrench,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  computeMachineOverviewMetrics,
  MAX_SHIFT_HOURS,
  OVERVIEW_DELAY_COLUMNS,
  type OverviewDelayGroup,
  type OverviewDelayHours,
  type OverviewDelayKey,
  STANDARD_OVERVIEW_DELAY_DEFAULTS,
} from '@/lib/shift-sheet-buckets';

export interface OverviewOperatorOption {
  id: string;
  fullName: string;
  employeeCode: string;
}

export interface QuickLoggerMachineRow {
  machineId: string;
  machineName: string;
  machineType: string;
  serialNumber: string | null;
  startSmr: number;
  stopSmr: number;
  operatorId: string | null;
  operatorName: string | null;
  delays: OverviewDelayHours;
  comment: string;
  endsOnBreakdown: boolean;
  error: string | null;
  saved: boolean;
  carryOverBreakdown: {
    id: string;
    reason: string;
    dateIn: string;
  } | null;
}

interface QuickDelayLoggerPanelProps {
  rows: readonly QuickLoggerMachineRow[];
  operators: readonly OverviewOperatorOption[];
  selectedMachineId: string;
  onSelectMachine: (machineId: string) => void;
  onUpdateSmr: (machineId: string, field: 'startSmr' | 'stopSmr', rawValue: string) => void;
  onUpdateDelay: (machineId: string, key: OverviewDelayKey, rawValue: string) => void;
  onUpdateOperator: (machineId: string, operatorId: string) => void;
  onUpdateComment: (machineId: string, comment: string) => void;
  onToggleBreakdown: (machineId: string, checked: boolean) => void;
  onSaveRow: (machineId: string) => Promise<void>;
  savingMachineId: string | null;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  selectedTypeFilter: string;
  onTypeFilterChange: (filter: string) => void;
  isSimplifiedView: boolean;
  onToggleSimplifiedView: () => void;
}

const DURATION_PRESETS: readonly number[] = [0, 0.5, 1.0, 1.5, 2.0, 3.0, 4.0, 6.0];

const QUICK_COMMENT_TEMPLATES: Readonly<Record<OverviewDelayGroup, readonly string[]>> = {
  production: [
    'Pit blast clearance & safety hold',
    'Awaiting relief operator at change-over',
    'Standby — waiting on haul circuit / loading unit',
    'Extended refueling & fluid top-up',
  ],
  nonProduction: [
    'Heavy rain & poor pit visibility hold',
    'Lightning warning safety stand-down',
    'Haul road watering / grading clearance',
  ],
  engineering: [
    'Unscheduled mechanical breakdown inspection',
    'Hydraulic hose & pressure repair',
    'Scheduled GES / preventive maintenance service',
    'Tyre / track tension inspection & service',
  ],
};

const GROUP_PILL_ACTIVE: Record<OverviewDelayGroup, string> = {
  production: 'border-sky-500/40 bg-sky-500/15 text-sky-900 shadow-2xs',
  nonProduction: 'border-amber-500/40 bg-amber-500/15 text-amber-900 shadow-2xs',
  engineering: 'border-rose-500/40 bg-rose-500/15 text-rose-900 shadow-2xs',
};

const GROUP_LABELS: Record<OverviewDelayGroup, string> = {
  production: 'Production Delays',
  nonProduction: 'Natural & Other',
  engineering: 'Engineering & Breakdown',
};

const PILL_BTN_BASE =
  'cursor-pointer rounded-full border px-2.5 py-1 font-semibold text-xs transition-colors';
const INPUT_CONTROL_BASE =
  'w-full rounded-lg border border-[var(--border-default)] bg-white px-2.5 py-1.5 font-medium text-[var(--text-heading)] text-xs focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]';

export function QuickDelayLoggerPanel({
  rows,
  operators,
  selectedMachineId,
  onSelectMachine,
  onUpdateSmr,
  onUpdateDelay,
  onUpdateOperator,
  onUpdateComment,
  onToggleBreakdown,
  onSaveRow,
  savingMachineId,
  searchQuery,
  onSearchQueryChange,
  selectedTypeFilter,
  onTypeFilterChange,
  isSimplifiedView,
  onToggleSimplifiedView,
}: QuickDelayLoggerPanelProps) {
  const [activeDelayGroup, setActiveDelayGroup] = useState<OverviewDelayGroup>('production');
  const [activeDelayKey, setActiveDelayKey] = useState<OverviewDelayKey>('blasting');

  const selectedRow = useMemo(
    () => rows.find((r) => r.machineId === selectedMachineId) ?? rows[0] ?? null,
    [rows, selectedMachineId]
  );

  const machineTypes = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of rows) {
      const typeLabel = r.machineType || 'Other';
      counts.set(typeLabel, (counts.get(typeLabel) ?? 0) + 1);
    }
    return Array.from(counts.entries());
  }, [rows]);

  const abnormalRowCount = useMemo(
    () =>
      rows.filter((r) => {
        if (r.carryOverBreakdown || r.endsOnBreakdown) return true;
        return OVERVIEW_DELAY_COLUMNS.some((col) => {
          const std = STANDARD_OVERVIEW_DELAY_DEFAULTS[col.key] ?? 0;
          return Math.abs((r.delays[col.key] ?? 0) - std) > 0.01;
        });
      }).length,
    [rows]
  );

  if (!selectedRow) return null;

  const metrics = computeMachineOverviewMetrics(
    selectedRow.startSmr,
    selectedRow.stopSmr,
    selectedRow.delays,
    MAX_SHIFT_HOURS
  );

  const activeColumnMeta =
    OVERVIEW_DELAY_COLUMNS.find((c) => c.key === activeDelayKey) ?? OVERVIEW_DELAY_COLUMNS[0]!;
  const currentDelayVal = selectedRow.delays[activeColumnMeta.key] ?? 0;
  const groupColumns = OVERVIEW_DELAY_COLUMNS.filter((c) => c.delayGroup === activeDelayGroup);

  const nonZeroDelays = OVERVIEW_DELAY_COLUMNS.filter((col) => {
    const hours = selectedRow.delays[col.key] ?? 0;
    const std = STANDARD_OVERVIEW_DELAY_DEFAULTS[col.key] ?? 0;
    return hours > 0 && (!col.isStandardAllowance || Math.abs(hours - std) > 0.01);
  });

  const handleSelectGroup = (group: OverviewDelayGroup) => {
    setActiveDelayGroup(group);
    const firstInGroup = OVERVIEW_DELAY_COLUMNS.find((c) => c.delayGroup === group);
    if (firstInGroup) {
      setActiveDelayKey(firstInGroup.key);
    }
  };

  const handleApplyTemplate = (template: string) => {
    const existing = selectedRow.comment.trim();
    const isDefaultNote = existing.startsWith('Standard shift allowances');
    const nextComment =
      !existing || isDefaultNote
        ? `${activeColumnMeta.label}: ${template}`
        : `${existing}; ${activeColumnMeta.label}: ${template}`;
    onUpdateComment(selectedRow.machineId, nextComment);
  };

  return (
    <div className="space-y-3" data-testid="quick-delay-logger">
      {/* Guided 3-Step Quick Delay & Shift SMR Logger */}
      <GlassCard className="gold-steel-border border border-[var(--accent-blue)]/30 bg-white/90 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-black/[0.06] border-b pb-2.5">
          <div className="flex items-center gap-2">
            <span className="gold-steel-border gold-steel-border-slim flex h-7 w-7 items-center justify-center rounded-full bg-[var(--accent-blue)]/15 text-[var(--accent-blue)]">
              <PlusCircle className="h-4 w-4" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-[var(--text-heading)] text-sm">
                  Quick Machine Delay &amp; SMR Logger
                </h3>
                <span className="rounded-full bg-[var(--accent-blue)]/12 px-2 py-0.5 font-mono font-semibold text-[10px] text-[var(--accent-blue)] uppercase">
                  3-Step Fast Entry
                </span>
              </div>
              <p className="text-[11px] text-[var(--text-secondary)]">
                Select a machine, tap a delay category &amp; duration, and save — no horizontal
                scrolling required.
              </p>
            </div>
          </div>

          {/* Shift 12.0h Budget Pill for Selected Machine */}
          <div className="gold-steel-border gold-steel-border-slim flex flex-wrap items-center gap-2 rounded-xl bg-[var(--bg-secondary)]/80 px-3 py-1.5 font-mono text-[11px]">
            <Clock className="h-3.5 w-3.5 text-[var(--accent-blue)]" />
            <span className="font-bold text-[var(--text-heading)]">{selectedRow.machineName}:</span>
            <span className="font-semibold text-[var(--accent-blue)]">
              Worked {metrics.totalSmrWorked.toFixed(1)}h
            </span>
            <span className="text-[var(--text-muted)]">·</span>
            <span className="font-semibold text-amber-700">
              Logged Delay {metrics.totalDelayHours.toFixed(1)}h
            </span>
            <span className="text-[var(--text-muted)]">·</span>
            <span className="font-semibold text-accent-green">
              Max Allowance {metrics.maxDelaysAllowedHours.toFixed(1)}h
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* STEP 1: Machine, SMR & Operator (4 cols) */}
          <div className="space-y-2.5 rounded-xl border border-black/[0.06] bg-[var(--bg-secondary)]/50 p-3 lg:col-span-4">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[11px] text-[var(--accent-blue)] uppercase tracking-wider">
                1. Machine &amp; Shift SMR
              </span>
              <span className="font-mono text-[10px] text-[var(--text-secondary)]">
                Avail {metrics.availabilityPercent.toFixed(1)}% · Util{' '}
                {metrics.utilizationPercent.toFixed(1)}%
              </span>
            </div>

            <div>
              <label className="mb-1 block font-semibold text-[11px] text-[var(--text-secondary)]">
                Select Fleet Machine ({rows.length} total)
              </label>
              <select
                aria-label="Quick Log Machine"
                value={selectedRow.machineId}
                onChange={(e) => onSelectMachine(e.target.value)}
                className={INPUT_CONTROL_BASE}
              >
                {rows.map((r) => (
                  <option key={r.machineId} value={r.machineId}>
                    {r.machineName} ({r.machineType}) —{' '}
                    {r.carryOverBreakdown ? '⚠️ BREAKDOWN' : r.saved ? '✓ Saved' : ' Editable'}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block font-semibold text-[11px] text-[var(--text-secondary)]">
                  Start SMR (h)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  aria-label="Quick Start SMR"
                  value={selectedRow.startSmr}
                  onChange={(e) => onUpdateSmr(selectedRow.machineId, 'startSmr', e.target.value)}
                  className={`${INPUT_CONTROL_BASE} font-mono`}
                />
              </div>
              <div>
                <label className="mb-1 block font-semibold text-[11px] text-[var(--text-secondary)]">
                  Stop SMR (h)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min={selectedRow.startSmr}
                  max={Number((selectedRow.startSmr + MAX_SHIFT_HOURS).toFixed(2))}
                  aria-label="Quick Stop SMR"
                  value={selectedRow.stopSmr}
                  onChange={(e) => onUpdateSmr(selectedRow.machineId, 'stopSmr', e.target.value)}
                  className={`${INPUT_CONTROL_BASE} font-mono`}
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block font-semibold text-[11px] text-[var(--text-secondary)]">
                Assigned Operator
              </label>
              <select
                aria-label="Quick Operator"
                value={selectedRow.operatorId ?? ''}
                onChange={(e) => onUpdateOperator(selectedRow.machineId, e.target.value)}
                className={INPUT_CONTROL_BASE}
              >
                <option value="">
                  {selectedRow.operatorName ? selectedRow.operatorName : 'Select operator...'}
                </option>
                {operators.map((op) => (
                  <option key={op.id} value={op.id}>
                    {op.fullName} ({op.employeeCode})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* STEP 2: Delay Category, Reason & Duration Chips (5 cols) */}
          <div className="space-y-2.5 rounded-xl border border-black/[0.06] bg-[var(--bg-secondary)]/50 p-3 lg:col-span-5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[11px] text-[var(--accent-blue)] uppercase tracking-wider">
                2. Delay Category &amp; Hours
              </span>
              <span className="font-mono text-[10px] text-[var(--text-secondary)]">
                Std Allowances: 2.4h pre-filled
              </span>
            </div>

            {/* Category Tabs */}
            <div className="flex flex-wrap gap-1.5">
              {(['production', 'nonProduction', 'engineering'] as const).map((group) => (
                <button
                  key={group}
                  type="button"
                  onClick={() => handleSelectGroup(group)}
                  className={`${PILL_BTN_BASE} ${
                    activeDelayGroup === group
                      ? GROUP_PILL_ACTIVE[group]
                      : 'border-[var(--border-default)] bg-white text-[var(--text-secondary)] hover:text-[var(--text-heading)]'
                  }`}
                >
                  {GROUP_LABELS[group]}
                </button>
              ))}
            </div>

            {/* Specific Delay Reason Buttons */}
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {groupColumns.map((col) => {
                const val = selectedRow.delays[col.key] ?? 0;
                const isSelected = activeDelayKey === col.key;
                return (
                  <button
                    key={col.key}
                    type="button"
                    onClick={() => setActiveDelayKey(col.key)}
                    className={`cursor-pointer rounded-lg border px-2.5 py-1 font-medium text-xs transition-all ${
                      isSelected
                        ? 'gold-steel-border gold-steel-border-slim border-[var(--accent-blue)] bg-[var(--accent-blue)]/15 font-bold text-[var(--text-heading)]'
                        : 'border-[var(--border-default)] bg-white text-[var(--text-secondary)] hover:bg-white/90'
                    }`}
                  >
                    <span>{col.label}</span>
                    <span className="ml-1.5 rounded bg-black/[0.06] px-1 py-0.2 font-mono text-[10px]">
                      {val.toFixed(1)}h
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Duration Input + Quick Preset Chips */}
            <div className="rounded-lg border border-black/[0.06] bg-white p-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="font-semibold text-[var(--text-heading)] text-xs">
                  {activeColumnMeta.label} Hours:
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max={metrics.maxDelaysAllowedHours}
                    aria-label="Quick Delay Hours"
                    value={currentDelayVal}
                    onChange={(e) =>
                      onUpdateDelay(selectedRow.machineId, activeColumnMeta.key, e.target.value)
                    }
                    className="w-20 rounded-md border border-[var(--border-default)] bg-[var(--bg-secondary)] px-2 py-1 text-right font-bold font-mono text-[var(--text-heading)] text-xs"
                  />
                  <span className="font-mono text-[11px] text-[var(--text-secondary)]">hrs</span>
                </div>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-1">
                <span className="mr-1 font-medium text-[10px] text-[var(--text-secondary)]">
                  Quick tap:
                </span>
                {DURATION_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() =>
                      onUpdateDelay(selectedRow.machineId, activeColumnMeta.key, String(preset))
                    }
                    className={`cursor-pointer rounded border px-2 py-0.5 font-mono font-semibold text-[11px] transition-colors ${
                      Math.abs(currentDelayVal - preset) < 0.01
                        ? 'border-[var(--accent-blue)] bg-[var(--accent-blue)] text-white'
                        : 'border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-heading)] hover:border-[var(--accent-blue)]/50'
                    }`}
                  >
                    {preset === 0 ? '0h' : `${preset.toFixed(1)}h`}
                  </button>
                ))}
              </div>
            </div>

            {/* Active Non-Standard Delays Summary */}
            {nonZeroDelays.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-[11px]">
                <span className="font-semibold text-[var(--text-secondary)]">Logged:</span>
                {nonZeroDelays.map((col) => (
                  <span
                    key={col.key}
                    className="inline-flex items-center gap-1 rounded-full border border-amber-500/35 bg-amber-500/10 px-2 py-0.5 font-mono font-semibold text-[10px] text-amber-900"
                  >
                    {col.label}: {(selectedRow.delays[col.key] ?? 0).toFixed(1)}h
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* STEP 3: Reason Note & One-Click Save (3 cols) */}
          <div className="flex flex-col justify-between space-y-2.5 rounded-xl border border-black/[0.06] bg-[var(--bg-secondary)]/50 p-3 lg:col-span-3">
            <div className="space-y-2">
              <span className="font-bold text-[11px] text-[var(--accent-blue)] uppercase tracking-wider">
                3. Comment &amp; Save
              </span>

              <div>
                <label className="mb-1 block font-semibold text-[11px] text-[var(--text-secondary)]">
                  Shift / Delay Note (Required on Delay)
                </label>
                <input
                  type="text"
                  aria-label="Quick Delay Comment"
                  value={selectedRow.comment}
                  onChange={(e) => onUpdateComment(selectedRow.machineId, e.target.value)}
                  placeholder="Describe delay reason..."
                  className={INPUT_CONTROL_BASE}
                />
              </div>

              {/* One-Click Note Templates */}
              <div className="space-y-1">
                <span className="flex items-center gap-1 font-medium text-[10px] text-[var(--text-secondary)]">
                  <Sparkles className="h-3 w-3 text-[var(--accent-blue)]" />
                  One-tap note templates:
                </span>
                <div className="flex flex-wrap gap-1">
                  {QUICK_COMMENT_TEMPLATES[activeDelayGroup].map((tpl) => (
                    <button
                      key={tpl}
                      type="button"
                      onClick={() => handleApplyTemplate(tpl)}
                      className="cursor-pointer rounded border border-[var(--border-default)] bg-white px-2 py-0.5 text-left text-[10px] text-[var(--text-heading)] transition-colors hover:border-[var(--accent-blue)] hover:text-[var(--accent-blue)]"
                    >
                      + {tpl}
                    </button>
                  ))}
                </div>
              </div>

              <label className="inline-flex cursor-pointer items-center gap-1.5 pt-1 text-[11px] text-[var(--text-secondary)]">
                <input
                  type="checkbox"
                  checked={selectedRow.endsOnBreakdown}
                  onChange={(e) => onToggleBreakdown(selectedRow.machineId, e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-[var(--border-default)]"
                />
                <span>Machine ends shift on breakdown</span>
              </label>
            </div>

            <button
              type="button"
              data-testid="quick-delay-save-btn"
              onClick={() => void onSaveRow(selectedRow.machineId)}
              disabled={savingMachineId === selectedRow.machineId}
              className="gold-steel-border flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[var(--accent-blue)] py-2.5 font-semibold text-white text-xs hover:opacity-90 disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              {savingMachineId === selectedRow.machineId
                ? `Saving ${selectedRow.machineName}...`
                : `Save ${selectedRow.machineName} Ledger`}
            </button>
          </div>
        </div>
      </GlassCard>

      {/* Fleet Filter, Search & Simplified View Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-black/[0.06] bg-white/85 px-3.5 py-2.5 shadow-2xs backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-64">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="search"
              aria-label="Search fleet machines"
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              placeholder="Search machine, serial, or operator..."
              className="w-full rounded-lg border border-[var(--border-default)] bg-white py-1 pr-2.5 pl-8 text-[var(--text-heading)] text-xs focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1">
            <Filter className="mr-0.5 h-3.5 w-3.5 text-[var(--text-muted)]" />
            <button
              type="button"
              onClick={() => onTypeFilterChange('all')}
              className={`${PILL_BTN_BASE} ${
                selectedTypeFilter === 'all'
                  ? 'border-[var(--accent-blue)] bg-[var(--accent-blue)] text-white'
                  : 'border-[var(--border-default)] bg-white text-[var(--text-secondary)]'
              }`}
            >
              All ({rows.length})
            </button>
            <button
              type="button"
              onClick={() => onTypeFilterChange('abnormal')}
              className={`${PILL_BTN_BASE} ${
                selectedTypeFilter === 'abnormal'
                  ? 'border-amber-600 bg-amber-600 text-white'
                  : 'border-amber-500/35 bg-amber-500/10 text-amber-900'
              }`}
            >
              <Wrench className="mr-1 inline h-3 w-3" />
              Delays / Breakdowns ({abnormalRowCount})
            </button>
            {machineTypes.map(([typeLabel, count]) => (
              <button
                key={typeLabel}
                type="button"
                onClick={() => onTypeFilterChange(typeLabel)}
                className={`${PILL_BTN_BASE} ${
                  selectedTypeFilter === typeLabel
                    ? 'border-[var(--accent-blue)] bg-[var(--accent-blue)] text-white'
                    : 'border-[var(--border-default)] bg-white text-[var(--text-secondary)]'
                }`}
              >
                {typeLabel} ({count})
              </button>
            ))}
          </div>
        </div>

        {/* Toggle between Simplified View (hides 6 pre-filled std columns) and Full 20-Column Ledger */}
        <button
          type="button"
          data-testid="table-view-mode-toggle"
          onClick={onToggleSimplifiedView}
          className="gold-steel-border inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-white px-3 py-1 font-semibold text-[var(--text-heading)] text-xs shadow-2xs hover:bg-[var(--accent-blue)]/10"
        >
          <CheckCircle2 className="h-3.5 w-3.5 text-[var(--accent-blue)]" />
          {isSimplifiedView
            ? 'Show All 20 Columns (Include 6 Std Allowances)'
            : 'Simplified Table (Hide 6 Std Allowance Columns)'}
        </button>
      </div>
    </div>
  );
}
