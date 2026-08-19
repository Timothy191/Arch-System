"use client";

import { useState, useMemo } from "react";
import { GlassCard } from "@repo/ui/GlassCard";
import {
  CircleDot,
  Wrench,
  AlertTriangle,
  ClipboardList,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  ShieldAlert,
  RefreshCw,
  TrendingDown,
  Layers,
  Download,
} from "lucide-react";
import type { TireWithInspections, TireMetrics, WearCurvePoint } from "./types";
import { TireInspectionModal } from "./TireInspectionModal";
import { TireReplacementModal } from "./TireReplacementModal";
import { TireWearCurveChart } from "./TireWearCurveChart";

interface TireManagementDashboardProps {
  tires: TireWithInspections[];
  machines: { id: string; name: string; serial_number?: string; machine_type: string }[];
}

export function TireManagementDashboard({
  tires: initialTires,
  machines,
}: TireManagementDashboardProps) {
  const [tires, setTires] = useState<TireWithInspections[]>(initialTires);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("installed");
  const [conditionFilter, setConditionFilter] = useState<string>("all");
  const [selectedTireForInspection, setSelectedTireForInspection] =
    useState<TireWithInspections | null>(null);
  const [selectedTireForReplacement, setSelectedTireForReplacement] =
    useState<TireWithInspections | null>(null);
  const [selectedCurveTireId, setSelectedCurveTireId] = useState<string>("aggregate");
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Metrics calculation
  const metrics: TireMetrics = useMemo(() => {
    const active = tires.filter((t) => t.status === "installed");
    if (active.length === 0) {
      return {
        totalActive: 0,
        avgTreadDepth: 0,
        warningCount: 0,
        criticalCount: 0,
        avgPressure: 0,
      };
    }

    let totalTread = 0;
    let totalPressure = 0;
    let warningCount = 0;
    let criticalCount = 0;
    let inspectedCount = 0;

    for (const t of active) {
      const latest = t.latest_inspection;
      if (latest) {
        inspectedCount++;
        totalTread += latest.tread_depth_mm;
        totalPressure += latest.pressure_psi;
        if (latest.condition_status === "critical" || latest.tread_depth_mm <= 15) {
          criticalCount++;
        } else if (latest.condition_status === "warning" || latest.tread_depth_mm <= 25) {
          warningCount++;
        }
      }
    }

    return {
      totalActive: active.length,
      avgTreadDepth: inspectedCount > 0 ? Math.round((totalTread / inspectedCount) * 10) / 10 : 0,
      warningCount,
      criticalCount,
      avgPressure: inspectedCount > 0 ? Math.round((totalPressure / inspectedCount) * 10) / 10 : 0,
    };
  }, [tires]);

  // Filtered tires list
  const filteredTires = useMemo(() => {
    return tires.filter((t) => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      const condition = t.latest_inspection?.condition_status || "good";
      if (conditionFilter !== "all" && condition !== conditionFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const serialMatch = t.serial_number.toLowerCase().includes(q);
        const brandMatch = t.brand.toLowerCase().includes(q);
        const posMatch = t.position.toLowerCase().includes(q);
        const machMatch = t.machine_name?.toLowerCase().includes(q);
        if (!serialMatch && !brandMatch && !posMatch && !machMatch) return false;
      }
      return true;
    });
  }, [tires, statusFilter, conditionFilter, searchQuery]);

  // Wear curve data derivation
  const wearCurveData: { data: WearCurvePoint[]; serial: string; brand: string; tread: number } =
    useMemo(() => {
      if (selectedCurveTireId !== "aggregate") {
        const target = tires.find((t) => t.id === selectedCurveTireId);
        if (target && target.inspections && target.inspections.length > 0) {
          const points: WearCurvePoint[] = target.inspections.map((insp) => ({
            date: insp.inspection_date,
            hours: target.installed_hours,
            treadDepth: insp.tread_depth_mm,
            warningThreshold: 25,
            criticalThreshold: 15,
          }));
          return {
            data: points,
            serial: target.serial_number,
            brand: target.brand,
            tread: target.latest_inspection?.tread_depth_mm || 0,
          };
        }
      }

      // Aggregate baseline across all inspections
      const dateMap = new Map<string, { total: number; count: number; hours: number }>();
      for (const t of tires) {
        if (t.inspections) {
          for (const insp of t.inspections) {
            const existing = dateMap.get(insp.inspection_date) || { total: 0, count: 0, hours: 0 };
            existing.total += insp.tread_depth_mm;
            existing.count += 1;
            existing.hours = Math.max(existing.hours, t.installed_hours);
            dateMap.set(insp.inspection_date, existing);
          }
        }
      }

      const sortedDates = Array.from(dateMap.keys()).sort();
      const points: WearCurvePoint[] = sortedDates.map((date) => {
        const item = dateMap.get(date)!;
        return {
          date,
          hours: item.hours,
          treadDepth: Math.round((item.total / item.count) * 10) / 10,
          warningThreshold: 25,
          criticalThreshold: 15,
        };
      });

      return {
        data: points,
        serial: "Fleet Aggregate Wear Profile",
        brand: "Heavy Vehicle Fleet",
        tread: metrics.avgTreadDepth,
      };
    }, [tires, selectedCurveTireId, metrics.avgTreadDepth]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-[var(--text-heading)]">Tire Management Hub</h2>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            Ultrasonic tread depth degradation, pressure telemetry &amp; life-cycle replacement
            tracking.
          </p>
        </div>

        <div className="flex items-center gap-2 relative">
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] hover:bg-[var(--bg-tertiary)]/80 text-[var(--text-heading)] border border-[var(--border-default)] text-xs font-medium transition-all"
            >
              <Download className="w-3.5 h-3.5 text-[var(--accent-blue)]" />
              <span>Export Audit Log</span>
            </button>

            {showExportMenu && (
              <div className="absolute right-0 mt-1 w-56 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-emphasis)] shadow-2xl p-1.5 z-30 space-y-1">
                <a
                  href="/api/export/tires?type=all&format=csv"
                  download
                  onClick={() => setShowExportMenu(false)}
                  className="flex flex-col px-3 py-2 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors text-left"
                >
                  <span className="text-xs font-semibold text-[var(--text-heading)]">
                    Full Fleet Audit Log
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)]">
                    All tires, specs &amp; current wear (CSV)
                  </span>
                </a>

                <a
                  href="/api/export/tires?type=inspections&format=csv"
                  download
                  onClick={() => setShowExportMenu(false)}
                  className="flex flex-col px-3 py-2 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors text-left"
                >
                  <span className="text-xs font-semibold text-[var(--text-heading)]">
                    Inspection History Log
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)]">
                    All ultrasonic readings &amp; notes (CSV)
                  </span>
                </a>

                <a
                  href="/api/export/tires?type=scrap&format=csv"
                  download
                  onClick={() => setShowExportMenu(false)}
                  className="flex flex-col px-3 py-2 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors text-left"
                >
                  <span className="text-xs font-semibold text-[var(--text-heading)]">
                    Decommission &amp; Scrap Log
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)]">
                    Retired tires &amp; failure reasons (CSV)
                  </span>
                </a>

                <div className="border-t border-[var(--border-default)] my-1" />

                <a
                  href="/api/export/tires?type=all&format=json"
                  download
                  onClick={() => setShowExportMenu(false)}
                  className="flex flex-col px-3 py-2 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors text-left"
                >
                  <span className="text-xs font-semibold text-[var(--text-heading)]">
                    JSON Regulatory Bundle
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)]">
                    Machine-readable full dataset
                  </span>
                </a>
              </div>
            )}
          </div>

          {tires.length > 0 && (
            <button
              onClick={() => setSelectedTireForInspection(tires[0] ?? null)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[var(--accent-blue)] hover:bg-[var(--accent-blue)]/90 text-white text-xs font-medium transition-all shadow-card"
            >
              <Plus className="w-4 h-4" />
              <span>Log Inspection</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <GlassCard>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-accent-green/10 text-accent-green">
                <CircleDot className="w-4 h-4" />
              </div>
              <p className="text-[var(--text-muted)] text-xs font-medium uppercase tracking-wider">
                Active Fleet Tires
              </p>
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full bg-accent-green/15 text-accent-green font-semibold">
              Online
            </span>
          </div>
          <p className="text-2xl font-bold text-[var(--text-heading)] mt-3">
            {metrics.totalActive}{" "}
            <span className="text-xs font-normal text-[var(--text-muted)]">units mounted</span>
          </p>
        </GlassCard>

        <GlassCard>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-[var(--accent-blue)]/10 text-[var(--accent-blue)]">
                <TrendingDown className="w-4 h-4" />
              </div>
              <p className="text-[var(--text-muted)] text-xs font-medium uppercase tracking-wider">
                Avg Tread Depth
              </p>
            </div>
            <span className="text-xs text-[var(--text-muted)]">Spec: 80-110mm</span>
          </div>
          <p className="text-2xl font-bold text-[var(--text-heading)] mt-3">
            {metrics.avgTreadDepth > 0 ? `${metrics.avgTreadDepth} mm` : "—"}
          </p>
        </GlassCard>

        <GlassCard>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <p className="text-[var(--text-muted)] text-xs font-medium uppercase tracking-wider">
                Warning Wear
              </p>
            </div>
            <span className="text-xs font-semibold text-amber-500">&le; 25mm</span>
          </div>
          <p className="text-2xl font-bold text-amber-500 mt-3">
            {metrics.warningCount}{" "}
            <span className="text-xs font-normal text-[var(--text-muted)]">tires</span>
          </p>
        </GlassCard>

        <GlassCard>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-accent-red/10 text-accent-red">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <p className="text-[var(--text-muted)] text-xs font-medium uppercase tracking-wider">
                Critical &amp; Scrap
              </p>
            </div>
            <span className="text-xs font-semibold text-accent-red">&le; 15mm</span>
          </div>
          <p className="text-2xl font-bold text-accent-red mt-3">
            {metrics.criticalCount}{" "}
            <span className="text-xs font-normal text-[var(--text-muted)]">urgent actions</span>
          </p>
        </GlassCard>
      </div>

      {/* Degradation Curve Selector & Chart */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[var(--accent-blue)]" />
            <h3 className="text-sm font-semibold text-[var(--text-heading)]">
              Wear Degradation Telemetry
            </h3>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <label className="text-[var(--text-muted)]">Profile:</label>
            <select
              value={selectedCurveTireId}
              onChange={(e) => setSelectedCurveTireId(e.target.value)}
              className="px-2.5 py-1 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-default)] text-[var(--text-heading)] text-xs focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)]"
            >
              <option value="aggregate">Fleet Aggregate Average</option>
              {tires.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.serial_number} ({t.position} - {t.machine_name || "HME"})
                </option>
              ))}
            </select>
          </div>
        </div>

        <TireWearCurveChart
          data={wearCurveData.data}
          serialNumber={wearCurveData.serial}
          brand={wearCurveData.brand}
          currentTread={wearCurveData.tread}
        />
      </div>

      {/* Filter and Search Bar */}
      <GlassCard className="p-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Search serial number, brand, wheel position, or machine..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-default)] text-[var(--text-heading)] placeholder:text-[var(--text-muted)]/60 focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)]"
            />
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
              <Filter className="w-3.5 h-3.5" />
              <span>Status:</span>
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-default)] text-[var(--text-heading)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)]"
            >
              <option value="all">All Statuses</option>
              <option value="installed">Mounted / Installed</option>
              <option value="inventory">Spares Inventory</option>
              <option value="scrapped">Scrapped / Decommissioned</option>
            </select>

            <select
              value={conditionFilter}
              onChange={(e) => setConditionFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-default)] text-[var(--text-heading)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)]"
            >
              <option value="all">All Conditions</option>
              <option value="good">Good Condition</option>
              <option value="warning">Warning (&le;25mm)</option>
              <option value="critical">Critical (&le;15mm)</option>
            </select>
          </div>
        </div>

        {/* Fleet Tires Table */}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[var(--border-default)] text-[var(--text-muted)] font-medium">
                <th className="py-2.5 px-3">Serial / Spec</th>
                <th className="py-2.5 px-3">Machine &amp; Position</th>
                <th className="py-2.5 px-3">Tread Depth</th>
                <th className="py-2.5 px-3">Pressure</th>
                <th className="py-2.5 px-3">Condition</th>
                <th className="py-2.5 px-3">Hours / Date</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-default)]/40">
              {filteredTires.length > 0 ? (
                filteredTires.map((tire) => {
                  const latest = tire.latest_inspection;
                  const tread = latest?.tread_depth_mm ?? 50;
                  const pressure = latest?.pressure_psi ?? 100;
                  const condition = latest?.condition_status ?? "good";
                  const isCrit = condition === "critical" || tread <= 15;
                  const isWarn = condition === "warning" || (tread <= 25 && !isCrit);

                  return (
                    <tr
                      key={tire.id}
                      className="hover:bg-[var(--bg-tertiary)]/50 transition-colors group"
                    >
                      <td className="py-3 px-3">
                        <div className="font-mono font-bold text-[var(--text-heading)]">
                          {tire.serial_number}
                        </div>
                        <div className="text-[11px] text-[var(--text-muted)]">
                          {tire.brand} • {tire.size}
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <div className="font-medium text-[var(--text-heading)]">
                          {tire.machine_name || "Unassigned"}
                        </div>
                        <div className="text-[11px] text-[var(--text-muted)]">{tire.position}</div>
                      </td>

                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-[var(--bg-tertiary)] h-2 rounded-full overflow-hidden border border-[var(--border-default)]">
                            <div
                              className={`h-full rounded-full ${
                                isCrit
                                  ? "bg-accent-red"
                                  : isWarn
                                    ? "bg-amber-500"
                                    : "bg-accent-green"
                              }`}
                              style={{ width: `${Math.min(100, (tread / 100) * 100)}%` }}
                            />
                          </div>
                          <span
                            className={`font-semibold ${
                              isCrit
                                ? "text-accent-red"
                                : isWarn
                                  ? "text-amber-500"
                                  : "text-[var(--text-heading)]"
                            }`}
                          >
                            {tread} mm
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <span className="font-mono text-[var(--text-heading)]">{pressure} PSI</span>
                      </td>

                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                            isCrit
                              ? "bg-accent-red/15 text-accent-red border border-accent-red/30"
                              : isWarn
                                ? "bg-amber-500/15 text-amber-500 border border-amber-500/30"
                                : "bg-accent-green/15 text-accent-green border border-accent-green/30"
                          }`}
                        >
                          {condition}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-[11px] text-[var(--text-muted)]">
                        <div>{tire.installed_hours} hrs</div>
                        <div>{tire.installed_at}</div>
                      </td>

                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedTireForInspection(tire)}
                            title="Log Inspection"
                            className="px-2.5 py-1 rounded-md bg-[var(--bg-tertiary)] hover:bg-[var(--accent-blue)] hover:text-white text-[var(--text-heading)] text-xs font-medium border border-[var(--border-default)] transition-all"
                          >
                            Inspect
                          </button>
                          <button
                            onClick={() => setSelectedTireForReplacement(tire)}
                            title="Replace / Decommission"
                            className="p-1 rounded-md bg-accent-red/10 text-accent-red hover:bg-accent-red hover:text-white border border-accent-red/20 transition-all"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[var(--text-muted)]">
                    No tires found matching current criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* Modals */}
      <TireInspectionModal
        isOpen={Boolean(selectedTireForInspection)}
        tire={selectedTireForInspection}
        onClose={() => setSelectedTireForInspection(null)}
        onSuccess={() => {
          // Re-trigger router refresh or reload
        }}
      />

      <TireReplacementModal
        isOpen={Boolean(selectedTireForReplacement)}
        tire={selectedTireForReplacement}
        onClose={() => setSelectedTireForReplacement(null)}
        onSuccess={() => {
          // Re-trigger router refresh or reload
        }}
      />
    </div>
  );
}
