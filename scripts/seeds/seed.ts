import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env" });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing Supabase credentials in .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function run() {
  console.log("Calling reload_schema_cache RPC...");
  const { data, error } = await supabase.rpc("reload_schema_cache");
  if (error) {
    console.error("RPC failed:", error);
    // If RPC doesn't exist, we fallback to just seeding
  } else {
    console.log("Schema cache reloaded via RPC!");
  }

  const { data: dept } = await supabase
    .from("departments")
    .select("id")
    .eq("name", "control-room")
    .single();

  if (!dept) {
    console.error("Control room department not found");
    return;
  }

  const { data: machine } = await supabase
    .from("machines")
    .select("id")
    .eq("department_id", dept.id)
    .limit(1)
    .single();

  if (!machine) {
    console.error("No machines found for control room");
    return;
  }

  const today = new Date().toISOString().split("T")[0];
  const { error: loadError } = await supabase.from("hourly_loads").insert([
    {
      department_id: dept.id,
      machine_id: machine.id,
      load_date: today,
      hour_label: "08:00",
      total_loads: 45,
    },
    {
      department_id: dept.id,
      machine_id: machine.id,
      load_date: today,
      hour_label: "09:00",
      total_loads: 50,
    },
  ]);

  if (loadError) console.error("Error inserting loads:", loadError);
  else console.log("Mock loads inserted successfully!");

  const { data: op, error: opError } = await supabase
    .from("machine_operations")
    .insert({
      department_id: dept.id,
      machine_id: machine.id,
      shift_date: today,
      shift_type: "day", // CHANGED FROM shift -> shift_type!
      operator_id: null,
      start_time: `${today}T06:00:00Z`,
      hours_worked: 5.5,
    })
    .select()
    .single();

  if (opError) {
    console.error("Error inserting machine operation:", opError);
  } else if (op) {
    console.log("Mock machine operation inserted successfully!");

    const { error: delayError } = await supabase.from("delay_entries").insert({
      department_id: dept.id,
      machine_id: machine.id,
      machine_operation_id: op.id,
      delay_start_time: `${today}T10:00:00Z`,
      delay_end_time: `${today}T11:00:00Z`,
      duration_hours: 1.0,
      status: "committed",
    });

    if (delayError) console.error("Error inserting delay entry:", delayError);
    else console.log("Mock delay entry inserted successfully!");
  }
}

run();
