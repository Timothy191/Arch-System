'use client';

import { GlassCard } from '@repo/ui/GlassCard';
import { AlertCircle, CheckCircle2, Clock, Plus, Search } from 'lucide-react';
import { useState } from 'react';
import {
  type Breakdown,
  type FilterStatus,
  formatTime,
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
}

export function MachineOperationsFilterStrip({
  filterStatus,
  onFilterStatusChange,
  counts,
  searchQuery,
  onSearchQueryChange,
}: MachineOperationsFilterStripProps) {
  return (
    <div className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
        <button
          type="button"
          onClick={() => onFilterStatusChange('all')}
          className={`rounded-lg px-3 py-1.5 font-medium text-xs transition-all ${
            filterStatus === 'all'
              ? 'bg-[var(--accent-blue)] text-white shadow-sm'
              : 'border border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-heading)]'
          }`}
        >
          All Machines ({counts.total})
        </button>
        <button
          type="button"
          onClick={() => onFilterStatusChange('operating')}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium text-xs transition-all ${
            filterStatus === 'operating'
              ? 'bg-accent-green text-white shadow-sm'
              : 'border border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-heading)]'
          }`}
        >
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent-green" />
          Operating ({counts.operating})
        </button>
        <button
          type="button"
          onClick={() => onFilterStatusChange('standby')}
          className={`rounded-lg px-3 py-1.5 font-medium text-xs transition-all ${
            filterStatus === 'standby'
              ? 'bg-[var(--text-heading)] text-white shadow-sm'
              : 'border border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-heading)]'
          }`}
        >
          Standby ({counts.standby})
        </button>
        {counts.breakdown > 0 && (
          <button
            type="button"
            onClick={() => onFilterStatusChange('breakdown')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium text-xs transition-all ${
              filterStatus === 'breakdown'
                ? 'bg-accent-red text-white shadow-sm'
                : 'border border-accent-red/30 bg-accent-red/10 text-accent-red hover:bg-accent-red/20'
            }`}
          >
            <AlertCircle size={12} />
            Breakdowns ({counts.breakdown})
          </button>
        )}
      </div>

      {/* Search Input */}
      <div className="relative min-w-[240px]">
        <Search
          size={14}
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[var(--text-muted)]"
        />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchQueryChange(e.target.value)}
          placeholder="Search machine, type, or SN..."
          className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] py-1.5 pr-3 pl-8 text-[var(--text-heading)] text-xs transition-colors placeholder:text-[var(--text-muted)] focus:border-[var(--accent-blue)] focus:outline-none"
        />
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
  status: 'breakdown' | 'in-progress' | 'operating' | 'standby';
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
    <GlassCard className="px-4 py-3">
      <div className="space-y-3">
        {/* Machine Header Row */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Left: Indicator, Machine Name, Type, SN */}
          <div className="flex min-w-0 items-center gap-3">
            {/* Status Indicator */}
            <div
              className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                status === 'breakdown'
                  ? 'animate-pulse bg-accent-red'
                  : status === 'in-progress'
                    ? 'animate-pulse bg-accent-blue'
                    : status === 'operating'
                      ? 'bg-accent-green'
                      : 'bg-[var(--text-muted)]/50'
              }`}
            />

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-[var(--text-heading)] text-sm">
                  {machine.name}
                </span>
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
              <span className="inline-flex items-center gap-1 rounded-md border border-accent-red/20 bg-accent-red/10 px-2 py-0.5 font-medium text-accent-red text-xs">
                <AlertCircle size={12} />
                Breakdown
              </span>
            )}
            {status === 'in-progress' && (
              <span className="inline-flex animate-pulse items-center gap-1 rounded-md border border-[var(--accent-blue)]/20 bg-accent-blue/10 px-2 py-0.5 font-medium text-[var(--accent-blue)] text-xs">
                <Clock size={12} />
                In Progress
              </span>
            )}
            {status === 'operating' && (
              <span className="inline-flex items-center gap-1 rounded-md border border-accent-green/20 bg-accent-green/10 px-2 py-0.5 font-medium text-accent-green text-xs">
                <CheckCircle2 size={12} />
                {totalHours.toFixed(1)}h logged
              </span>
            )}
            {status === 'standby' && (
              <span className="inline-flex items-center gap-1 rounded-md border border-[var(--border-default)] bg-[var(--bg-secondary)] px-2 py-0.5 font-medium text-[var(--text-muted)] text-xs">
                Standby
              </span>
            )}

            {/* Shift Count / Toggle button */}
            {operations.length > 0 && (
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="ml-1 font-medium text-[var(--accent-blue)] text-xs hover:underline"
              >
                {operations.length} shift{operations.length !== 1 ? 's' : ''} (
                {isExpanded ? 'Hide' : 'Show'})
              </button>
            )}
          </div>
        </div>

        {/* Breakdown Alert Banner */}
        {breakdown && breakdown.status === 'active' && (
          <div className="rounded-lg border border-accent-red/20 bg-accent-red/10 p-2.5 text-xs">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                <AlertCircle size={14} className="mt-0.5 shrink-0 text-accent-red" />
                <div>
                  <p className="font-semibold text-accent-red">
                    Engineering Breakdown: {breakdown.reason}
                  </p>
                  {breakdown.repair_notes && (
                    <p className="mt-0.5 text-[var(--text-secondary)]">{breakdown.repair_notes}</p>
                  )}
                </div>
              </div>
              {engineeringDelay && engineeringDelay.hours > 0 && (
                <span className="rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 font-mono font-semibold text-[11px] text-amber-900">
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
              className="inline-flex items-center gap-1 font-medium text-[var(--accent-blue)] transition-colors hover:text-[var(--accent-blue)]/80"
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

  const binFactor = operation.machine?.bin_factor || 0;
  const machineLoads = loadsByMachine.get(operation.machine_id) || 0;
  const materialBCM = isDozer ? (operation.hours_worked || 0) * 250 : machineLoads * binFactor;
  const bcmPerHour = isDozer
    ? 250
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
    <GlassCard className="px-3 py-2.5">
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Status Indicator */}
            <div
              className={`h-2 w-2 rounded-full ${
                machineBreakdown?.status === 'active'
                  ? 'animate-pulse bg-accent-red'
                  : isComplete
                    ? 'bg-accent-green'
                    : isInProgress
                      ? 'animate-pulse bg-accent-blue'
                      : 'bg-[var(--text-secondary)]'
              }`}
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
                    className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] ${
                      machineBreakdown.status === 'active'
                        ? 'bg-accent-red/10 text-accent-red'
                        : 'bg-accent-green/10 text-accent-green'
                    }`}
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
                      Block: {operation.block_drilled}
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
                <span className="font-medium text-accent-green">
                  {operation.hours_worked.toFixed(2)}h
                </span>
              )}
              {operation.meters_drilled != null && (
                <>
                  <span className="text-[var(--border-emphasis)]">|</span>
                  <span className="font-medium text-accent-green">
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
              {(binFactor > 0 || isDozer) && (
                <>
                  <span className="text-[var(--border-emphasis)]">|</span>
                  <span className="text-[var(--accent-blue)]">
                    {isDozer
                      ? `Roll-over: ${materialBCM.toFixed(1)} BCM`
                      : `${materialBCM.toFixed(1)} BCM`}
                  </span>
                  <span className="text-[var(--border-emphasis)]">|</span>
                  <span className="text-accent-blue">{bcmPerHour.toFixed(1)} BCM/h</span>
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
                className={
                  machineBreakdown.status === 'active'
                    ? 'mt-0.5 shrink-0 text-accent-red'
                    : 'mt-0.5 shrink-0 text-accent-green'
                }
              />
              <div>
                <p
                  className={`font-medium ${machineBreakdown.status === 'active' ? 'text-accent-red' : 'text-accent-green'}`}
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
              className="flex items-center gap-2 text-[var(--text-muted)] text-xs transition-colors hover:text-[var(--text-heading)]"
            >
              <Clock size={14} />
              <span className="font-medium">
                {delayEntries.length} delay{delayEntries.length > 1 ? 's' : ''}
              </span>
              <span className="text-accent-red">{totalDelayHours.toFixed(2)}h total</span>
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
