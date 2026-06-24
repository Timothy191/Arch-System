import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@repo/supabase/server";

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();

    // Auth check
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get breakdowns from the last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

    const { data: breakdowns, error } = await supabase
      .from("breakdowns")
      .select("machine_id, date_in")
      .gte("date_in", thirtyDaysAgo)
      .is("deleted_at", null);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Heuristic ML Mock:
    // If a machine has > 2 breakdowns in the last 30 days, it is flagged as High Risk.
    // In a real scenario, this would post the breakdown timeline to an XGBoost model endpoint.
    const machineBreakdownCount: Record<string, number> = {};
    for (const b of breakdowns || []) {
      if (b.machine_id) {
        machineBreakdownCount[b.machine_id] = (machineBreakdownCount[b.machine_id] || 0) + 1;
      }
    }

    const highRiskMachineIds = Object.entries(machineBreakdownCount)
      .filter(([_, count]) => count > 2)
      .map(([id]) => id);

    if (highRiskMachineIds.length === 0) {
      return NextResponse.json({ predictions: [] });
    }

    // Fetch details of those high risk machines
    const { data: machines } = await supabase
      .from("machines")
      .select("id, name, type, active")
      .in("id", highRiskMachineIds);

    const predictions = (machines || []).map((m) => ({
      machine_id: m.id,
      machine_name: m.name,
      type: m.type,
      risk_level: "HIGH",
      confidence: 0.85,
      reason: `Machine has experienced ${machineBreakdownCount[m.id]} breakdowns in the last 30 days. Model (mock) predicts an 85% chance of critical failure within 72 hours.`,
      recommended_action:
        "Schedule immediate preventative maintenance and check hydraulic systems.",
    }));

    return NextResponse.json({ predictions });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
