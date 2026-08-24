import type { SupabaseClient } from "@supabase/supabase-js";

export async function seedControlRoom(supabase: SupabaseClient): Promise<void> {
  console.log("--> Seeding Control Room department data...");

  const { data: dept, error: deptError } = await supabase
    .from("departments")
    .select("id")
    .eq("name", "control-room")
    .single();

  if (deptError || !dept) {
    console.error("   [Control Room] Department not found in database.");
    return;
  }

  const { data: machine, error: machineError } = await supabase
    .from("machines")
    .select("id, name")
    .eq("department_id", dept.id)
    .limit(1)
    .single();

  const targetMachineId = machine?.id;
  if (!targetMachineId) {
    console.error("   [Control Room] No valid machine found for seeding.");
    return;
  }

  const today = new Date().toISOString().split("T")[0];

  // 1. Hourly Loads (12-hour shift format)
  const { error: loadError } = await supabase.from("hourly_loads").upsert(
    [
      {
        department_id: dept.id,
        machine_id: targetMachineId,
        load_date: today,
        shift_type: "day",
        hour_01: 22,
        hour_02: 28,
        hour_03: 31,
        hour_04: 35,
        hour_05: 30,
        hour_06: 27,
        hour_07: 34,
        hour_08: 38,
        hour_09: 29,
        hour_10: 33,
        hour_11: 36,
        hour_12: 30,
      },
    ],
    { onConflict: "machine_id,load_date,shift_type" }
  );

  if (loadError) {
    console.error("   [Control Room] Hourly loads upsert error:", loadError.message);
  } else {
    console.log("   ✓ Hourly loads seeded successfully (12-hour day shift).");
  }

  // 2. Machine Operations
  const { data: op, error: opError } = await supabase
    .from("machine_operations")
    .upsert(
      {
        department_id: dept.id,
        machine_id: targetMachineId,
        shift_date: today,
        shift_type: "day",
        start_time: "06:00:00",
        end_time: "18:00:00",
      },
      { onConflict: "machine_id,shift_date,shift_type,start_time" }
    )
    .select("id")
    .single();

  if (opError) {
    console.error("   [Control Room] Machine operation upsert error:", opError.message);
  } else if (op) {
    console.log("   ✓ Machine operation seeded successfully.");
  }
}
