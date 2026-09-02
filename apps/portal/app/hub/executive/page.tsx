import { createServerSupabaseClient, getUserSafely } from "@repo/supabase/server";
import { createReadReplicaClient } from "@repo/supabase/read-replica";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { KPICard, KPIGrid } from "@repo/ui/KPI";
import { GlassCard } from "@repo/ui/GlassCard";
import type { KPIColor } from "@repo/ui/KPI";
import {
  TrendingUp,
  BarChart3,
  ShieldAlert,
  Truck,
  Activity,
  AlertCircle,
  Scale,
} from "lucide-react";
import { ExportButton } from "@/features/analytics/components/ExportButton";
import { PDFDownloadButton } from "@/features/analytics/components/PDFDownloadButton";
import { ProductionTrendChart } from "@/features/analytics/components/ProductionTrendChartWrapper";
import { classifyReconciliationDrift, RECONCILIATION_UI } from "@/lib/production-reconciliation";
import { cachedRSC } from "@/lib/server-cache";
import { withCache } from "@/lib/cache-utils";
import { CacheCategory } from "@repo/redis";

export const dynamic = "force-dynamic";

// AGENT-TRACE: Typed interface for the get_production_summary RPC response.
// Replaces the previous `any` annotations throughout this page.
interface ProductionSummaryRow {
  log_date: string;
  actual_coal_tonnes: number | string;
  actual_waste_tonnes: number | string;
  total_fuel_litres: number | string;
  total_hours_worked: number | string;
  reconciliation_drift_pct: number | string;
}

interface ChartDataRow {
  date: string;
  coal: number;
  waste: number;
  drift: number;
}

// AGENT-TRACE: Static Tailwind class mapping for drift alert colors.
// Dynamic class construction (bg-${color}/10) is not detectable by Tailwind's
// purge — this ensures all classes are statically present in the build.
const DRIFT_ALERT_STYLES: Record<string, { container: string; icon: string }> = {
  emerald: {
    container: "bg-accent-green/10 border-accent-green/30",
    icon: "text-accent-green",
  },
  amber: {
    container: "bg-accent-amber/10 border-accent-amber/30",
    icon: "text-accent-amber",
  },
  orange: {
    container: "bg-accent-amber/10 border-accent-amber/30",
    icon: "text-accent-amber",
  },
  red: {
    container: "bg-accent-red/10 border-accent-red/30",
    icon: "text-accent-red",
  },
};

// Map reconciliation color names to KPIColor values accepted by <KPICard>.
const RECON_COLOR_TO_KPI: Record<string, KPIColor> = {
  emerald: "green",
  amber: "alert",
  orange: "alert",
  red: "red",
};

function toNumber(v: number | string): number {
  return Number(v) || 0;
}

async function getExecutiveData(cookieList: Array<{ name: string; value: string }>) {
  return cachedRSC(
    ["hub", "executive", new Date().toISOString().split("T")[0]!],
    async () => {
      return withCache(
        async () => {
          const db = await createReadReplicaClient(cookieList);
          const today = new Date().toISOString().split("T")[0]!;
          const monthStart = today.slice(0, 7) + "-01";
          const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0]!;

          // Step 1: Fetch Unified Production Summary (RPC)
          const { data: summaryData } = await db.rpc("get_production_summary", {
            p_start_date: thirtyDaysAgo,
            p_end_date: today,
          });

          const typedSummary = (summaryData ?? []) as unknown as ProductionSummaryRow[];
          const mtdSummary = typedSummary.filter((s) => s.log_date >= monthStart);

          // Step 2: parallel fetch of remaining KPI data
          const [
            { count: activeMachines },
            { count: totalMachines },
            { count: activeEmployees },
            { data: breakdownsMtd },
          ] = await Promise.all([
            db
              .from("machines")
              .select("id", { count: "exact", head: true })
              .eq("active", true)
              .is("deleted_at", null),
            db.from("machines").select("id", { count: "exact", head: true }).is("deleted_at", null),
            db
              .from("employees")
              .select("id", { count: "exact", head: true })
              .is("deleted_at", null),
            db
              .from("breakdowns")
              .select("id, status")
              .gte("date_in", monthStart)
              .is("deleted_at", null),
          ]);

          // Compute MTD aggregates
          const totalCoalMtd = mtdSummary.reduce((s, r) => s + toNumber(r.actual_coal_tonnes), 0);
          const totalWasteMtd = mtdSummary.reduce((s, r) => s + toNumber(r.actual_waste_tonnes), 0);
          const totalTonnageMtd = totalCoalMtd + totalWasteMtd;
          const totalFuelMtd = mtdSummary.reduce((s, r) => s + toNumber(r.total_fuel_litres), 0);
          const totalHoursMtd = mtdSummary.reduce((s, r) => s + toNumber(r.total_hours_worked), 0);

          const avgDriftPct =
            mtdSummary.length > 0
              ? mtdSummary.reduce((s, r) => s + Math.abs(toNumber(r.reconciliation_drift_pct)), 0) /
                mtdSummary.length
              : 0;

          const driftLevel = classifyReconciliationDrift(avgDriftPct);
          const driftUi = RECONCILIATION_UI[driftLevel];

          const fleetPct =
            totalMachines && totalMachines > 0
              ? Math.round(((activeMachines ?? 0) / totalMachines) * 100)
              : 0;
          const fuelPerTonne =
            totalTonnageMtd > 0 ? (totalFuelMtd / totalTonnageMtd).toFixed(2) : "—";
          const openBreakdowns = breakdownsMtd?.filter((b) => b.status === "active").length ?? 0;

          // Build 30-day chart data from summary
          const chartData: ChartDataRow[] = typedSummary.map((s) => ({
            date: s.log_date,
            coal: toNumber(s.actual_coal_tonnes),
            waste: toNumber(s.actual_waste_tonnes),
            drift: toNumber(s.reconciliation_drift_pct),
          }));

          return {
            today,
            totalCoalMtd,
            totalWasteMtd,
            totalTonnageMtd,
            totalFuelMtd,
            totalHoursMtd,
            avgDriftPct,
            driftLevel,
            driftUi,
            fleetPct,
            fuelPerTonne,
            openBreakdowns,
            activeMachines: activeMachines ?? 0,
            totalMachines: totalMachines ?? 0,
            openIncidents: 0,
            activeEmployees: activeEmployees ?? 0,
            chartData,
          };
        },
        {
          category: CacheCategory.METRICS,
          keyParts: ["hub", "executive"],
          tags: ["table:machines", "table:employees", "table:breakdowns"],
        },
      );
    },
    {
      revalidate: 300,
      tags: ["table:machines", "table:employees", "table:breakdowns"],
    },
  );
}

export default async function ExecutiveDashboardPage() {
  const supabase = await createServerSupabaseClient();
  const user = await getUserSafely(supabase);

  if (!user || !user.id) {
    redirect("/login");
  }

  // Gate: admin/manager only — query role from read-replica
  const db = await createReadReplicaClient();
  const { data: employee } = await db
    .from("employees")
    .select("role")
    .eq("auth_id", user.id)
    .single();

  if (employee?.role !== "admin" && employee?.role !== "manager") {
    redirect("/");
  }

  const cookieStore = await cookies();
  const cookieList = cookieStore.getAll();
  const data = await getExecutiveData(cookieList);

  const {
    today,
    totalCoalMtd,
    totalWasteMtd,
    totalTonnageMtd,
    totalFuelMtd,
    totalHoursMtd,
    avgDriftPct,
    driftLevel,
    driftUi,
    fleetPct,
    fuelPerTonne,
    openBreakdowns,
    activeMachines,
    totalMachines,
    openIncidents,
    activeEmployees,
    chartData,
  } = data;

  const driftAlertStyle = DRIFT_ALERT_STYLES[driftUi.color] ?? DRIFT_ALERT_STYLES["red"]!;
  const driftKpiColor = RECON_COLOR_TO_KPI[driftUi.color] ?? "red";

  // CSV export payload
  const exportRows = chartData.map((r) => ({
    Date: r.date,
    "Coal (t)": r.coal.toFixed(2),
    "Waste (t)": r.waste.toFixed(2),
    "Total (t)": (r.coal + r.waste).toFixed(2),
    "Reconciliation Drift (%)": r.drift.toFixed(1),
  }));

  const pdfReportData = {
    title: "Executive Production & Fleet Report",
    subtitle: `Generated on ${today} — Month-to-date analysis`,
    kpis: [
      { label: "Total Tonnage", value: `${totalTonnageMtd.toFixed(0)} t` },
      { label: "Coal Removed", value: `${totalCoalMtd.toFixed(0)} t` },
      { label: "Waste Removed", value: `${totalWasteMtd.toFixed(0)} t` },
      { label: "Fuel Efficiency", value: `${fuelPerTonne} L/t` },
      { label: "Fleet Availability", value: `${fleetPct}%` },
      { label: "Active Breakdowns", value: `${openBreakdowns}` },
    ],
    tableHeaders: ["Date", "Coal (t)", "Waste (t)", "Total Tonnage (t)", "Drift %"],
    tableRows: chartData.map((r) => [
      r.date,
      r.coal.toFixed(2),
      r.waste.toFixed(2),
      (r.coal + r.waste).toFixed(2),
      `${r.drift.toFixed(1)}%`,
    ]),
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium text-[var(--text-heading)] flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-[var(--accent-blue)]" />
            Executive Dashboard
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Cross-department KPIs — month-to-date as of {today}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PDFDownloadButton reportData={pdfReportData} />
          <ExportButton filename={`executive-report-${today}`} rows={exportRows} />
        </div>
      </div>

      {/* KPI Row 1 — Production & Reconciliation */}
      <section className="space-y-3">
        <h2 className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5" /> Production & Reconciliation (MTD)
        </h2>
        <KPIGrid cols={4}>
          <KPICard label="Total Tonnage" value={`${totalTonnageMtd.toFixed(0)} t`} color="green" />
          <KPICard label="Coal Removed" value={`${totalCoalMtd.toFixed(0)} t`} color="green" />
          <KPICard
            label="Reconciliation Drift"
            value={`${avgDriftPct.toFixed(1)}%`}
            color={driftKpiColor}
            sub={driftUi.label}
            icon={<Scale className="w-4 h-4" />}
          />
          <KPICard
            label="Fuel Efficiency"
            value={`${fuelPerTonne} L/t`}
            color="blue"
            icon={<Activity className="w-4 h-4" />}
          />
        </KPIGrid>

        {/* Drift Alert (only if not stable) */}
        {driftLevel !== "stable" && (
          <div
            className={`p-3 rounded-lg border flex items-start gap-3 ${driftAlertStyle.container} text-sm`}
          >
            <AlertCircle className={`w-5 h-5 ${driftAlertStyle.icon} mt-0.5 shrink-0`} />
            <div>
              <p className="font-medium">Operational Drift Warning</p>
              <p className="text-[var(--text-muted)]">{driftUi.description}</p>
            </div>
          </div>
        )}
      </section>

      {/* KPI Row 2 — Fleet & Personnel */}
      <section className="space-y-3">
        <h2 className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
          <Truck className="w-3.5 h-3.5" /> Fleet & Personnel
        </h2>
        <KPIGrid cols={4}>
          <KPICard
            label="Fleet Availability"
            value={`${fleetPct}%`}
            color={fleetPct >= 80 ? "green" : fleetPct >= 60 ? "blue" : "red"}
            sub={`${activeMachines} / ${totalMachines} machines`}
          />
          <KPICard
            label="Machine Hours (MTD)"
            value={`${totalHoursMtd.toFixed(0)} h`}
            color="blue"
          />
          <KPICard
            label="Active Breakdowns"
            value={openBreakdowns}
            color={openBreakdowns > 5 ? "red" : openBreakdowns > 2 ? "blue" : "green"}
          />
          <KPICard label="Active Personnel" value={activeEmployees} color="default" />
        </KPIGrid>
      </section>

      {/* KPI Row 3 — Safety & Environment */}
      <section className="space-y-3">
        <h2 className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
          <ShieldAlert className="w-3.5 h-3.5" /> Safety & Resource Usage
        </h2>
        <KPIGrid cols={4}>
          <KPICard
            label="Open Incidents"
            value={openIncidents}
            color={openIncidents > 0 ? "red" : "green"}
          />
          <KPICard
            label="Diesel Consumed (MTD)"
            value={`${totalFuelMtd.toFixed(0)} L`}
            color="blue"
          />
          <KPICard label="Waste Removed" value={`${totalWasteMtd.toFixed(0)} t`} color="default" />
          <KPICard label="Reporting Date" value={today} color="default" />
        </KPIGrid>
      </section>

      {/* 30-Day Production Trend Chart */}
      <section className="space-y-3">
        <h2 className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5" /> 30-Day Production Trend
        </h2>
        <GlassCard>
          <ProductionTrendChart data={chartData} />
        </GlassCard>
      </section>
    </div>
  );
}
