"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { GlassCard } from "@repo/ui/GlassCard";
import { createBrowserSupabaseClient } from "@repo/supabase/client";
import { useRouter } from "next/navigation";
import { exportToExcel, parseExcel } from "@repo/utils/client";
import { SecondaryButton } from "@repo/ui/SecondaryButton";
import { Download, Upload } from "lucide-react";
import { logError } from "@/lib/errors/error-logger";
import { updateMachineSite } from "./actions";
import { trackClientMetric } from "@/lib/observability/client-telemetry";
import { DataGrid } from "@/components/dynamic/LazyHeavyComponents";

interface Machine {
  id: string;
  name: string;
  machine_type: string;
  bin_factor?: number | null;
  site_id?: string | null;
  sites?: { name: string }[] | { name: string } | null;
}

interface HourlyLoad {
  id: string;
  machine_id: string;
  shift_type: "day" | "night";
  hour_01: number;
  hour_02: number;
  hour_03: number;
  hour_04: number;
  hour_05: number;
  hour_06: number;
  hour_07: number;
  hour_08: number;
  hour_09: number;
  hour_10: number;
  hour_11: number;
  hour_12: number;
  total_loads: number;
  material_type?: "Waste" | "Coal";
}

interface HourlyLoadsGridProps {
  departmentId: string;
  machines: Machine[];
  hourlyLoads: HourlyLoad[];
  sites: { id: string; name: string; site_code: string }[];
}

const HOURS_12 = Array.from({ length: 12 }, (_, i) => i + 1);

const DAY_HOUR_LABELS = ["06", "07", "08", "09", "10", "11", "12", "13", "14", "15", "16", "17"];
const NIGHT_HOUR_LABELS = ["18", "19", "20", "21", "22", "23", "00", "01", "02", "03", "04", "05"];

export function HourlyLoadsGrid({
  departmentId,
  machines,
  hourlyLoads,
  sites,
}: HourlyLoadsGridProps) {
  const router = useRouter();
  const supabase = createBrowserSupabaseClient();
  const today = new Date().toISOString().split("T")[0];

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

  // Performance Pattern: Memoize derived data structures to prevent cascading re-renders
  // and use a composite key to prevent shift data overwriting.
  const loadsByMachine = useMemo(() => {
    const map = new Map<string, HourlyLoad>();
    hourlyLoads.forEach((load) => {
      map.set(`${load.machine_id}:${load.shift_type}`, load);
    });
    return map;
  }, [hourlyLoads]);

  const [selectedShift, setSelectedShift] = useState<"day" | "night">(
    new Date().getHours() >= 6 && new Date().getHours() < 18 ? "day" : "night",
  );
  const [saving, setSaving] = useState(false);

  const hourLabels = selectedShift === "day" ? DAY_HOUR_LABELS : NIGHT_HOUR_LABELS;

  const getHourValue = useCallback(
    (machineId: string, hourIndex: number): number => {
      const load = loadsByMachine.get(`${machineId}:${selectedShift}`);
      if (!load) return 0;
      const field = `hour_${(hourIndex + 1).toString().padStart(2, "0")}` as keyof HourlyLoad;
      return (load[field] as number) || 0;
    },
    [loadsByMachine, selectedShift],
  );

  const getMachineTotal = useCallback(
    (machineId: string): number => {
      const load = loadsByMachine.get(`${machineId}:${selectedShift}`);
      return load?.total_loads || 0;
    },
    [loadsByMachine, selectedShift],
  );

  const getMaterialType = useCallback(
    (machineId: string): "Waste" | "Coal" => {
      const load = loadsByMachine.get(`${machineId}:${selectedShift}`);
      return load?.material_type || "Waste";
    },
    [loadsByMachine, selectedShift],
  );

  // Check if any machine in this department has a bin_factor set
  const hasBinFactors = useMemo(
    () => machines.some((m) => m.bin_factor != null && m.bin_factor > 0),
    [machines],
  );

  // Build RevoGrid source rows (stable reference)
  const source = useMemo(() => {
    return machines.map((machine) => {
      const totalLoads = getMachineTotal(machine.id);
      const binFactor = machine.bin_factor ?? 0;
      const sites = machine.sites;
      const siteName =
        (Array.isArray(sites) ? sites[0]?.name : (sites as { name?: string } | null)?.name) ??
        "No Site";
      const row: Record<string, string | number> = {
        machineName: machine.name,
        siteName,
        machineType: machine.machine_type,
        materialType: getMaterialType(machine.id),
      };
      HOURS_12.forEach((_, index) => {
        row[`hour_${(index + 1).toString().padStart(2, "0")}`] = getHourValue(machine.id, index);
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

      setSaving(true);
      // AGENT-TRACE: Client-side telemetry for hourly loads update
      await trackClientMetric(
        "hourly_loads_update",
        async () => {
          try {
            // Performance Pattern: Replace O(N) array search with O(1) Map lookup
            const existingLoad = loadsByMachine.get(`${machine.id}:${selectedShift}`);

            if (existingLoad) {
              const { error } = await supabase
                .from("hourly_loads")
                .update({ [hourProp]: newValue })
                .eq("id", existingLoad.id);
              if (error) throw error;
            } else {
              const { error } = await supabase.from("hourly_loads").insert({
                department_id: departmentId,
                machine_id: machine.id,
                load_date: today,
                shift_type: selectedShift,
                [hourProp]: newValue,
              });
              if (error) throw error;
            }
            router.refresh();
          } catch (err) {
            logError(err instanceof Error ? err : new Error(String(err)), {
              context: "hourly_loads_adjust",
            });
            alert("Failed to update. Please try again.");
          } finally {
            setSaving(false);
          }
        },
        {
          department_id: departmentId,
          machine_id: machine.id,
          hour_prop: hourProp,
          previous_value: currentValue,
          new_value: newValue,
          operation: "increment_decrement",
        },
      );
    },
    [machines, loadsByMachine, selectedShift, departmentId, today, supabase, router, getHourValue],
  );

  // Handle toggling material type for a row
  const handleMaterialToggle = useCallback(
    async (rowIndex: number) => {
      const machine = machines[rowIndex];
      if (!machine) return;

      const currentMaterial = getMaterialType(machine.id);
      const newMaterial = currentMaterial === "Waste" ? "Coal" : "Waste";

      setSaving(true);
      try {
        // Performance Pattern: Replace O(N) array search with O(1) Map lookup
        const existingLoad = loadsByMachine.get(`${machine.id}:${selectedShift}`);

        if (existingLoad) {
          const { error } = await supabase
            .from("hourly_loads")
            .update({ material_type: newMaterial })
            .eq("id", existingLoad.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("hourly_loads").insert({
            department_id: departmentId,
            machine_id: machine.id,
            load_date: today,
            shift_type: selectedShift,
            material_type: newMaterial,
          });
          if (error) throw error;
        }
        router.refresh();
      } catch (err) {
        logError(err instanceof Error ? err : new Error(String(err)), {
          context: "hourly_loads_material_toggle",
        });
        alert("Failed to update material. Please try again.");
      } finally {
        setSaving(false);
      }
    },
    [machines, loadsByMachine, selectedShift, departmentId, today, supabase, router, getMaterialType],
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
      const newSiteId = target.value || null;

      const machine = machines[rowIndex];
      if (!machine) return;

      setSaving(true);
      try {
        await updateMachineSite(machine.id, newSiteId);
        router.refresh();
      } catch (err) {
        logError(err instanceof Error ? err : new Error(String(err)), {
          context: "hourly_loads_site_change",
        });
        alert("Failed to update site. Please try again.");
      } finally {
        setSaving(false);
      }
    },
    [machines, router],
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
          const currentMachine = machines[rowIndex];
          const currentSiteId = currentMachine?.site_id ?? "";
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
        const hourProp = `hour_${(index + 1).toString().padStart(2, "0")}`;
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
  }, [hourLabels, hasBinFactors, containerWidth]);

  const handleAfterEdit = useCallback(
    async (e: any) => {
      const detail = e?.detail ?? e;
      const prop: string = detail?.prop;
      const rowIndex: number = detail?.rowIndex ?? detail?.row?.index;
      const val = detail?.val;

      if (typeof rowIndex !== "number" || !prop?.startsWith("hour_") || val === undefined) return;

      const value = parseInt(String(val), 10) || 0;
      if (value < 0 || value > 100) {
        alert("Please enter a value between 0 and 100");
        router.refresh();
        return;
      }

      const machine = machines[rowIndex];
      if (!machine) return;

      setSaving(true);
      // AGENT-TRACE: Client-side telemetry for hourly loads direct edit
      await trackClientMetric(
        "hourly_loads_direct_edit",
        async () => {
          try {
            // Performance Pattern: Replace O(N) array search with O(1) Map lookup
            const existingLoad = loadsByMachine.get(`${machine.id}:${selectedShift}`);

            if (existingLoad) {
              const { error } = await supabase
                .from("hourly_loads")
                .update({ [prop]: value })
                .eq("id", existingLoad.id);
              if (error) throw error;
            } else {
              const { error } = await supabase.from("hourly_loads").insert({
                department_id: departmentId,
                machine_id: machine.id,
                load_date: today,
                shift_type: selectedShift,
                [prop]: value,
              });
              if (error) throw error;
            }
            router.refresh();
          } catch (err) {
            logError(err instanceof Error ? err : new Error(String(err)), {
              context: "hourly_loads_save",
            });
            alert("Failed to save. Please try again.");
          } finally {
            setSaving(false);
          }
        },
        {
          department_id: departmentId,
          machine_id: machine.id,
          hour_prop: prop,
          value,
          operation: "direct_edit",
        },
      );
    },
    [machines, loadsByMachine, selectedShift, departmentId, today, supabase, router],
  );

  const handleExport = async () => {
    const exportData = machines.map((machine) => {
      const sites = machine.sites;
      const siteName =
        (Array.isArray(sites) ? sites[0]?.name : (sites as { name?: string } | null)?.name) ??
        "No Site";
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

        const updateData: any = {
          department_id: departmentId,
          machine_id: machine.id,
          load_date: today,
          shift_type: selectedShift,
        };

        if (row.Material !== undefined) {
          updateData.material_type = row.Material === "Coal" ? "Coal" : "Waste";
        }

        let hasData = false;
        HOURS_12.forEach((_, index) => {
          const label = `${hourLabels[index]}:00`;
          if (row[label] !== undefined) {
            updateData[`hour_${(index + 1).toString().padStart(2, "0")}`] =
              parseInt(row[label], 10) || 0;
            hasData = true;
          }
        });

        if (row.Material !== undefined) {
          hasData = true;
        }

        if (hasData) {
          const { error } = await supabase.from("hourly_loads").upsert(updateData, {
            onConflict: "machine_id,load_date,shift_type",
          });

          if (error)
            logError(new Error(error.message), {
              context: "hourly_loads_import",
              machineName,
            });
        }
      }

      router.refresh();
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
