import type { SupabaseClient } from "@supabase/supabase-js";

export async function seedProduction(supabase: SupabaseClient): Promise<void> {
  console.log("--> Seeding Production & Processing department data...");

  const { data: dept, error: deptError } = await supabase
    .from("departments")
    .select("id")
    .eq("name", "production")
    .single();

  if (deptError || !dept) {
    console.error("   [Production] Department not found in database.");
    return;
  }

  const today = new Date().toISOString().split("T")[0];

  // 1. Seed / Upsert Daily Log
  const { data: dailyLog, error: logError } = await supabase
    .from("daily_logs")
    .upsert(
      {
        department_id: dept.id,
        log_date: today,
        shift: "day",
        notes: "High-tonnage extraction shift on Pit-A Upper Seam.",
      },
      { onConflict: "department_id,log_date,shift" }
    )
    .select("id")
    .single();

  if (logError || !dailyLog) {
    console.error("   [Production] Daily log upsert error:", logError?.message);
    return;
  }
  console.log("   ✓ Daily log seeded for current shift.");

  // 2. Seed / Upsert Production Yield Logs
  const { error: prodError } = await supabase.from("production_logs").insert([
    {
      daily_log_id: dailyLog.id,
      coal_tonnes: 4250.75,
      waste_tonnes: 9820.50,
    },
  ]);

  if (prodError) {
    console.warn("   [Production] Production logs insert note:", prodError.message);
  } else {
    console.log("   ✓ Production extraction yield logs seeded (4,250t coal / 9,820t waste).");
  }

  // 3. Seed Material Densities if table exists
  const { error: densityError } = await supabase.from("material_density").upsert(
    [
      { material_type: "Coal (ROM)", density_t_per_m3: 1.32, active: true },
      { material_type: "Overburden (Sandstone)", density_t_per_m3: 2.45, active: true },
      { material_type: "Interburden (Shale)", density_t_per_m3: 2.20, active: true },
    ],
    { onConflict: "material_type" }
  );

  if (!densityError) {
    console.log("   ✓ Material density calibration parameters verified.");
  }
}
