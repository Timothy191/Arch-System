'use client';

import { GlassCard } from '@repo/ui/GlassCard';
import {
  COAL_MATERIAL_SUBCATEGORIES,
  computeDumperLoadsAndBcm,
  type HourlyLoadSegmentSummary,
  WASTE_MATERIAL_SUBCATEGORIES,
} from '../hourly-loads/loads-utils';

const MATERIAL_TYPES = [
  'Waste',
  'Coal',
  ...COAL_MATERIAL_SUBCATEGORIES.filter((s) => s !== 'Other'),
  ...WASTE_MATERIAL_SUBCATEGORIES.filter((s) => s !== 'Other'),
  'Partings',
  'Soil',
  'Other',
];

interface DumperMachine {
  id: string;
  name: string;
  machine_type: string;
  bin_factor: number | null;
  site_id: string | null;
}

export interface DumperAssignmentRow {
  key: string;
  dumperMachineId: string;
  materialType: string;
  totalLoads: number;
  totalBcm: number;
  autoPlaced?: boolean;
  segmentCount?: number;
}

interface ExcavatorDumperTableProps {
  excavatorId?: string;
  siteDumpers: DumperMachine[];
  shiftType: 'day' | 'night';
  todayDumperLoads: HourlyLoadSegmentSummary[];
  assignments: DumperAssignmentRow[];
  onAssignmentsChange: (_updated: DumperAssignmentRow[]) => void;
  errors?: Record<string, string>;
}

let rowKeyCounter = 0;
function newRowKey(): string {
  return `row-${Date.now()}-${++rowKeyCounter}`;
}

export function ExcavatorDumperTable({
  excavatorId,
  siteDumpers,
  shiftType,
  todayDumperLoads,
  assignments,
  onAssignmentsChange,
  errors,
}: ExcavatorDumperTableProps) {
  const handleAddRow = () => {
    onAssignmentsChange([
      ...assignments,
      {
        key: newRowKey(),
        dumperMachineId: '',
        materialType: 'Waste',
        totalLoads: 0,
        totalBcm: 0,
        autoPlaced: false,
      },
    ]);
  };

  const handleRemoveRow = (index: number) => {
    onAssignmentsChange(assignments.filter((_, i) => i !== index));
  };

  const handleDumperChange = (index: number, dumperId: string) => {
    const dumper = siteDumpers.find((d) => d.id === dumperId);
    const binFactor = dumper?.bin_factor || 0;

    const updated = [...assignments];
    const existing = updated[index];
    if (!existing) return;

    // Infer material from hourly_loads if this dumper has an assigned load for this excavator
    const assignedLoad = todayDumperLoads.find(
      (l) =>
        l.machine_id === dumperId &&
        l.shift_type === shiftType &&
        (!excavatorId || !l.excavator_id || l.excavator_id === excavatorId)
    );
    const effectiveMaterial = assignedLoad?.material_type || existing.materialType || 'Waste';

    const { totalLoads, totalBcm } = computeDumperLoadsAndBcm(
      todayDumperLoads,
      dumperId,
      shiftType,
      binFactor,
      {
        excavatorId,
        materialType: effectiveMaterial,
      }
    );

    updated[index] = {
      ...existing,
      dumperMachineId: dumperId,
      materialType: effectiveMaterial,
      totalLoads,
      totalBcm,
      autoPlaced: Boolean(assignedLoad?.excavator_id && assignedLoad.excavator_id === excavatorId),
    };
    onAssignmentsChange(updated);
  };

  const handleMaterialChange = (index: number, material: string) => {
    const updated = [...assignments];
    const existing = updated[index];
    if (!existing) return;

    const dumper = siteDumpers.find((d) => d.id === existing.dumperMachineId);
    const binFactor = dumper?.bin_factor || 0;
    const { totalLoads, totalBcm } = computeDumperLoadsAndBcm(
      todayDumperLoads,
      existing.dumperMachineId,
      shiftType,
      binFactor,
      {
        excavatorId,
        materialType: material,
      }
    );

    updated[index] = {
      ...existing,
      materialType: material,
      totalLoads,
      totalBcm,
    };
    onAssignmentsChange(updated);
  };

  const handleDuplicateRow = (index: number) => {
    const row = assignments[index];
    if (!row) return;
    const nextMaterial = row.materialType === 'Coal' ? 'Waste' : 'Coal';
    const dumper = siteDumpers.find((d) => d.id === row.dumperMachineId);
    const binFactor = dumper?.bin_factor || 0;
    const { totalLoads, totalBcm } = computeDumperLoadsAndBcm(
      todayDumperLoads,
      row.dumperMachineId,
      shiftType,
      binFactor,
      {
        excavatorId,
        materialType: nextMaterial,
      }
    );

    const newRow: DumperAssignmentRow = {
      key: newRowKey(),
      dumperMachineId: row.dumperMachineId,
      materialType: nextMaterial,
      totalLoads,
      totalBcm,
      autoPlaced: false,
    };
    const updated = [...assignments];
    updated.splice(index + 1, 0, newRow);
    onAssignmentsChange(updated);
  };

  const runningTotalBcm = assignments.reduce((sum, a) => sum + a.totalBcm, 0);
  const runningTotalLoads = assignments.reduce((sum, a) => sum + a.totalLoads, 0);
  const autoPlacedCount = assignments.filter((a) => a.autoPlaced).length;

  if (siteDumpers.length === 0) {
    return (
      <GlassCard>
        <p className="py-4 text-center text-[var(--text-muted)] text-sm">
          No active haul trucks (ADT / RDT) found in fleet.
        </p>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <h4 className="font-semibold text-[var(--text-heading)] text-sm">
            Assigned Machines &amp; Logged Loads (ADT / RDT / Dump Truck)
          </h4>
          {autoPlacedCount > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--accent-blue)]/20 bg-[var(--accent-blue)]/10 px-2.5 py-0.5 font-medium text-[11px] text-[var(--accent-blue)]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--accent-blue)]" />
              {autoPlacedCount} auto-placed from Hourly Loads
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={handleAddRow}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--accent-blue)]/20 bg-[var(--accent-blue)]/10 px-3 py-1.5 font-semibold text-[var(--accent-blue)] text-xs transition-colors hover:bg-[var(--accent-blue)]/20"
        >
          <span className="text-sm leading-none">+</span> Add Machine
        </button>
      </div>

      {assignments.length === 0 ? (
        <GlassCard>
          <p className="py-6 text-center text-[var(--text-muted)] text-sm">
            No dumpers assigned yet. Assign an Excavator to ADT/RDT machines on{' '}
            <span className="font-medium text-[var(--text-heading)]">Hourly Loads</span> to
            auto-place them here, or click &quot;+ Add Machine&quot;.
          </p>
        </GlassCard>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--border-default)] bg-[var(--bg-primary)]">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-[var(--border-default)] border-b bg-[var(--bg-secondary)]/80">
                <th
                  scope="col"
                  className="w-12 px-3 py-2.5 text-center align-middle font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider"
                >
                  #
                </th>
                <th
                  scope="col"
                  className="min-w-[220px] px-3 py-2.5 text-left align-middle font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider"
                >
                  Assigned Machine
                </th>
                <th
                  scope="col"
                  className="min-w-[160px] px-3 py-2.5 text-left align-middle font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider"
                >
                  Type &amp; Bin Factor
                </th>
                <th
                  scope="col"
                  className="min-w-[150px] px-3 py-2.5 text-left align-middle font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider"
                >
                  Source
                </th>
                <th
                  scope="col"
                  className="min-w-[170px] px-3 py-2.5 text-left align-middle font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider"
                >
                  Material Logged
                </th>
                <th
                  scope="col"
                  className="w-28 px-3 py-2.5 text-right align-middle font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider"
                >
                  Loads
                </th>
                <th
                  scope="col"
                  className="w-32 px-3 py-2.5 text-right align-middle font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider"
                >
                  Volume (BCM)
                </th>
                <th
                  scope="col"
                  className="w-24 px-3 py-2.5 text-right align-middle font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wider"
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-default)]/60">
              {assignments.map((assignment, index) => {
                const selectedDumper = siteDumpers.find((d) => d.id === assignment.dumperMachineId);
                return (
                  <tr
                    key={assignment.key}
                    className="transition-colors hover:bg-[var(--bg-secondary)]/40"
                  >
                    <td className="px-3 py-2.5 text-center align-middle font-mono text-[var(--text-muted)] text-xs">
                      {index + 1}
                    </td>
                    <td className="px-3 py-2.5 align-middle">
                      <select
                        value={assignment.dumperMachineId}
                        onChange={(e) => handleDumperChange(index, e.target.value)}
                        className="h-9 w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-2.5 font-medium text-[var(--text-heading)] text-sm transition-colors focus:border-[var(--accent-blue)] focus:outline-none"
                      >
                        <option value="">
                          {siteDumpers.length === 0 ? 'No dumpers in fleet' : 'Select machine...'}
                        </option>
                        {siteDumpers.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name} ({d.machine_type}
                            {d.bin_factor ? ` · ${d.bin_factor} BCM/load` : ''})
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 align-middle">
                      {selectedDumper ? (
                        <div className="inline-flex items-center gap-1.5 text-xs">
                          <span className="font-medium text-[var(--text-heading)]">
                            {selectedDumper.machine_type}
                          </span>
                          {selectedDumper.bin_factor ? (
                            <span className="font-mono text-[var(--text-muted)]">
                              · {selectedDumper.bin_factor} BCM
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-[var(--text-muted)] text-xs">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 align-middle">
                      {assignment.autoPlaced ? (
                        <div className="inline-flex items-center gap-1.5">
                          <span className="inline-flex items-center rounded-full border border-[var(--accent-blue)]/20 bg-[var(--accent-blue)]/10 px-2 py-0.5 font-medium text-[11px] text-[var(--accent-blue)]">
                            Hourly Loads
                          </span>
                          {(assignment.segmentCount ?? 1) > 1 && (
                            <span className="font-mono text-[11px] text-[var(--text-muted)]">
                              ({assignment.segmentCount} seg)
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="inline-flex items-center rounded-full border border-[var(--border-default)] bg-[var(--bg-secondary)] px-2 py-0.5 font-medium text-[11px] text-[var(--text-muted)]">
                          Manual
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 align-middle">
                      <select
                        value={assignment.materialType}
                        onChange={(e) => handleMaterialChange(index, e.target.value)}
                        className="h-9 w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-2.5 font-medium text-[var(--text-heading)] text-sm transition-colors focus:border-[var(--accent-blue)] focus:outline-none"
                      >
                        {MATERIAL_TYPES.map((mt) => (
                          <option key={mt} value={mt}>
                            {mt}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2.5 text-right align-middle font-mono tabular-nums">
                      {assignment.totalLoads > 0 ? (
                        <span className="font-semibold text-[var(--text-heading)]">
                          {assignment.totalLoads}
                        </span>
                      ) : (
                        <span className="text-[var(--text-muted)]">0</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right align-middle font-mono tabular-nums">
                      {assignment.totalBcm > 0 ? (
                        <span className="font-semibold text-[var(--accent-blue)]">
                          {assignment.totalBcm.toFixed(1)}
                        </span>
                      ) : (
                        <span className="text-[var(--text-muted)]">0.0</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right align-middle">
                      <div className="inline-flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => handleDuplicateRow(index)}
                          title="Duplicate for different material"
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-muted)] text-xs transition-colors hover:bg-[var(--bg-secondary)] hover:text-[var(--accent-blue)]"
                        >
                          ⧉
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(index)}
                          title="Remove"
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-muted)] text-xs transition-colors hover:bg-[var(--bg-secondary)] hover:text-accent-red"
                        >
                          ✕
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-[var(--border-default)] border-t bg-[var(--bg-secondary)]/60">
                <td
                  colSpan={5}
                  className="px-3 py-2.5 align-middle font-semibold text-[var(--text-heading)] text-xs uppercase tracking-wider"
                >
                  Total ({assignments.filter((a) => Boolean(a.dumperMachineId)).length} Assigned{' '}
                  {assignments.filter((a) => Boolean(a.dumperMachineId)).length === 1
                    ? 'Machine'
                    : 'Machines'}
                  )
                </td>
                <td className="px-3 py-2.5 text-right align-middle font-mono font-semibold text-[var(--text-heading)] tabular-nums">
                  {runningTotalLoads}
                </td>
                <td className="px-3 py-2.5 text-right align-middle font-mono font-semibold text-[var(--accent-blue)] tabular-nums">
                  {runningTotalBcm.toFixed(1)} BCM
                </td>
                <td className="px-3 py-2.5 align-middle" />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {errors?.dumperAssignments && (
        <p className="text-accent-red text-xs">{errors.dumperAssignments}</p>
      )}
    </div>
  );
}
