import "server-only";

import { createServerSupabaseClient } from "@repo/supabase/server";

export interface SafetyIncident {
  id: string;
  incident_type: string;
  severity_id: string;
  status: string;
  injured_parties?: number;
  incident_date: string;
}

export interface SafetyDashboardData {
  todayIncidents: SafetyIncident[];
  todayCount: number;
  openCount: number;
  injuredToday: number;
  monthlyIncidents: SafetyIncident[];
  monthlyCount: number;
  monthlyLostTime: number;
  ltiFreeDays: number;
  incidentFreeDays: number;
}

export async function getSafetyDashboardData(deptId: string): Promise<SafetyDashboardData> {
  const supabase = await createServerSupabaseClient();
  const today = new Date().toISOString().split("T")[0];

  // Today's safety incidents
  const { data: todayIncidentsRaw } = await supabase
    .from("safety_incidents")
    .select("id, incident_type, severity_id, status, injured_parties, incident_date")
    .eq("department_id", deptId)
    .eq("incident_date", today);

  const todayIncidents = (todayIncidentsRaw || []) as SafetyIncident[];
  const todayCount = todayIncidents.length;
  const openCount = todayIncidents.filter((i) => i.status === "open").length;
  const injuredToday = todayIncidents.reduce((sum, i) => sum + (i.injured_parties || 0), 0);

  // Last 30 days stats
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const { data: monthlyIncidentsRaw } = await supabase
    .from("safety_incidents")
    .select("id, incident_type, severity_id, status, injured_parties, incident_date")
    .eq("department_id", deptId)
    .gte("incident_date", thirtyDaysAgo.toISOString().split("T")[0]);

  const monthlyIncidents = (monthlyIncidentsRaw || []) as SafetyIncident[];
  const monthlyCount = monthlyIncidents.length;
  const monthlyLostTime = monthlyIncidents.filter((i) => i.incident_type === "lost-time").length;

  // LTI-free days
  const { data: lastLTI } = await supabase
    .from("safety_incidents")
    .select("incident_date")
    .eq("department_id", deptId)
    .eq("incident_type", "lost-time")
    .order("incident_date", { ascending: false })
    .limit(1)
    .single();

  const lastLTIDate = lastLTI ? new Date(lastLTI.incident_date) : new Date("2000-01-01");
  const ltiFreeDays = Math.floor((Date.now() - lastLTIDate.getTime()) / (1000 * 60 * 60 * 24));

  // Incident-free days
  const uniqueDates = new Set(monthlyIncidents.map((d) => d.incident_date));
  const incidentFreeDays = 30 - uniqueDates.size;

  return {
    todayIncidents,
    todayCount,
    openCount,
    injuredToday,
    monthlyIncidents,
    monthlyCount,
    monthlyLostTime,
    ltiFreeDays,
    incidentFreeDays,
  };
}
