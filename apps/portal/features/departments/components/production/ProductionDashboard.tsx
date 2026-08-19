import { createServerSupabaseClient } from "@repo/supabase/server";
import { GlassCard } from "@repo/ui/GlassCard";
import { PageHeader } from "@repo/ui/PageHeader";
import { classifyReconciliationDrift, RECONCILIATION_UI } from "~/lib/production-reconciliation";

export async function ProductionDashboard({ deptId }: { deptId: string }) {
  const supabase = await createServerSupabaseClient();

  // Get today's start and end boundaries
  const today = new Date().toISOString().split("T")[0]!;

  // Fetch from the materialized view using the RPC function
  const { data: productionData } = await supabase.rpc("get_production_summary", {
    p_start_date: today,
    p_end_date: today,
  });

  // Aggregate today's shifts
  let actualCoal = 0;
  let actualWaste = 0;
  let totalBcm = 0;
  let expectedTotalTonnes = 0;

  if (productionData && productionData.length > 0) {
    for (const shift of productionData) {
      if (shift.department_id === deptId) {
        actualCoal += shift.actual_coal_tonnes || 0;
        actualWaste += shift.actual_waste_tonnes || 0;
        totalBcm += shift.total_bcm || 0;
        expectedTotalTonnes += shift.expected_total_tonnes || 0;
      }
    }
  }

  const actualTotalTonnes = actualCoal + actualWaste;

  // Strip Ratio: Waste / Coal
  const stripRatio = actualCoal > 0 ? (actualWaste / actualCoal).toFixed(2) : "0.00";

  // Calculate Drift Pct globally for today's aggregated shifts
  const driftPct =
    expectedTotalTonnes > 0
      ? ((actualTotalTonnes - expectedTotalTonnes) / expectedTotalTonnes) * 100
      : 0;

  const driftLevel = classifyReconciliationDrift(driftPct);
  const driftUI = RECONCILIATION_UI[driftLevel];

  return (
    <div className="space-y-6">
      <PageHeader title="Production Dashboard" />

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <GlassCard>
          <p className="text-[var(--text-secondary)] text-xs uppercase tracking-wide">
            Actual Coal (t)
          </p>
          <p className="text-2xl font-medium text-[var(--text-heading)] mt-1">
            {actualCoal.toLocaleString(undefined, { maximumFractionDigits: 1 })}
          </p>
        </GlassCard>

        <GlassCard>
          <p className="text-[var(--text-secondary)] text-xs uppercase tracking-wide">
            Actual Waste (t)
          </p>
          <p className="text-2xl font-medium text-[var(--text-heading)] mt-1">
            {actualWaste.toLocaleString(undefined, { maximumFractionDigits: 1 })}
          </p>
        </GlassCard>

        <GlassCard>
          <p className="text-[var(--text-secondary)] text-xs uppercase tracking-wide">
            Strip Ratio (W:C)
          </p>
          <p className="text-2xl font-medium text-[var(--text-heading)] mt-1">{stripRatio}:1</p>
        </GlassCard>

        <GlassCard>
          <p className="text-[var(--text-secondary)] text-xs uppercase tracking-wide">
            Total Extraction (BCM)
          </p>
          <p className="text-2xl font-medium text-[var(--text-heading)] mt-1">
            {totalBcm.toLocaleString(undefined, { maximumFractionDigits: 1 })}
          </p>
        </GlassCard>
      </div>

      {/* Reconciliation Drift Alert */}
      <GlassCard
        className={`border-l-4 ${driftLevel === "critical" ? "border-accent-red" : driftLevel === "moderate" ? "border-accent-orange" : driftLevel === "minor" ? "border-accent-amber" : "border-accent-green"}`}
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-[var(--text-heading)]">
              Reconciliation Drift
            </h3>
            <p className="text-sm text-[var(--text-muted)] mt-1">{driftUI.description}</p>
          </div>
          <div className="text-right">
            <span
              className={`text-xl font-bold ${driftLevel === "critical" ? "text-accent-red" : driftLevel === "moderate" ? "text-accent-orange" : driftLevel === "minor" ? "text-accent-amber" : "text-accent-green"}`}
            >
              {driftPct > 0 ? "+" : ""}
              {driftPct.toFixed(2)}%
            </span>
            <p className="text-xs text-[var(--text-secondary)] mt-1 uppercase tracking-wider">
              {driftUI.label}
            </p>
          </div>
        </div>
      </GlassCard>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        <a
          href={`/production/daily-log`}
          className="px-4 py-2 bg-[var(--accent-blue)] hover:bg-[var(--accent-blue)]/90 text-white font-medium rounded-lg transition-all duration-200 text-sm hover:scale-[1.02] active:scale-[0.98]"
        >
          + Log Production Shift
        </a>
      </div>
    </div>
  );
}
