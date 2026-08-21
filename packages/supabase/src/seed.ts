/* eslint-disable no-console */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://mrwhtxbhrzyttlsyuofc.supabase.co";
const SUPABASE_SERVICE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yd2h0eGJocnp5dHRsc3l1b2ZjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Njc3NzA4MywiZXhwIjoyMTAyMzUzMDgzfQ.iPXzOvs8RanPA5hI33f8x2_ThgR7h72E41vRHDxkOh8";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

async function main() {
  console.log("Seeding 20 days of realistic data...");
  // 1. Fetch or create a department
  let { data: depts, error: deptError } = await supabase.from("departments").select("id, name");
  if (deptError) console.error("Error fetching depts:", deptError);

  let deptId = depts?.find((d) => d.name === "drilling")?.id;

  if (!deptId && depts && depts.length > 0 && depts[0]) {
    deptId = depts[0].id;
  }

  if (!deptId) {
    throw new Error("No departments found and insert failed");
  }

  // 2. Create Machines
  const machines = [
    {
      name: "DRILL-01",
      machine_type: "Drill",
      serial_number: "DR-001",
      bin_factor: 1.2,
      active: true,
      department_id: deptId,
    },
    {
      name: "DRILL-02",
      machine_type: "Drill",
      serial_number: "DR-002",
      bin_factor: 1.2,
      active: true,
      department_id: deptId,
    },
    {
      name: "EXC-01",
      machine_type: "Excavator",
      serial_number: "EX-001",
      bin_factor: 2.5,
      active: true,
      department_id: deptId,
    },
  ];

  let { data: existingMachines } = await supabase
    .from("machines")
    .select("*")
    .eq("department_id", deptId);
  if (!existingMachines || existingMachines.length === 0) {
    const { data: newMachines, error: machineErr } = await supabase
      .from("machines")
      .insert(machines)
      .select();
    if (machineErr) console.error("Machine error:", machineErr);
    existingMachines = newMachines;
  }
  const insertedMachines = existingMachines;

  // 3. Create Employees/Operators
  const operators = [
    { full_name: "John Operator", employee_code: "OP-001", active: true },
    { full_name: "Jane Driller", employee_code: "OP-002", active: true },
  ];
  const { data: insertedOperators, error: opErr } = await supabase
    .from("operators")
    .upsert(operators, { onConflict: "employee_code" })
    .select();
  if (opErr) console.error("Operator error:", opErr);

  // 4. Create a Site
  const { data: sites, error: siteErr } = await supabase
    .from("sites")
    .upsert([{ name: "North Pit", site_code: "NP-01", active: true }], { onConflict: "site_code" })
    .select();
  if (siteErr) console.error("Site error:", siteErr);
  const siteId = sites?.[0]?.id;

  if (!insertedMachines || !insertedOperators || !sites) {
    throw new Error("Failed to insert required base data");
  }

  // 5. Generate 20 days of operations and breakdowns
  const msPerDay = 24 * 60 * 60 * 1000;
  const now = new Date();

  for (let i = 0; i < 20; i++) {
    const date = new Date(now.getTime() - i * msPerDay);
    const dateStr = date.toISOString().split("T")[0];

    // Add daily log so foreign keys pass
    let { data: dailyLog, error: dailyLogErr } = await supabase
      .from("daily_logs")
      .upsert(
        {
          department_id: deptId,
          log_date: dateStr,
          shift: "day",
        },
        { onConflict: "department_id, log_date, shift" },
      )
      .select()
      .single();
    if (dailyLogErr) console.error("Daily log error:", dailyLogErr);

    if (!dailyLog) continue;

    for (const machine of insertedMachines) {
      // 50% chance of being active
      if (Math.random() > 0.5) {
        await supabase.from("machine_operations").insert({
          daily_log_id: dailyLog.id,
          daily_log_date: dateStr,
          department_id: deptId,
          machine_id: machine.id,
          operator_id: insertedOperators[0].id,
          site_id: siteId,
          shift_date: dateStr,
          shift_type: "day",
          start_time: "06:00:00",
          end_time: "18:00:00",
          hours_worked: 12,
        });

        await supabase.from("hourly_loads").insert({
          department_id: deptId,
          machine_id: machine.id,
          load_date: dateStr,
          shift_type: "day",
          total_loads: Math.floor(Math.random() * 50) + 10,
        });
      }

      // 10% chance of a breakdown
      if (Math.random() < 0.1) {
        await supabase.from("breakdowns").insert({
          department_id: deptId,
          fleet_id: machine.serial_number, // Matching serial_number!
          machine_type: machine.machine_type,
          date_in: dateStr,
          time_in: "08:00:00",
          reason: "Hydraulic leak on main arm",
          repair_notes: "Replaced O-rings and refilled fluid.",
          status: i === 0 ? "active" : "completed", // If today, active
          date_out: i === 0 ? null : dateStr,
        });
      }
    }
  }

  // Guarantee one active breakdown today for testing!
  const todayStr = now.toISOString().split("T")[0];
  await supabase.from("breakdowns").insert({
    department_id: deptId,
    fleet_id: insertedMachines[0].serial_number,
    machine_type: insertedMachines[0].machine_type,
    date_in: todayStr,
    time_in: "07:00:00",
    reason: "Engine won't start",
    repair_notes: "Waiting on electrical team to diagnose alternator.",
    status: "active",
  });

  // Make sure the machine has operations today
  let { data: todayLog, error: todayLogErr } = await supabase
    .from("daily_logs")
    .upsert(
      {
        department_id: deptId,
        log_date: todayStr,
        shift: "day",
      },
      { onConflict: "department_id, log_date, shift" },
    )
    .select()
    .single();
  if (todayLogErr) console.error("Today log error:", todayLogErr);

  if (todayLog) {
    await supabase.from("machine_operations").insert({
      daily_log_id: todayLog.id,
      daily_log_date: todayStr,
      department_id: deptId,
      machine_id: insertedMachines[0].id,
      operator_id: insertedOperators[0].id,
      site_id: siteId,
      shift_date: todayStr,
      shift_type: "day",
      start_time: "06:00:00",
      hours_worked: 1, // In progress
    });
  }

  console.log("Data generated successfully!");
}

main().catch(console.error);
