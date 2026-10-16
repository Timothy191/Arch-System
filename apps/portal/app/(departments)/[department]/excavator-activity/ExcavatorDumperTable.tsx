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
        <p className="text-[var(--text-muted)] text-sm text-center py-4">
          No active haul trucks (ADT / RDT) found in fleet.
        </p>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <h4 className="text-sm font-semibold text-[var(--text-heading)]">
            Assigned Machines &amp; Logged Loads (ADT / RDT / Dump Truck)
          </h4>
          {autoPlacedCount > 0 && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] border border-[var(--accent-blue)]/20">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-blue)] animate-pulse" />
              {autoPlacedCount} auto-placed from Hourly Loads
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={handleAddRow}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] hover:bg-[var(--accent-blue)]/20 border border-[var(--accent-blue)]/20 text-xs font-semibold transition-colors"
        >
          <span className="text-sm leading-none">+</span> Add Machine
        </button>
      </div>

      {assignments.length === 0 ? (
        <GlassCard>
          <p className="text-[var(--text-muted)] text-sm text-center py-6">
            No dumpers assigned yet. Assign an Excavator to ADT/RDT machines on{' '}
            <span className="text-[var(--text-heading)] font-medium">Hourly Loads</span> to
            auto-place them here, or click &quot;+ Add Machine&quot;.
          </p>
        </GlassCard>
      ) : (
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-primary)] overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-[var(--border-default)] bg-[var(--bg-secondary)]/80">
                <th
                  scope="col"
                  className="text-center text-[var(--text-muted)] py-2.5 px-3 font-semibold text-xs uppercase tracking-wider w-12 align-middle"
                >
                  #
                </th>
                <th
                  scope="col"
                  className="text-left text-[var(--text-muted)] py-2.5 px-3 font-semibold text-xs uppercase tracking-wider min-w-[220px] align-middle"
                >
                  Assigned Machine
                </th>
                <th
                  scope="col"
                  className="text-left text-[var(--text-muted)] py-2.5 px-3 font-semibold text-xs uppercase tracking-wider min-w-[160px] align-middle"
                >
                  Type &amp; Bin Factor
                </th>
                <th
                  scope="col"
                  className="text-left text-[var(--text-muted)] py-2.5 px-3 font-semibold text-xs uppercase tracking-wider min-w-[150px] align-middle"
                >
                  Source
                </th>
                <th
                  scope="col"
                  className="text-left text-[var(--text-muted)] py-2.5 px-3 font-semibold text-xs uppercase tracking-wider min-w-[170px] align-middle"
                >
                  Material Logged
                </th>
                <th
                  scope="col"
                  className="text-right text-[var(--text-muted)] py-2.5 px-3 font-semibold text-xs uppercase tracking-wider w-28 align-middle"
                >
                  Loads
                </th>
                <th
                  scope="col"
                  className="text-right text-[var(--text-muted)] py-2.5 px-3 font-semibold text-xs uppercase tracking-wider w-32 align-middle"
                >
                  Volume (BCM)
                </th>
                <th
                  scope="col"
                  className="text-right text-[var(--text-muted)] py-2.5 px-3 font-semibold text-xs uppercase tracking-wider w-24 align-middle"
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
                    className="hover:bg-[var(--bg-secondary)]/40 transition-colors"
                  >
                    <td className="py-2.5 px-3 text-center text-[var(--text-muted)] font-mono text-xs align-middle">
                      {index + 1}
                    </td>
                    <td className="py-2.5 px-3 align-middle">
                      <select
                        value={assignment.dumperMachineId}
                        onChange={(e) => handleDumperChange(index, e.target.value)}
                        className="h-9 w-full bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg px-2.5 text-[var(--text-heading)] text-sm font-medium focus:outline-none focus:border-[var(--accent-blue)] transition-colors"
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
                    <td className="py-2.5 px-3 align-middle whitespace-nowrap">
                      {selectedDumper ? (
                        <div className="inline-flex items-center gap-1.5 text-xs">
                          <span className="font-medium text-[var(--text-heading)]">
                            {selectedDumper.machine_type}
                          </span>
                          {selectedDumper.bin_factor ? (
                            <span className="text-[var(--text-muted)] font-mono">
                              · {selectedDumper.bin_factor} BCM
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-xs text-[var(--text-muted)]">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 align-middle whitespace-nowrap">
                      {assignment.autoPlaced ? (
                        <div className="inline-flex items-center gap-1.5">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] border border-[var(--accent-blue)]/20">
                            Hourly Loads
                          </span>
                          {(assignment.segmentCount ?? 1) > 1 && (
                            <span className="text-[11px] text-[var(--text-muted)] font-mono">
                              ({assignment.segmentCount} seg)
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--bg-secondary)] text-[var(--text-muted)] border border-[var(--border-default)]">
                          Manual
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 align-middle">
                      <select
                        value={assignment.materialType}
                        onChange={(e) => handleMaterialChange(index, e.target.value)}
                        className="h-9 w-full bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg px-2.5 text-[var(--text-heading)] text-sm font-medium focus:outline-none focus:border-[var(--accent-blue)] transition-colors"
                      >
                        {MATERIAL_TYPES.map((mt) => (
                          <option key={mt} value={mt}>
                            {mt}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums align-middle">
                      {assignment.totalLoads > 0 ? (
                        <span className="text-[var(--text-heading)] font-semibold">
                          {assignment.totalLoads}
                        </span>
                      ) : (
                        <span className="text-[var(--text-muted)]">0</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums align-middle">
                      {assignment.totalBcm > 0 ? (
                        <span className="text-[var(--accent-blue)] font-semibold">
                          {assignment.totalBcm.toFixed(1)}
                        </span>
                      ) : (
                        <span className="text-[var(--text-muted)]">0.0</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right align-middle">
                      <div className="inline-flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => handleDuplicateRow(index)}
                          title="Duplicate for different material"
                          className="h-7 w-7 inline-flex items-center justify-center rounded-md text-[var(--text-muted)] hover:text-[var(--accent-blue)] hover:bg-[var(--bg-secondary)] transition-colors text-xs"
                        >
                          ⧉
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(index)}
                          title="Remove"
                          className="h-7 w-7 inline-flex items-center justify-center rounded-md text-[var(--text-muted)] hover:text-accent-red hover:bg-[var(--bg-secondary)] transition-colors text-xs"
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
              <tr className="border-t border-[var(--border-default)] bg-[var(--bg-secondary)]/60">
                <td
                  colSpan={5}
                  className="py-2.5 px-3 text-[var(--text-heading)] font-semibold text-xs uppercase tracking-wider align-middle"
                >
                  Total ({assignments.filter((a) => Boolean(a.dumperMachineId)).length} Assigned{' '}
                  {assignments.filter((a) => Boolean(a.dumperMachineId)).length === 1
                    ? 'Machine'
                    : 'Machines'}
                  )
                </td>
                <td className="py-2.5 px-3 text-right text-[var(--text-heading)] font-semibold font-mono tabular-nums align-middle">
                  {runningTotalLoads}
                </td>
                <td className="py-2.5 px-3 text-right text-[var(--accent-blue)] font-semibold font-mono tabular-nums align-middle">
                  {runningTotalBcm.toFixed(1)} BCM
                </td>
                <td className="py-2.5 px-3 align-middle" />
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
