import { CacheCategory } from "@repo/redis";
import { createReadReplicaClient } from "@repo/supabase/read-replica";
import { createServerSupabaseClient, getUserSafely } from "@repo/supabase/server";
import { GlassCard } from "@repo/ui/GlassCard";
import { KPICard, KPIGrid } from "@repo/ui/KPI";
import { AlertCircle } from "lucide-react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ExportButton } from "@/features/analytics/components/ExportButton";
import { PDFDownloadButton } from "@/features/analytics/components/PDFDownloadButton";
import { ProductionTrendChart } from "@/features/analytics/components/ProductionTrendChartWrapper";
import { withCache } from "@/lib/cache-utils";
import { classifyReconciliationDrift, RECONCILIATION_UI } from "@/lib/production-reconciliation";
import { cachedRSC } from "@/lib/server-cache";
import { TonnageLedger } from "./TonnageLedger";

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
          const monthStart = `${today.slice(0, 7)}-01`;
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
        }
      );
    },
    {
      revalidate: 300,
      tags: ["table:machines", "table:employees", "table:breakdowns"],
    }
  );
}

export default async function ExecutiveDashboardPage() {
  const supabase = await createServerSupabaseClient();
  const user = await getUserSafely(supabase);

  if (!user?.id) {
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

  const driftAlertStyle = DRIFT_ALERT_STYLES[driftUi.color] ?? DRIFT_ALERT_STYLES.red!;

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
    <div className="space-y-10">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium text-[var(--text-heading)]">Executive dashboard</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Month to date as of <span className="font-mono tabular-nums">{today}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PDFDownloadButton reportData={pdfReportData} />
          <ExportButton filename={`executive-report-${today}`} rows={exportRows} />
        </div>
      </div>

      {/* Hero — material ledger (strip-ratio composition) */}
      <TonnageLedger
        totalTonnage={totalTonnageMtd}
        totalCoal={totalCoalMtd}
        totalWaste={totalWasteMtd}
        avgDriftPct={avgDriftPct}
        driftLabel={driftUi.label}
        driftColor={driftUi.color}
        fuelPerTonne={fuelPerTonne}
        totalFuelLitres={totalFuelMtd}
        totalHours={totalHoursMtd}
      />

      {/* Drift warning — only when the month is drifting (semantic status, not decoration) */}
      {driftLevel !== "stable" && (
        <div
          className={`flex items-start gap-3 rounded-lg border p-3 text-sm ${driftAlertStyle.container}`}
        >
          <AlertCircle className={`mt-0.5 h-5 w-5 shrink-0 ${driftAlertStyle.icon}`} />
          <div>
            <p className="font-medium">Operational drift warning</p>
            <p className="text-[var(--text-muted)]">{driftUi.description}</p>
          </div>
        </div>
      )}

      {/* Operations band — fleet, personnel, safety */}
      <section className="space-y-3">
        <h2 className="text-[13px] font-medium text-[var(--text-muted)]">
          Fleet, personnel and safety
        </h2>
        <KPIGrid cols={4}>
          <KPICard
            label="Fleet Availability"
            value={`${fleetPct}%`}
            color={fleetPct >= 80 ? "green" : fleetPct >= 60 ? "blue" : "red"}
            sub={`${activeMachines} / ${totalMachines} machines`}
          />
          <KPICard
            label="Active Breakdowns"
            value={openBreakdowns}
            color={openBreakdowns > 5 ? "red" : openBreakdowns > 2 ? "blue" : "green"}
          />
          <KPICard label="Active Personnel" value={activeEmployees} color="default" />
          <KPICard
            label="Open Incidents"
            value={openIncidents}
            color={openIncidents > 0 ? "red" : "green"}
          />
        </KPIGrid>
      </section>

      {/* 30-day production trend */}
      <section className="space-y-3">
        <h2 className="text-[13px] font-medium text-[var(--text-muted)]">
          30-day production trend
        </h2>
        <GlassCard>
          <ProductionTrendChart data={chartData} />
        </GlassCard>
      </section>
    </div>
  );
}
