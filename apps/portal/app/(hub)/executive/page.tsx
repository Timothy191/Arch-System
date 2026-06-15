import { createServerSupabaseClient } from "@repo/supabase/server";
import { createReadReplicaClient } from "@repo/supabase/read-replica";
import { redirect } from "next/navigation";
import { KPICard, KPIGrid } from "@repo/ui/KPI";
import { GlassCard } from "@repo/ui/GlassCard";
import {
  TrendingUp,
  BarChart3,
  ShieldAlert,
  Truck,
  Activity,
} from "lucide-react";
import { ExportButton } from "@/features/analytics/components/ExportButton";
import { PDFDownloadButton } from "@/features/analytics/components/PDFDownloadButton";
import { ProductionTrendChart } from "@/features/analytics/components/ProductionTrendChartWrapper";

export const dynamic = "force-dynamic";

export default async function ExecutiveDashboardPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Gate: admin only
  const { data: employee } = await supabase
    .from("employees")
    .select("role")
    .eq("auth_id", user.id)
    .single();

  if (employee?.role !== "admin" && employee?.role !== "manager") {
    redirect("/");
  }

  const db = await createReadReplicaClient();
  const today = new Date().toISOString().split("T")[0]!;
  const monthStart = today.slice(0, 7) + "-01";
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000)
    .toISOString()
    .split("T")[0]!;

  // Step 1: get daily_log IDs for MTD and 30-day window
  const [{ data: mtdLogs }, { data: trendLogs }] = await Promise.all([
    db
      .from("daily_logs")
      .select("id")
      .gte("log_date", monthStart)
      .lte("log_date", today),
    db
      .from("daily_logs")
      .select("id, log_date")
      .gte("log_date", thirtyDaysAgo)
      .lte("log_date", today)
      .order("log_date", { ascending: true }),
  ]);

  const mtdLogIds = mtdLogs?.map((l) => l.id) ?? [];
  const trendLogIds = trendLogs?.map((l) => l.id) ?? [];

  // Step 2: parallel fetch of all KPI data
  const [
    { count: activeMachines },
    { count: totalMachines },
    { count: openIncidents },
    { count: activeEmployees },
    { data: productionMtd },
    { data: fuelMtd },
    { data: machineHoursMtd },
    { data: breakdownsMtd },
    { data: trendProduction },
  ] = await Promise.all([
    db
      .from("machines")
      .select("id", { count: "exact", head: true })
      .eq("active", true)
      .is("deleted_at", null),
    db
      .from("machines")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null),
    db
      .from("safety_incidents")
      .select("id", { count: "exact", head: true })
      .eq("status", "open"),
    db
      .from("employees")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null),
    mtdLogIds.length > 0
      ? db
          .from("production_logs")
          .select("coal_tonnes, waste_tonnes")
          .in("daily_log_id", mtdLogIds)
      : Promise.resolve({
          data: [] as { coal_tonnes: number; waste_tonnes: number }[],
          error: null,
        }),
    mtdLogIds.length > 0
      ? db
          .from("fuel_logs")
          .select("diesel_litres")
          .in("daily_log_id", mtdLogIds)
      : Promise.resolve({
          data: [] as { diesel_litres: number }[],
          error: null,
        }),
    mtdLogIds.length > 0
      ? db
          .from("machine_hours")
          .select("hours_worked")
          .in("daily_log_id", mtdLogIds)
      : Promise.resolve({
          data: [] as { hours_worked: number }[],
          error: null,
        }),
    db
      .from("breakdowns")
      .select("id, status")
      .gte("date_in", monthStart)
      .is("deleted_at", null),
    trendLogIds.length > 0
      ? db
          .from("production_logs")
          .select("daily_log_id, coal_tonnes, waste_tonnes")
          .in("daily_log_id", trendLogIds)
      : Promise.resolve({
          data: [] as {
            daily_log_id: string;
            coal_tonnes: number;
            waste_tonnes: number;
          }[],
          error: null,
        }),
  ]);

  // Compute MTD aggregates
  const totalCoalMtd =
    productionMtd?.reduce((s, r) => s + (r.coal_tonnes ?? 0), 0) ?? 0;
  const totalWasteMtd =
    productionMtd?.reduce((s, r) => s + (r.waste_tonnes ?? 0), 0) ?? 0;
  const totalTonnageMtd = totalCoalMtd + totalWasteMtd;
  const totalFuelMtd =
    fuelMtd?.reduce((s, r) => s + (r.diesel_litres ?? 0), 0) ?? 0;
  const totalHoursMtd =
    machineHoursMtd?.reduce((s, r) => s + (r.hours_worked ?? 0), 0) ?? 0;
  const fleetPct =
    totalMachines && totalMachines > 0
      ? Math.round(((activeMachines ?? 0) / totalMachines) * 100)
      : 0;
  const fuelPerTonne =
    totalTonnageMtd > 0 ? (totalFuelMtd / totalTonnageMtd).toFixed(2) : "—";
  const openBreakdowns =
    breakdownsMtd?.filter((b) => b.status === "active").length ?? 0;

  // Build 30-day chart data — aggregate production per log_date
  const prodByLogId = new Map<string, { coal: number; waste: number }>();
  trendProduction?.forEach((p) => {
    const cur = prodByLogId.get(p.daily_log_id) ?? { coal: 0, waste: 0 };
    prodByLogId.set(p.daily_log_id, {
      coal: cur.coal + (p.coal_tonnes ?? 0),
      waste: cur.waste + (p.waste_tonnes ?? 0),
    });
  });

  const chartData = (trendLogs ?? []).map((log) => {
    const prod = prodByLogId.get(log.id) ?? { coal: 0, waste: 0 };
    return { date: log.log_date, coal: prod.coal, waste: prod.waste };
  });

  // CSV export payload
  const exportRows = chartData.map((r) => ({
    Date: r.date,
    "Coal (t)": r.coal.toFixed(2),
    "Waste (t)": r.waste.toFixed(2),
    "Total (t)": (r.coal + r.waste).toFixed(2),
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
    tableHeaders: ["Date", "Coal (t)", "Waste (t)", "Total Tonnage (t)"],
    tableRows: chartData.map((r) => [
      r.date,
      r.coal.toFixed(2),
      r.waste.toFixed(2),
      (r.coal + r.waste).toFixed(2),
    ]),
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-heading)] flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-[var(--accent-blue)]" />
            Executive Dashboard
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Cross-department KPIs — month-to-date as of {today}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PDFDownloadButton reportData={pdfReportData} />
          <ExportButton
            filename={`executive-report-${today}`}
            rows={exportRows}
          />
        </div>
      </div>

      {/* KPI Row 1 — Production */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5" /> Production (MTD)
        </h2>
        <KPIGrid cols={4}>
          <KPICard
            label="Total Tonnage"
            value={`${totalTonnageMtd.toFixed(0)} t`}
            color="green"
          />
          <KPICard
            label="Coal Removed"
            value={`${totalCoalMtd.toFixed(0)} t`}
            color="green"
          />
          <KPICard
            label="Waste Removed"
            value={`${totalWasteMtd.toFixed(0)} t`}
            color="blue"
          />
          <KPICard
            label="Fuel Efficiency"
            value={`${fuelPerTonne} L/t`}
            color="blue"
          />
        </KPIGrid>
      </section>

      {/* KPI Row 2 — Fleet & Personnel */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
          <Truck className="w-3.5 h-3.5" /> Fleet & Personnel
        </h2>
        <KPIGrid cols={4}>
          <KPICard
            label="Fleet Availability"
            value={`${fleetPct}%`}
            color={fleetPct >= 80 ? "green" : fleetPct >= 60 ? "blue" : "red"}
            sub={`${activeMachines ?? 0} / ${totalMachines ?? 0} machines`}
          />
          <KPICard
            label="Machine Hours (MTD)"
            value={`${totalHoursMtd.toFixed(0)} h`}
            color="blue"
          />
          <KPICard
            label="Active Breakdowns"
            value={openBreakdowns}
            color={
              openBreakdowns > 5 ? "red" : openBreakdowns > 2 ? "blue" : "green"
            }
          />
          <KPICard
            label="Active Personnel"
            value={activeEmployees ?? 0}
            color="default"
          />
        </KPIGrid>
      </section>

      {/* KPI Row 3 — Safety */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
          <ShieldAlert className="w-3.5 h-3.5" /> Safety
        </h2>
        <KPIGrid cols={4}>
          <KPICard
            label="Open Incidents"
            value={openIncidents ?? 0}
            color={(openIncidents ?? 0) > 0 ? "red" : "green"}
          />
          <KPICard
            label="Diesel Consumed (MTD)"
            value={`${totalFuelMtd.toFixed(0)} L`}
            color="blue"
          />
          <KPICard
            label="Breakdowns (MTD)"
            value={breakdownsMtd?.length ?? 0}
            color="default"
          />
          <KPICard label="Reporting Date" value={today} color="default" />
        </KPIGrid>
      </section>

      {/* 30-Day Production Trend Chart */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5" /> 30-Day Production Trend
        </h2>
        <GlassCard>
          <ProductionTrendChart data={chartData} />
        </GlassCard>
      </section>
    </div>
  );
}
