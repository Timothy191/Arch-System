import type { SupabaseClient } from "@supabase/supabase-js";

export async function seedGeology(supabase: SupabaseClient): Promise<void> {
  console.log("--> Seeding Geology & Satellite Monitoring department data...");

  // Try finding satellite-monitoring first, or fallback to geology
  let { data: dept } = await supabase
    .from("departments")
    .select("id, name")
    .eq("name", "satellite-monitoring")
    .single();

  if (!dept) {
    const { data: fallbackDept } = await supabase
      .from("departments")
      .select("id, name")
      .ilike("name", "%geolog%")
      .limit(1)
      .single();
    dept = fallbackDept;
  }

  if (!dept) {
    console.error("   [Geology] Satellite monitoring / geology department not found.");
    return;
  }

  const today = new Date().toISOString().split("T")[0];
  const refDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const deformations = [
    {
      department_id: dept.id,
      satellite_name: "Sentinel-1",
      acquisition_date: today,
      reference_date: refDate,
      location_name: "Pit A - Highwall North",
      latitude: -23.451200,
      longitude: 148.125400,
      displacement_mm: -2.35,
      coherence_index: 0.895,
      risk_level: "minor",
      cog_url: "https://assets.plantcor.internal/cog/insar-pit-a-north.tif",
    },
    {
      department_id: dept.id,
      satellite_name: "TerraSAR-X",
      acquisition_date: today,
      reference_date: refDate,
      location_name: "Tailings Facility West Embankment",
      latitude: -23.468900,
      longitude: 148.140200,
      displacement_mm: -0.85,
      coherence_index: 0.940,
      risk_level: "none",
      cog_url: "https://assets.plantcor.internal/cog/insar-tailings-west.tif",
    },
    {
      department_id: dept.id,
      satellite_name: "Capella",
      acquisition_date: today,
      reference_date: refDate,
      location_name: "Waste Dump South Crest",
      latitude: -23.473500,
      longitude: 148.118900,
      displacement_mm: -6.40,
      coherence_index: 0.812,
      risk_level: "moderate",
      cog_url: "https://assets.plantcor.internal/cog/insar-dump-south.tif",
    },
  ];

  const { error: insarError } = await supabase
    .from("satellite_deformations")
    .insert(deformations);

  if (insarError) {
    console.warn("   [Geology] Satellite deformations insert note:", insarError.message);
  } else {
    console.log(`   ✓ Seeded ${deformations.length} InSAR satellite radar deformation zones.`);
  }
}
