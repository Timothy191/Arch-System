"use client";

import { GlassCard } from "@repo/ui/GlassCard";

const MATERIAL_TYPES = [
  "Overburden",
  "Coal",
  "Waste",
  "Partings",
  "Soil",
  "Other",
];

interface DumperMachine {
  id: string;
  name: string;
  machine_type: string;
  bin_factor: number | null;
  site_id: string | null;
}

interface HourlyLoadSummary {
  machine_id: string;
  shift_type: string;
  total_loads: number;
}

export interface DumperAssignmentRow {
  key: string;
  dumperMachineId: string;
  materialType: string;
  totalLoads: number;
  totalBcm: number;
}

interface ExcavatorDumperTableProps {
  siteDumpers: DumperMachine[];
  shiftType: "day" | "night";
  todayDumperLoads: HourlyLoadSummary[];
  assignments: DumperAssignmentRow[];
  onAssignmentsChange: (_updated: DumperAssignmentRow[]) => void;
  errors?: Record<string, string>;
}

let rowKeyCounter = 0;
function newRowKey(): string {
  return `row-${Date.now()}-${++rowKeyCounter}`;
}

export function ExcavatorDumperTable({
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
        dumperMachineId: "",
        materialType: "Overburden",
        totalLoads: 0,
        totalBcm: 0,
      },
    ]);
  };

  const handleRemoveRow = (index: number) => {
    onAssignmentsChange(assignments.filter((_, i) => i !== index));
  };

  const handleDumperChange = (index: number, dumperId: string) => {
    const dumper = siteDumpers.find((d) => d.id === dumperId);
    const binFactor = dumper?.bin_factor || 0;

    // Look up total loads from hourly_loads for this dumper + shift
    const loadEntry = todayDumperLoads.find(
      (l) => l.machine_id === dumperId && l.shift_type === shiftType,
    );
    const loads = loadEntry?.total_loads || 0;
    const bcm = loads * binFactor;

    const updated = [...assignments];
    const existing = updated[index];
    if (!existing) return;
    updated[index] = {
      ...existing,
      dumperMachineId: dumperId,
      totalLoads: loads,
      totalBcm: bcm,
    };
    onAssignmentsChange(updated);
  };

  const handleMaterialChange = (index: number, material: string) => {
    const updated = [...assignments];
    const existing = updated[index];
    if (!existing) return;
    updated[index] = {
      ...existing,
      materialType: material,
    };
    onAssignmentsChange(updated);
  };

  const handleDuplicateRow = (index: number) => {
    const row = assignments[index];
    if (!row) return;
    const newRow: DumperAssignmentRow = {
      key: newRowKey(),
      dumperMachineId: row.dumperMachineId,
      materialType: "Coal", // Default to a different material
      totalLoads: 0,
      totalBcm: 0,
    };
    const updated = [...assignments];
    updated.splice(index + 1, 0, newRow);
    onAssignmentsChange(updated);
  };

  const runningTotalBcm = assignments.reduce((sum, a) => sum + a.totalBcm, 0);
  const runningTotalLoads = assignments.reduce(
    (sum, a) => sum + a.totalLoads,
    0,
  );

  if (siteDumpers.length === 0) {
    return (
      <GlassCard>
        <p className="text-[var(--text-muted)] text-sm text-center py-4">
          Select a site to see available dumpers.
        </p>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-[var(--text-heading)]">
          Dumper Assignments
        </h4>
        <button
          type="button"
          onClick={handleAddRow}
          className="flex items-center gap-1.5 text-[var(--accent-cyan)] hover:text-[var(--accent-cyan)]/80 text-sm font-medium transition-colors"
        >
          <span className="text-lg leading-none">+</span> Add Dumper
        </button>
      </div>

      {assignments.length === 0 ? (
        <GlassCard>
          <p className="text-[var(--text-muted)] text-sm text-center py-6">
            No dumpers assigned yet. Click &quot;+ Add Dumper&quot; to add one.
          </p>
        </GlassCard>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-default)]">
                <th
                  scope="col"
                  className="text-left text-[var(--text-muted)] py-2 px-2 font-medium w-8"
                >
                  #
                </th>
                <th
                  scope="col"
                  className="text-left text-[var(--text-muted)] py-2 px-2 font-medium"
                >
                  Dumper
                </th>
                <th
                  scope="col"
                  className="text-left text-[var(--text-muted)] py-2 px-2 font-medium"
                >
                  Material
                </th>
                <th
                  scope="col"
                  className="text-right text-[var(--text-muted)] py-2 px-2 font-medium"
                >
                  Loads
                </th>
                <th
                  scope="col"
                  className="text-right text-[var(--text-muted)] py-2 px-2 font-medium"
                >
                  BCM
                </th>
                <th
                  scope="col"
                  className="text-right text-[var(--text-muted)] py-2 px-2 font-medium w-24"
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((assignment, index) => {
                return (
                  <tr
                    key={assignment.key}
                    className="border-b border-[var(--border-default)]/50"
                  >
                    <td className="py-2 px-2 text-[var(--text-muted)]">
                      {index + 1}
                    </td>
                    <td className="py-2 px-2">
                      <select
                        value={assignment.dumperMachineId}
                        onChange={(e) =>
                          handleDumperChange(index, e.target.value)
                        }
                        className="w-full bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg px-2 py-1.5 text-[var(--text-heading)] text-sm focus:outline-none focus:border-[var(--accent-blue)] transition-colors"
                      >
                        <option value="">
                          {siteDumpers.length === 0
                            ? "No dumpers at this site"
                            : "Select dumper..."}
                        </option>
                        {siteDumpers.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name} ({d.machine_type}
                            {d.bin_factor ? ` · ${d.bin_factor} BCM/load` : ""})
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 px-2">
                      <select
                        value={assignment.materialType}
                        onChange={(e) =>
                          handleMaterialChange(index, e.target.value)
                        }
                        className="w-full bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg px-2 py-1.5 text-[var(--text-heading)] text-sm focus:outline-none focus:border-[var(--accent-blue)] transition-colors"
                      >
                        {MATERIAL_TYPES.map((mt) => (
                          <option key={mt} value={mt}>
                            {mt}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 px-2 text-right text-[var(--text-heading)]">
                      {assignment.totalLoads > 0 ? (
                        <span>{assignment.totalLoads}</span>
                      ) : (
                        <span className="text-[var(--text-muted)]">0</span>
                      )}
                    </td>
                    <td className="py-2 px-2 text-right">
                      {assignment.totalBcm > 0 ? (
                        <span className="text-[var(--accent-cyan)] font-medium">
                          {assignment.totalBcm.toFixed(1)}
                        </span>
                      ) : (
                        <span className="text-[var(--text-muted)]">0.0</span>
                      )}
                    </td>
                    <td className="py-2 px-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => handleDuplicateRow(index)}
                          title="Duplicate for different material"
                          className="p-1 text-[var(--text-muted)] hover:text-[var(--accent-cyan)] transition-colors text-xs"
                        >
                          ⧉
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(index)}
                          title="Remove"
                          className="p-1 text-[var(--text-muted)] hover:text-accent-red transition-colors text-xs"
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
              <tr className="border-t-2 border-[var(--border-default)]">
                <td
                  colSpan={3}
                  className="py-2 px-2 text-[var(--text-heading)] font-medium"
                >
                  Total
                </td>
                <td className="py-2 px-2 text-right text-[var(--text-heading)] font-medium">
                  {runningTotalLoads}
                </td>
                <td className="py-2 px-2 text-right text-[var(--accent-cyan)] font-medium">
                  {runningTotalBcm.toFixed(1)}
                </td>
                <td />
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
