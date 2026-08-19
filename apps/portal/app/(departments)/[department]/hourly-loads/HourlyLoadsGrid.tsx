"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { GlassCard } from "@repo/ui/GlassCard";
import { createBrowserSupabaseClient } from "@repo/supabase/client";
import { exportToExcel, parseExcel } from "@repo/utils/client";
import { SecondaryButton } from "@repo/ui/SecondaryButton";
import { Download, Upload } from "lucide-react";
import { logError } from "@/lib/errors/error-logger";
import { updateMachineSite } from "./actions";
import { trackClientMetric } from "@/lib/observability/client-telemetry";
import { DataGrid } from "@/components/dynamic/LazyHeavyComponents";
import {
  HOURS_12,
  HOUR_PROP,
  loadKey,
  buildHourlyLoadsMap,
  sumHourlyTotal,
  type HourlyShift,
  type HourlyLoad,
  type HourlyMaterial,
} from "./loads-utils";

interface Machine {
  id: string;
  name: string;
  machine_type: string;
  bin_factor?: number | null;
  site_id?: string | null;
}

interface HourlyLoadsGridProps {
  departmentId: string;
  machines: Machine[];
  hourlyLoads: HourlyLoad[];
  sites: { id: string; name: string; site_code: string }[];
  /** Operational date (Africa/Johannesburg) from the server — never derive on the client. */
  today: string;
  /** Shift active at first render, resolved on the server to avoid UTC drift. */
  initialShift?: HourlyShift;
}

const DAY_HOUR_LABELS = ["06", "07", "08", "09", "10", "11", "12", "13", "14", "15", "16", "17"];
const NIGHT_HOUR_LABELS = ["18", "19", "20", "21", "22", "23", "00", "01", "02", "03", "04", "05"];

export function HourlyLoadsGrid({
  departmentId,
  machines,
  hourlyLoads,
  sites,
  today,
  initialShift,
}: HourlyLoadsGridProps) {
  const supabase = createBrowserSupabaseClient();

  // AGENT-TRACE: The grid owns its load/site state so edits apply optimistically.
  // No router.refresh() anywhere — each change updates local state instantly and
  // persists in the background, so the page never reloads between values.
  const [loadsState, setLoadsState] = useState<HourlyLoad[]>(hourlyLoads);
  const [siteAssignments, setSiteAssignments] = useState<Record<string, string>>(() =>
    Object.fromEntries(machines.map((m) => [m.id, m.site_id ?? ""])),
  );
  const [selectedShift, setSelectedShift] = useState<HourlyShift>(
    initialShift ?? (new Date().getHours() >= 6 && new Date().getHours() < 18 ? "day" : "night"),
  );
  const [saving, setSaving] = useState(false);

  // Track container width for responsive column sizing
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      if (entries[0]) {
        setContainerWidth(entries[0].contentRect.width - 2);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Keyed by `${machine_id}:${shift_type}` so day and night rows for one machine
  // are separate entries (regression: was keyed by machine_id only, dropping one).
  const loadsByMachine = useMemo(() => buildHourlyLoadsMap(loadsState), [loadsState]);

  const hourLabels = selectedShift === "day" ? DAY_HOUR_LABELS : NIGHT_HOUR_LABELS;

  const getHourValue = useCallback(
    (machineId: string, hourIndex: number): number => {
      const load = loadsByMachine.get(loadKey(machineId, selectedShift));
      if (!load) return 0;
      const field = HOUR_PROP(hourIndex) as keyof HourlyLoad;
      return (load[field] as number) || 0;
    },
    [loadsByMachine, selectedShift],
  );

  const getMachineTotal = useCallback(
    (machineId: string): number => {
      const load = loadsByMachine.get(loadKey(machineId, selectedShift));
      return load?.total_loads || 0;
    },
    [loadsByMachine, selectedShift],
  );

  const getMaterialType = useCallback(
    (machineId: string): HourlyMaterial => {
      const load = loadsByMachine.get(loadKey(machineId, selectedShift));
      return load?.material_type || "Waste";
    },
    [loadsByMachine, selectedShift],
  );

  /**
   * Applies a patch to the local row for (machineId, shiftType), creating a
   * phantom row if none exists yet. Recomputes total from the 12 hours to mirror
   * the DB's generated column. Existence is checked against `prev` inside the
   * updater so rapid consecutive edits to a new row never create duplicates.
   */
  const applyLoadState = useCallback(
    (machineId: string, shiftType: HourlyShift, patch: Partial<HourlyLoad>) => {
      const key = loadKey(machineId, shiftType);
      setLoadsState((prev) => {
        const existing = prev.find((load) => loadKey(load.machine_id, load.shift_type) === key);
        if (existing) {
          return prev.map((load) => {
            if (loadKey(load.machine_id, load.shift_type) !== key) return load;
            const merged = { ...load, ...patch };
            return { ...merged, total_loads: sumHourlyTotal(merged) };
          });
        }
        const row: HourlyLoad = {
          id: `local-${machineId}-${shiftType}`,
          machine_id: machineId,
          shift_type: shiftType,
          hour_01: 0,
          hour_02: 0,
          hour_03: 0,
          hour_04: 0,
          hour_05: 0,
          hour_06: 0,
          hour_07: 0,
          hour_08: 0,
          hour_09: 0,
          hour_10: 0,
          hour_11: 0,
          hour_12: 0,
          total_loads: 0,
          material_type: "Waste",
          ...patch,
        };
        return [...prev, { ...row, total_loads: sumHourlyTotal(row) }];
      });
    },
    [],
  );

  /**
   * Persists one machine+shift row. Single idempotent upsert keyed on
   * (machine_id, load_date, shift_type) — the UNIQUE constraint on the
   * partitioned table includes the partition key (load_date), so concurrent
   * inserts for a brand-new row collapse to an update instead of throwing.
   */
  const persistLoad = useCallback(
    async (machineId: string, shiftType: HourlyShift, patch: Partial<HourlyLoad>) => {
      const { error } = await supabase.from("hourly_loads").upsert(
        {
          department_id: departmentId,
          machine_id: machineId,
          load_date: today,
          shift_type: shiftType,
          ...patch,
        },
        { onConflict: "machine_id,load_date,shift_type" },
      );
      if (error) throw error;
    },
    [supabase, departmentId, today],
  );

  /**
   * Rolls a field back to its previous value — but only if it still holds the
   * value we wrote. A newer user edit wins and is never clobbered. Phantom rows
   * that end up empty (all zeros, Waste) are dropped rather than persisted.
   */
  const revertField = useCallback(
    (
      machineId: string,
      shiftType: HourlyShift,
      field: string,
      newValue: number | string,
      previousValue: number | string,
    ) => {
      const key = loadKey(machineId, shiftType);
      setLoadsState((prev) => {
        const existing = prev.find((load) => loadKey(load.machine_id, load.shift_type) === key);
        if (!existing || existing[field as keyof HourlyLoad] !== newValue) return prev;
        const reverted = {
          ...existing,
          [field]: previousValue,
        } as HourlyLoad;
        const isEmptyPhantom =
          existing.id.startsWith("local-") &&
          sumHourlyTotal(reverted) === 0 &&
          (reverted.material_type ?? "Waste") === "Waste";
        if (isEmptyPhantom) {
          return prev.filter((load) => load !== existing);
        }
        reverted.total_loads = sumHourlyTotal(reverted);
        return prev.map((load) => (load === existing ? reverted : load));
      });
    },
    [],
  );

  /**
   * Shared optimistic write path: apply locally, persist in the background,
   * revert + alert only on failure. Used by all five edit entry points.
   */
  const commitLoadChange = useCallback(
    async (
      machineId: string,
      shiftType: HourlyShift,
      field: string,
      previousValue: number | string,
      newValue: number | string,
      patch: Partial<HourlyLoad>,
      operation: string,
      attrs: Record<string, string | number>,
    ) => {
      applyLoadState(machineId, shiftType, patch);
      try {
        await trackClientMetric(operation, () => persistLoad(machineId, shiftType, patch), {
          department_id: departmentId,
          machine_id: machineId,
          ...attrs,
        });
      } catch (err) {
        logError(err instanceof Error ? err : new Error(String(err)), {
          context: `hourly_loads_${operation}`,
        });
        revertField(machineId, shiftType, field, newValue, previousValue);
        alert("Failed to save. Please try again.");
      }
    },
    [applyLoadState, persistLoad, revertField, departmentId],
  );

  // Check if any machine in this department has a bin_factor set
  const hasBinFactors = machines.some((m) => m.bin_factor != null && m.bin_factor > 0);

  // Build RevoGrid source rows (stable reference)
  const source = useMemo(() => {
    return machines.map((machine) => {
      const totalLoads = getMachineTotal(machine.id);
      const binFactor = machine.bin_factor ?? 0;
      const assignedSiteId = siteAssignments[machine.id];
      const siteName =
        (assignedSiteId && sites.find((s) => s.id === assignedSiteId)?.name) || "No Site";
      const row: Record<string, string | number> = {
        machineName: machine.name,
        siteName,
        machineType: machine.machine_type,
        materialType: getMaterialType(machine.id),
      };
      HOURS_12.forEach((_, index) => {
        row[HOUR_PROP(index)] = getHourValue(machine.id, index);
      });
      row.total = totalLoads;
      if (hasBinFactors) {
        row.binFactor = binFactor > 0 ? binFactor : "-";
        row.totalMaterial = binFactor > 0 ? Math.round(totalLoads * binFactor * 10) / 10 : "-";
      }
      return row;
    });
  }, [
    machines,
    sites,
    siteAssignments,
    loadsByMachine,
    selectedShift,
    getHourValue,
    getMachineTotal,
    hasBinFactors,
    getMaterialType,
  ]);

  // Handle increment/decrement for a specific cell
  const handleCellChange = useCallback(
    async (rowIndex: number, hourProp: string, delta: number) => {
      const machine = machines[rowIndex];
      if (!machine) return;

      const hourIndex = parseInt(hourProp.split("_")[1] ?? "0", 10) - 1;
      const currentValue = getHourValue(machine.id, hourIndex);
      const newValue = Math.max(0, Math.min(100, currentValue + delta));
      if (newValue === currentValue) return;

      await commitLoadChange(
        machine.id,
        selectedShift,
        hourProp,
        currentValue,
        newValue,
        { [hourProp]: newValue },
        "hourly_loads_update",
        {
          hour_prop: hourProp,
          previous_value: currentValue,
          new_value: newValue,
          operation: "increment_decrement",
        },
      );
    },
    [machines, selectedShift, getHourValue, commitLoadChange],
  );

  // Handle toggling material type for a row
  const handleMaterialToggle = useCallback(
    async (rowIndex: number) => {
      const machine = machines[rowIndex];
      if (!machine) return;

      const currentMaterial = getMaterialType(machine.id);
      const newMaterial = currentMaterial === "Waste" ? "Coal" : "Waste";

      await commitLoadChange(
        machine.id,
        selectedShift,
        "material_type",
        currentMaterial,
        newMaterial,
        { material_type: newMaterial },
        "hourly_loads_material_toggle",
        {
          field: "material_type",
          previous_value: currentMaterial,
          new_value: newMaterial,
          operation: "toggle_material",
        },
      );
    },
    [machines, selectedShift, getMaterialType, commitLoadChange],
  );

  // Handle grid click for up/down buttons and material toggle
  const handleGridClick = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;

      const toggleBtn = target.closest('[data-action="toggle-material"]') as HTMLElement | null;
      if (toggleBtn) {
        const rowIndex = parseInt(toggleBtn.dataset.row || "0", 10);
        handleMaterialToggle(rowIndex);
        return;
      }

      const button = target.closest(
        '[data-action="up"], [data-action="down"]',
      ) as HTMLElement | null;
      if (!button) return;

      const rowIndex = parseInt(button.dataset.row || "0", 10);
      const hourProp = button.dataset.hour;
      const action = button.dataset.action;

      if (!hourProp || !action) return;

      const delta = action === "up" ? 1 : -1;
      handleCellChange(rowIndex, hourProp, delta);
    },
    [handleCellChange, handleMaterialToggle],
  );

  // Handle site selection dropdown change
  const handleGridChange = useCallback(
    async (e: React.FormEvent) => {
      const target = e.target as HTMLSelectElement;
      if (target.dataset.action !== "select-site") return;

      const rowIndex = parseInt(target.dataset.row || "0", 10);
      const newSiteId = target.value || "";

      const machine = machines[rowIndex];
      if (!machine) return;

      const previousSiteId = siteAssignments[machine.id] ?? "";
      if (newSiteId === previousSiteId) return;

      // AGENT-TRACE: Optimistic site reassignment — update the select immediately,
      // persist via the server action in the background, revert only on failure.
      setSiteAssignments((prev) => ({ ...prev, [machine.id]: newSiteId }));
      try {
        await updateMachineSite(machine.id, newSiteId || null);
      } catch (err) {
        logError(err instanceof Error ? err : new Error(String(err)), {
          context: "hourly_loads_site_change",
        });
        setSiteAssignments((prev) =>
          prev[machine.id] === newSiteId ? { ...prev, [machine.id]: previousSiteId } : prev,
        );
        alert("Failed to update site. Please try again.");
      }
    },
    [machines, siteAssignments],
  );

  // Build RevoGrid columns (stable reference)
  const columns = useMemo(() => {
    const width = containerWidth || 1150;

    // Proportional widths that sum to 100%
    let machineColSize = 140;
    let siteColSize = 100;
    let materialColSize = 100;
    let hourColSize = 56;
    let totalColSize = 70;
    let binFactorColSize = 80;
    let totalMaterialColSize = 100;

    if (hasBinFactors) {
      // 18 columns total:
      // Machine (10%), Site (8%), Material (8%), 12 Hours (12 * 4.5% = 54%), Total (6%), Bin Factor (6%), Total Material (8%)
      machineColSize = Math.max(140, Math.floor(width * 0.1));
      siteColSize = Math.max(100, Math.floor(width * 0.08));
      materialColSize = Math.max(100, Math.floor(width * 0.08));
      hourColSize = Math.max(80, Math.floor(width * 0.045));
      totalColSize = Math.max(80, Math.floor(width * 0.06));
      binFactorColSize = Math.max(80, Math.floor(width * 0.06));
      totalMaterialColSize = Math.max(100, Math.floor(width * 0.08));
    } else {
      // 16 columns total:
      // Machine (12%), Site (10%), Material (8%), 12 Hours (12 * 5.5% = 66%), Total (4%)
      machineColSize = Math.max(140, Math.floor(width * 0.12));
      siteColSize = Math.max(100, Math.floor(width * 0.1));
      materialColSize = Math.max(100, Math.floor(width * 0.08));
      hourColSize = Math.max(80, Math.floor(width * 0.055));
      totalColSize = Math.max(80, Math.floor(width * 0.04));
    }

    const cols = [
      {
        prop: "machineName",
        name: "Machine",
        size: machineColSize,
        pin: "colPinStart" as const,
      },
      {
        prop: "siteName",
        name: "Site",
        size: siteColSize,
        pin: "colPinStart" as const,
        sortable: false,
        readonly: true,
        cellTemplate: (h: any, { rowIndex }: { rowIndex: number }) => {
          const machineId = machines[rowIndex]?.id ?? "";
          const currentSiteId = siteAssignments[machineId] ?? "";
          return h("div", { class: "flex items-center justify-center h-full w-full px-1" }, [
            h(
              "select",
              {
                class:
                  "w-full bg-transparent border-0 text-xs font-semibold text-arch-text-secondary focus:ring-0 focus:outline-none cursor-pointer py-1 px-1 rounded hover:bg-[var(--overlay-subtle)] transition-all",
                "data-row": String(rowIndex),
                "data-action": "select-site",
              },
              [
                h(
                  "option",
                  {
                    value: "",
                    selected: !currentSiteId ? "selected" : undefined,
                  },
                  "No Site",
                ),
                ...sites.map((s) =>
                  h(
                    "option",
                    {
                      value: s.id,
                      selected: s.id === currentSiteId ? "selected" : undefined,
                    },
                    s.name,
                  ),
                ),
              ],
            ),
          ]);
        },
      },
      {
        prop: "materialType",
        name: "Material",
        size: materialColSize,
        pin: "colPinStart" as const,
        sortable: false,
        readonly: true,
        cellTemplate: (h: any, { rowIndex, model }: { rowIndex: number; model: any }) => {
          const value = model?.materialType ?? "Waste";
          const isCoal = value === "Coal";
          return h("div", { class: "flex items-center justify-center h-full w-full px-1" }, [
            h(
              "button",
              {
                class: `px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wider transition-all duration-150 cursor-pointer ${
                  isCoal
                    ? "bg-arch-text-primary text-white border-arch-text-primary hover:bg-arch-text-secondary"
                    : "bg-arch-surface-primary text-arch-text-tertiary border-arch-border-subtle hover:bg-arch-surface-tertiary"
                }`,
                "data-row": String(rowIndex),
                "data-action": "toggle-material",
                title: "Click to toggle between Waste and Coal",
              },
              value,
            ),
          ]);
        },
      },
      ...HOURS_12.map((_, index) => {
        const hourProp = HOUR_PROP(index);
        return {
          prop: hourProp,
          name: `${hourLabels[index]}:00`,
          size: hourColSize,
          sortable: false,
          cellTemplate: (h: any, { rowIndex, model }: { rowIndex: number; model: any }) => {
            const value = model?.[hourProp] ?? 0;
            const isMax = value >= 100;
            const isMin = value <= 0;
            return h("div", { class: "flex items-center justify-between px-1 gap-1 h-full" }, [
              h("span", { class: "text-sm font-medium font-mono tabular-nums px-1" }, value),
              h("div", { class: "flex flex-col" }, [
                h(
                  "button",
                  {
                    class:
                      "hour-btn-up p-0 leading-none hover:text-[var(--accent-blue)] text-[var(--text-muted)] transition-colors",
                    "data-row": String(rowIndex),
                    "data-hour": hourProp,
                    "data-action": "up",
                    disabled: isMax,
                    style: isMax ? { opacity: "0.3", cursor: "not-allowed" } : undefined,
                  },
                  h(
                    "svg",
                    {
                      xmlns: "http://www.w3.org/2000/svg",
                      width: "10",
                      height: "10",
                      viewBox: "0 0 24 24",
                      fill: "none",
                      stroke: "currentColor",
                      "stroke-width": "3",
                      "stroke-linecap": "round",
                      "stroke-linejoin": "round",
                    },
                    h("path", { d: "m18 15-6-6-6 6" }),
                  ),
                ),
                h(
                  "button",
                  {
                    class:
                      "hour-btn-down p-0 leading-none hover:text-[var(--accent-blue)] text-[var(--text-muted)] transition-colors",
                    "data-row": String(rowIndex),
                    "data-hour": hourProp,
                    "data-action": "down",
                    disabled: isMin,
                    style: isMin ? { opacity: "0.3", cursor: "not-allowed" } : undefined,
                  },
                  h(
                    "svg",
                    {
                      xmlns: "http://www.w3.org/2000/svg",
                      width: "10",
                      height: "10",
                      viewBox: "0 0 24 24",
                      fill: "none",
                      stroke: "currentColor",
                      "stroke-width": "3",
                      "stroke-linecap": "round",
                      "stroke-linejoin": "round",
                    },
                    h("path", { d: "m6 9 6 6 6-6" }),
                  ),
                ),
              ]),
            ]);
          },
        };
      }),
      {
        prop: "total",
        name: "Total",
        size: totalColSize,
        readonly: true,
        cellTemplate: (h: any, { model }: { model: any }) => {
          return h(
            "div",
            {
              class: "flex items-center h-full w-full px-2 text-sm font-mono tabular-nums",
            },
            model?.total ?? 0,
          );
        },
      },
    ];

    // Add Bin Factor column for dumpers
    if (hasBinFactors) {
      cols.push({
        prop: "binFactor",
        name: "Bin Factor",
        size: binFactorColSize,
        readonly: true,
        cellTemplate: (h: any, { model }: { model: any }) => {
          return h(
            "div",
            {
              class: "flex items-center h-full w-full px-2 text-sm font-mono tabular-nums",
            },
            model?.binFactor ?? "-",
          );
        },
      });
      cols.push({
        prop: "totalMaterial",
        name: "Total Material (t)",
        size: totalMaterialColSize,
        readonly: true,
        cellTemplate: (h: any, { model }: { model: any }) => {
          return h(
            "div",
            {
              class: "flex items-center h-full w-full px-2 text-sm font-mono tabular-nums",
            },
            model?.totalMaterial ?? "-",
          );
        },
      });
    }

    return cols;
  }, [hourLabels, hasBinFactors, containerWidth, sites, siteAssignments, machines]);

  const handleAfterEdit = useCallback(
    async (e: any) => {
      const detail = e?.detail ?? e;
      const prop: string = detail?.prop;
      const rowIndex: number = detail?.rowIndex ?? detail?.row?.index;
      const val = detail?.val;

      if (typeof rowIndex !== "number" || !prop?.startsWith("hour_") || val === undefined) return;

      const machine = machines[rowIndex];
      if (!machine) return;

      const hourIndex = parseInt(prop.split("_")[1] ?? "0", 10) - 1;
      const currentValue = getHourValue(machine.id, hourIndex);
      const value = parseInt(String(val), 10) || 0;

      if (value < 0 || value > 100) {
        alert("Please enter a value between 0 and 100");
        // AGENT-TRACE: Push the current value back into local state so RevoGrid
        // drops the invalid cell (new source reference) instead of a page reload.
        applyLoadState(machine.id, selectedShift, { [prop]: currentValue });
        return;
      }

      if (value === currentValue) return;

      await commitLoadChange(
        machine.id,
        selectedShift,
        prop,
        currentValue,
        value,
        { [prop]: value },
        "hourly_loads_direct_edit",
        { hour_prop: prop, value, operation: "direct_edit" },
      );
    },
    [machines, selectedShift, getHourValue, applyLoadState, commitLoadChange],
  );

  const handleExport = async () => {
    const exportData = machines.map((machine) => {
      const assignedSiteId = siteAssignments[machine.id];
      const siteName =
        (assignedSiteId && sites.find((s) => s.id === assignedSiteId)?.name) || "No Site";
      const data: any = {
        Machine: machine.name,
        Site: siteName,
        Type: machine.machine_type,
        Material: getMaterialType(machine.id),
      };
      HOURS_12.forEach((_, index) => {
        const label = `${hourLabels[index]}:00`;
        data[label] = getHourValue(machine.id, index);
      });
      data.Total = getMachineTotal(machine.id);
      return data;
    });

    await exportToExcel(exportData, `hourly-loads-${selectedShift}-${today}`, "Hourly Loads");
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSaving(true);
    try {
      const data = await parseExcel(file);

      for (const row of data) {
        const machineName = row.Machine;
        const machine = machines.find((m) => m.name === machineName);
        if (!machine) continue;

        const patch: Partial<HourlyLoad> = {};

        if (row.Material !== undefined) {
          patch.material_type = row.Material === "Coal" ? "Coal" : "Waste";
        }

        let hasData = false;
        HOURS_12.forEach((_, index) => {
          const label = `${hourLabels[index]}:00`;
          if (row[label] !== undefined) {
            (patch as Record<string, number | string | undefined>)[HOUR_PROP(index)] =
              parseInt(row[label], 10) || 0;
            hasData = true;
          }
        });

        if (row.Material !== undefined) {
          hasData = true;
        }

        if (!hasData) continue;

        // AGENT-TRACE: Optimistic import — apply each row to local state right
        // away and persist in the background; no full-page refresh mid-import.
        applyLoadState(machine.id, selectedShift, patch);
        try {
          await trackClientMetric(
            "hourly_loads_import",
            () => persistLoad(machine.id, selectedShift, patch),
            {
              department_id: departmentId,
              machine_id: machine.id,
              machine_name: machineName,
              operation: "import",
            },
          );
        } catch (err) {
          logError(err instanceof Error ? err : new Error(String(err)), {
            context: "hourly_loads_import",
            machineName,
          });
        }
      }

      alert("Import completed successfully!");
    } catch (err) {
      logError(err instanceof Error ? err : new Error(String(err)), {
        context: "hourly_loads_import_failed",
      });
      alert("Failed to parse Excel file. Please ensure it follows the exported template.");
    } finally {
      setSaving(false);
      if (e.target) e.target.value = "";
    }
  };

  if (machines.length === 0) {
    return (
      <GlassCard>
        <p className="text-[var(--text-muted)] text-sm text-center py-8">
          No machines available. Add machines in the Machine DB tab first.
        </p>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-4">
      {/* Shift Selector & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="text-[var(--text-muted)] text-sm">Shift:</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSelectedShift("day")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedShift === "day"
                  ? "bg-arch-accent-blue text-arch-surface-secondary"
                  : "bg-arch-surface-secondary border border-arch-border-primary text-arch-text-tertiary hover:text-arch-text-primary"
              }`}
            >
              Day (06:00 - 17:59)
            </button>
            <button
              type="button"
              onClick={() => setSelectedShift("night")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedShift === "night"
                  ? "bg-arch-accent-blue text-arch-surface-secondary"
                  : "bg-arch-surface-secondary border border-arch-border-primary text-arch-text-tertiary hover:text-arch-text-primary"
              }`}
            >
              Night (18:00 - 05:59)
            </button>
          </div>
        </div>

        <div className="flex gap-2">
          <input
            type="file"
            id="excel-import"
            accept=".xlsx, .xls"
            className="hidden"
            onChange={handleImport}
            aria-label="Import Excel file with hourly load data"
          />
          <SecondaryButton
            size="sm"
            variant="rounded-lg"
            onClick={() => document.getElementById("excel-import")?.click()}
            disabled={saving}
          >
            <Upload className="w-4 h-4 mr-2" />
            Import
          </SecondaryButton>
          <SecondaryButton size="sm" variant="rounded-lg" onClick={handleExport} disabled={saving}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </SecondaryButton>
        </div>
      </div>

      <div
        ref={containerRef}
        onClick={handleGridClick}
        onChange={handleGridChange}
        className="revo-grid-visible"
      >
        <DataGrid
          key={`grid-${containerWidth}-${columns.length}`}
          columns={columns}
          source={source}
          height="500px"
          resize={false}
          filter={false}
          sorting={false}
          onAfterEdit={handleAfterEdit}
          stretch="all"
        />
      </div>
    </div>
  );
}
