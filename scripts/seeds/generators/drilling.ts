import type { SupabaseClient } from "@supabase/supabase-js";

export async function seedDrilling(supabase: SupabaseClient): Promise<void> {
  console.log("--> Seeding Drilling department data...");

  const { data: dept, error: deptError } = await supabase
    .from("departments")
    .select("id")
    .eq("name", "drilling")
    .single();

  if (deptError || !dept) {
    console.error("   [Drilling] Department not found in database.");
    return;
  }

  // Find or fallback to any machine
  const { data: machine } = await supabase
    .from("machines")
    .select("id, name")
    .eq("department_id", dept.id)
    .limit(1)
    .single();

  let targetMachineId = machine?.id;
  if (!targetMachineId) {
    const { data: fallbackMachine } = await supabase
      .from("machines")
      .select("id")
      .limit(1)
      .single();
    targetMachineId = fallbackMachine?.id;
  }

  if (!targetMachineId) {
    console.error("   [Drilling] No machine found for seeding.");
    return;
  }

  const today = new Date().toISOString().split("T")[0];

  // 1. Seed Drill Operations
  const { error: drillOpError } = await supabase.from("drill_operations").upsert(
    [
      {
        department_id: dept.id,
        machine_id: targetMachineId,
        operation_date: today,
        open_hours: 1420.0,
        close_hours: 1431.5,
        holes: 18,
        meters_drilled: 234.5,
        block_drilled: "Pit-A-Bench-04",
        production_delays: 15.0,
        non_productional_delays: 10.0,
        engineering_delays: 0.0,
        status: "active",
        notes: "Target drill pattern completed on schedule.",
      },
    ],
    { onConflict: "machine_id,operation_date" }
  );

  if (drillOpError) {
    console.error("   [Drilling] Drill operations upsert error:", drillOpError.message);
  } else {
    console.log("   ✓ Drill operations seeded successfully.");
  }

  // 2. Seed Machine Telemetry snapshots
  const now = new Date();
  const telemetryPoints = Array.from({ length: 6 }).map((_, i) => {
    const timeOffset = new Date(now.getTime() - (5 - i) * 10 * 60 * 1000);
    return {
      department_id: dept.id,
      machine_id: targetMachineId,
      recorded_at: timeOffset.toISOString(),
      engine_rpm: 1800 + i * 15,
      engine_temp: 82.5 + i * 0.4,
      hydraulic_pressure: 215.0 + (i % 3) * 2.5,
      hydraulic_temp: 64.0 + i * 0.3,
      bit_depth: 12.0 + i * 1.5,
      hole_depth: 18.0,
      weight_on_bit: 16.5 + (i % 2) * 1.2,
      rotation_torque: 4100 + i * 50,
      penetration_rate: 1.15 + (i % 3) * 0.1,
      operating_hours: 1425.0 + i * 0.15,
      fuel_level: Math.max(10, 85 - i * 0.8),
    };
  });

  const { error: telemetryError } = await supabase
    .from("machine_telemetry")
    .insert(telemetryPoints);

  if (telemetryError) {
    console.warn("   [Drilling] Machine telemetry insert warning:", telemetryError.message);
  } else {
    console.log(`   ✓ Seeded ${telemetryPoints.length} real-time drill telemetry stream points.`);
  }
}
