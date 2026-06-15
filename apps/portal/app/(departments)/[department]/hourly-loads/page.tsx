import { getDepartmentContext, requireDepartment } from "~/lib/dept-context";
import { KPIGrid, KPICard } from "@repo/ui/KPI";
import { PageHeader } from "@repo/ui/PageHeader";
import { HourlyLoadsGrid } from "./HourlyLoadsGrid";

export default async function HourlyLoadsPage({
  params,
}: {
  params: Promise<{ department: string }>;
}) {
  const { department } = await params;
  requireDepartment(department, "control-room");

  const { deptId, supabase, today } = await getDepartmentContext({
    department,
  });

  // Fetch dump trucks with bin_factor (centralised fleet)
  const { data: machines } = await supabase
    .from("machines")
    .select("id, name, machine_type, bin_factor, site_id, sites(name)")
    .eq("machine_type", "Dump Truck")
    .eq("active", true)
    .order("name");

  // Fetch today's hourly loads
  const { data: hourlyLoads } = await supabase
    .from("hourly_loads")
    .select("*")
    .eq("department_id", deptId)
    .eq("load_date", today);

  // Fetch active sites
  const { data: sites } = await supabase
    .from("sites")
    .select("id, name, site_code")
    .eq("active", true)
    .order("name");

  // Calculate totals
  const loadsByMachine = new Map();
  let grandTotal = 0;

  hourlyLoads?.forEach((load) => {
    loadsByMachine.set(load.machine_id, load.total_loads);
    grandTotal += load.total_loads || 0;
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Hourly Loads Sheet" />

      <KPIGrid cols={3}>
        <KPICard
          label="Total Loads Today"
          value={grandTotal.toLocaleString()}
          color="green"
        />
        <KPICard
          label="Machines Active"
          value={loadsByMachine.size}
          color="green"
        />
        <KPICard
          label="Avg Loads per Machine"
          value={
            loadsByMachine.size > 0
              ? Math.round(grandTotal / loadsByMachine.size)
              : 0
          }
        />
      </KPIGrid>

      <HourlyLoadsGrid
        departmentId={deptId}
        machines={machines || []}
        hourlyLoads={hourlyLoads || []}
        sites={sites || []}
      />

      <div className="flex items-center gap-6 text-xs text-[var(--text-muted)]">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-[var(--accent-cyan)]/20 border border-[var(--accent-cyan)]"></span>
          <span>Active hour with loads</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-[var(--bg-secondary)] border border-[var(--border-default)]"></span>
          <span>No loads recorded</span>
        </div>
        <p className="ml-auto">
          Tip: Click any cell to edit load count. Auto-saves on change.
        </p>
      </div>
    </div>
  );
}
