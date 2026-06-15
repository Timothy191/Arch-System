import { getDepartmentContext, requireDepartment } from "~/lib/dept-context";
import { BreakdownsDashboard } from "@/features/departments/components/engineering/breakdowns";
import type {
  Breakdown,
  BreakdownMetrics,
  Machine,
} from "@/features/departments/components/engineering/breakdowns";

export default async function BreakdownsPage({
  params,
}: {
  params: Promise<{ department: string }>;
}) {
  const { department: deptSlug } = await params;
  requireDepartment(deptSlug, "engineering");
  const { deptId, supabase, today } = await getDepartmentContext({
    department: deptSlug,
  });

  // Fetch all non-deleted breakdowns
  const { data: breakdowns } = await supabase
    .from("breakdowns")
    .select("*, machine_name")
    .eq("department_id", deptId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(200);

  // Fetch active machines (centralised fleet)
  const { data: machines } = await supabase
    .from("machines")
    .select("id, name, machine_type, serial_number, active")
    .eq("active", true)
    .order("name");

  // Compute metrics
  const allBreakdowns = (breakdowns ?? []) as Breakdown[];
  const active = allBreakdowns.filter((b) => b.status === "active").length;
  const completedToday = allBreakdowns.filter(
    (b) => b.status === "completed" && b.date_out === today,
  ).length;

  // Avg repair time for completed breakdowns
  let totalRepairHours = 0;
  let completedCount = 0;
  for (const b of allBreakdowns) {
    if (b.status === "completed" && b.date_out && b.time_out) {
      const start = new Date(`${b.date_in}T${b.time_in}`);
      const end = new Date(`${b.date_out}T${b.time_out}`);
      const diffHours = (end.getTime() - start.getTime()) / 3600000;
      if (diffHours > 0) {
        totalRepairHours += diffHours;
        completedCount++;
      }
    }
  }

  const metrics: BreakdownMetrics = {
    total: allBreakdowns.length,
    active,
    completedToday,
    avgRepairHours: completedCount > 0 ? totalRepairHours / completedCount : 0,
  };

  return (
    <BreakdownsDashboard
      departmentId={deptId}
      breakdowns={allBreakdowns}
      metrics={metrics}
      machines={(machines ?? []) as Machine[]}
    />
  );
}
