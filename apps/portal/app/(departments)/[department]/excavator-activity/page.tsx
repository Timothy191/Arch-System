import { getDepartmentContext, requireDepartment } from "~/lib/dept-context";
import { KPIGrid, KPICard } from "@repo/ui/KPI";
import { PageHeader } from "@repo/ui/PageHeader";
import { ExcavatorActivityForm } from "./ExcavatorActivityForm";
import { ExcavatorActivityList } from "./ExcavatorActivityList";

export const revalidate = 0;

export default async function ExcavatorActivityPage({
  params,
}: {
  params: Promise<{ department: string }>;
}) {
  const { department: deptSlug } = await params;
  requireDepartment(deptSlug, "control-room");

  const { deptId, supabase, today } = await getDepartmentContext({
    department: deptSlug,
  });

  // Parallel fetch of independent reference data and today's activity
  const [
    { data: excavators },
    { data: dumpers },
    { data: operators },
    { data: sites },
    { data: mineBlocks },
    { data: todayActivity },
  ] = await Promise.all([
    supabase
      .from("machines")
      .select("id, name, machine_type, serial_number, active")
      .eq("machine_type", "Excavator")
      .eq("active", true)
      .order("name"),
    supabase
      .from("machines")
      .select(
        "id, name, machine_type, serial_number, active, bin_factor, site_id",
      )
      .eq("machine_type", "Dump Truck")
      .eq("active", true)
      .order("name"),
    supabase
      .from("operators")
      .select("id, full_name, employee_code")
      .eq("active", true)
      .order("full_name"),
    supabase
      .from("sites")
      .select("id, name, site_code, active")
      .eq("active", true)
      .order("name"),
    supabase
      .from("mine_blocks")
      .select("id, name, code, site_id, active")
      .eq("active", true)
      .order("name"),
    supabase
      .from("excavator_activity")
      .select(
        "*, machine:machines(name), operator:operators(full_name), site:sites(name), block_mined:mine_blocks(name, code)",
      )
      .eq("department_id", deptId)
      .eq("activity_date", today)
      .order("created_at", { ascending: false }),
  ]);

  // Fetch today's dumper assignments via excavator_activity IDs
  const activityIds = todayActivity?.map((a) => a.id) || [];
  let todayAssignments: Array<{
    id: string;
    excavator_activity_id: string;
    dumper_machine_id: string;
    material_type: string;
    total_loads: number;
    total_bcm: number | null;
    notes: string | null;
    dumper: {
      name: string;
      bin_factor: number | null;
      machine_type: string;
    } | null;
  }> = [];

  // Fetch assignments and hourly loads in parallel (loads don't depend on assignments)
  const [{ data: assignments }, { data: todayLoads }] = await Promise.all([
    activityIds.length > 0
      ? supabase
          .from("excavator_dumper_assignments")
          .select(
            "*, dumper:machines!dumper_machine_id(name, bin_factor, machine_type)",
          )
          .in("excavator_activity_id", activityIds)
      : Promise.resolve({ data: [] }),
    supabase
      .from("hourly_loads")
      .select("machine_id, shift_type, total_loads")
      .eq("department_id", deptId)
      .eq("load_date", today),
  ]);
  todayAssignments = assignments || [];

  // Compute KPIs
  const totalLoads =
    todayAssignments?.reduce((sum, a) => sum + (a.total_loads || 0), 0) || 0;
  const totalBcm =
    todayAssignments?.reduce((sum, a) => sum + (a.total_bcm || 0), 0) || 0;
  const activeExcavators = new Set(todayActivity?.map((a) => a.machine_id))
    .size;

  return (
    <div className="space-y-6">
      <PageHeader title="Excavator Activity" />

      <KPIGrid cols={3}>
        <KPICard label="Total BCM" value={totalBcm.toFixed(1)} color="green" />
        <KPICard
          label="Total Loads"
          value={totalLoads.toLocaleString()}
          color="green"
        />
        <KPICard
          label="Active Excavators"
          value={activeExcavators}
          color="cyan"
        />
      </KPIGrid>

      <ExcavatorActivityForm
        departmentId={deptId}
        excavators={excavators || []}
        dumpers={dumpers || []}
        operators={operators || []}
        sites={sites || []}
        mineBlocks={mineBlocks || []}
        todayDumperLoads={todayLoads || []}
      />

      {todayActivity && todayActivity.length > 0 && (
        <ExcavatorActivityList
          todayActivity={todayActivity}
          todayAssignments={todayAssignments || []}
        />
      )}
    </div>
  );
}
