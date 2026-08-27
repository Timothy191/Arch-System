import { createServerSupabaseClient } from "@repo/supabase/server";
import { GlassCard } from "@repo/ui/GlassCard";
import { PageHeader } from "@repo/ui/PageHeader";
import { SafetyCharts } from "./SafetyChartsWrapper";

// Safety-specific dashboard stats
export async function SafetyDashboard({ deptId }: { deptId: string }) {
  const supabase = await createServerSupabaseClient();
  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgoStr = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

  // AGENT-TRACE: Parallelize independent DB queries via Promise.all and derive incidentFreeDays from monthlyIncidents
  const [{ data: todayIncidents }, { data: monthlyIncidents }, { data: lastLTI }] =
    await Promise.all([
      supabase
        .from("safety_incidents")
        .select("id, incident_type, severity_id, status, injured_parties")
        .eq("department_id", deptId)
        .eq("incident_date", today),
      supabase
        .from("safety_incidents")
        .select("incident_date, incident_type, severity_id")
        .eq("department_id", deptId)
        .gte("incident_date", thirtyDaysAgoStr),
      supabase
        .from("safety_incidents")
        .select("incident_date")
        .eq("department_id", deptId)
        .eq("incident_type", "lost-time")
        .order("incident_date", { ascending: false })
        .limit(1)
        .single(),
    ]);

  const todayCount = todayIncidents?.length ?? 0;
  const openCount = todayIncidents?.filter((i) => i.status === "open").length ?? 0;
  const injuredToday = todayIncidents?.reduce((sum, i) => sum + (i.injured_parties || 0), 0) ?? 0;

  const monthlyCount = monthlyIncidents?.length ?? 0;

  // Single-pass optimization: Pre-initialize trend bucket map for the last 30 days
  const trend: Record<string, { date: string; incidents: number; severity: number }> = {};
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr: string = d.toISOString().split("T")[0]!;
    trend[dateStr] = {
      date: dateStr.slice(5),
      incidents: 0,
      severity: 0,
    };
  }

  // Single-pass metrics accumulators: replace 5 separate iterations over monthlyIncidents with O(N) single loop
  let monthlyLostTime = 0;
  let nearMissCount = 0;
  let equipmentDamageCount = 0;
  const uniqueDates = new Set<string>();
  const dist: Record<string, number> = {};

  if (monthlyIncidents) {
    for (let i = 0; i < monthlyIncidents.length; i++) {
      const inc = monthlyIncidents[i];
      if (!inc) continue;

      // Track unique incident dates for incident-free days calculation
      if (inc.incident_date) {
        uniqueDates.add(inc.incident_date);
      }

      // Aggregate type counts
      if (inc.incident_type === "lost-time") {
        monthlyLostTime++;
      } else if (inc.incident_type === "near-miss") {
        nearMissCount++;
      } else if (inc.incident_type === "equipment-damage") {
        equipmentDamageCount++;
      }

      // Build trend data
      const dateStr = inc.incident_date;
      if (dateStr && trend[dateStr]) {
        const entry = trend[dateStr];
        if (entry) {
          entry.incidents += 1;
          entry.severity += 1;
        }
      }

      // Build distribution data
      const type = inc.incident_type.replace("-", " ").toUpperCase();
      dist[type] = (dist[type] || 0) + 1;
    }
  }

  const trendData = Object.values(trend);
  const distributionData = Object.entries(dist).map(([name, value]) => ({ name, value }));

  const lastLTIDate = lastLTI ? new Date(lastLTI.incident_date) : new Date("2000-01-01");
  const ltiFreeDays = Math.floor((Date.now() - lastLTIDate.getTime()) / (1000 * 60 * 60 * 24));
  const incidentFreeDays = 30 - uniqueDates.size;

  return (
    <div className="space-y-6">
      <PageHeader title="Safety Dashboard" />

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <GlassCard>
          <p className="text-[var(--text-secondary)] text-xs uppercase tracking-wide">
            LTI-Free Days
          </p>
          <p className="text-2xl font-medium text-[#3ecf8e] mt-1">{ltiFreeDays}d</p>
          {ltiFreeDays > 30 && <p className="text-[#3ecf8e] text-xs mt-1">Target met</p>}
        </GlassCard>
        <GlassCard>
          <p className="text-[var(--text-secondary)] text-xs uppercase tracking-wide">
            Incident-Free Days (30d)
          </p>
          <p className="text-2xl font-medium text-accent-green mt-1">{incidentFreeDays}d</p>
          <p className="text-[var(--text-secondary)] text-xs mt-1">out of 30</p>
        </GlassCard>
        <GlassCard>
          <p className="text-[var(--text-secondary)] text-xs uppercase tracking-wide">
            Open Incidents
          </p>
          <p className="text-2xl font-medium text-accent-blue mt-1">{openCount}</p>
          {todayCount > 0 && (
            <p className="text-[var(--text-secondary)] text-xs mt-1">{todayCount} today</p>
          )}
        </GlassCard>
        <GlassCard>
          <p className="text-[var(--text-secondary)] text-xs uppercase tracking-wide">
            Lost Time (30d)
          </p>
          <p className="text-2xl font-medium text-accent-red mt-1">{monthlyLostTime}</p>
          <p className="text-[var(--text-secondary)] text-xs mt-1">
            {monthlyCount} total incidents
          </p>
        </GlassCard>
      </div>

      {/* Safety Visualizations */}
      <SafetyCharts trendData={trendData} distributionData={distributionData} />

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        <a
          href={`/safety/daily-log`}
          className="px-4 py-2 bg-[#3ecf8e] text-[var(--text-heading)] font-medium rounded-lg hover:bg-[#35b37d] transition-colors text-sm"
        >
          + Log Daily Check
        </a>
        <a
          href={`/safety/reports`}
          className="px-4 py-2 bg-[var(--bg-primary)] border border-[var(--border-emphasis)] text-[var(--text-heading)] font-medium rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors text-sm"
        >
          View Reports
        </a>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <GlassCard>
          <h3 className="text-sm font-medium text-[var(--text-heading)] mb-3">Today's Incidents</h3>
          {todayCount === 0 ? (
            <p className="text-[#3ecf8e] text-sm">No incidents reported today</p>
          ) : (
            <div className="space-y-2">
              {todayIncidents?.map((inc) => (
                <div key={inc.id} className="flex justify-between text-sm">
                  <span className="text-[var(--text-muted)]">
                    {inc.incident_type.replace("-", " ")}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      inc.status === "open"
                        ? "text-accent-blue bg-accent-blue/10"
                        : inc.status === "resolved"
                          ? "text-[#3ecf8e] bg-[#3ecf8e]/10"
                          : "text-[var(--text-secondary)] bg-[var(--text-secondary)]/10"
                    }`}
                  >
                    {inc.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </GlassCard>

        <GlassCard>
          <h3 className="text-sm font-medium text-[var(--text-heading)] mb-3">30-Day Summary</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Total incidents</span>
              <span className="text-[var(--text-heading)]">{monthlyCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Near misses</span>
              <span className="text-[var(--text-heading)]">{nearMissCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Equipment damage</span>
              <span className="text-[var(--text-heading)]">{equipmentDamageCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Injured parties (today)</span>
              <span className={injuredToday > 0 ? "text-accent-red" : "text-[var(--text-heading)]"}>
                {injuredToday}
              </span>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
