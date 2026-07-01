import { Suspense } from "react";
import dynamic from "next/dynamic";
import { getDepartmentContext, requireDepartment } from "~/lib/dept-context";
import { GlassCard } from "@repo/ui/GlassCard";

const MachineOperationsForm = dynamic(
  () => import("./MachineOperationsForm").then((m) => m.MachineOperationsForm),
  {
    loading: () => <div className="h-64 animate-pulse bg-[var(--bg-tertiary)] rounded-2xl" />,
  },
);

const MachineOperationsList = dynamic(
  () => import("./MachineOperationsList").then((m) => m.MachineOperationsList),
  {
    loading: () => (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse bg-[var(--bg-tertiary)] rounded-2xl" />
        ))}
      </div>
    ),
  },
);

const MachineOperationsComplianceWidget = dynamic(
  () =>
    import("./MachineOperationsComplianceWidget").then((m) => m.MachineOperationsComplianceWidget),
  {
    loading: () => <div className="h-20 animate-pulse bg-[var(--bg-tertiary)] rounded-2xl" />,
  },
);

export default async function MachineOperationsPage({
  params,
}: {
  params: Promise<{ department: string }>;
}) {
  const { department: deptSlug } = await params;
  requireDepartment(deptSlug, "control-room");
  const { deptId, supabase, today } = await getDepartmentContext({
    department: deptSlug,
  });

  // Parallel fetch of independent data
  const [
    { data: machines },
    { data: operators },
    { data: sites },
    { data: todayOperations },
    { data: todayLoads },
    { data: _delayCategories },
  ] = await Promise.all([
    supabase
      .from("machines")
      .select("id, name, machine_type, serial_number, active, bin_factor, site_id")
      .eq("active", true)
      .order("name"),
    supabase
      .from("operators")
      .select("id, full_name, employee_code")
      .eq("active", true)
      .order("full_name"),
    supabase.from("sites").select("id, name, site_code").eq("active", true).order("name"),
    supabase
      .from("machine_operations")
      .select(
        "*, machine:machines(name, bin_factor), operator:operators(full_name), site:sites(name), delay_entries:delay_entries(*, delay_category:delay_categories(*))",
      )
      .eq("department_id", deptId)
      .eq("shift_date", today)
      .order("start_time", { ascending: false }),
    supabase
      .from("hourly_loads")
      .select("machine_id, shift_type, total_loads")
      .eq("department_id", deptId)
      .eq("load_date", today),
    supabase
      .from("delay_categories")
      .select("id, name, description")
      .eq("is_active", true)
      .order("name"),
  ]);

  // Calculate today's totals
  const totalHours =
    todayOperations?.reduce((sum, op) => {
      return sum + (op.hours_worked || 0);
    }, 0) || 0;

  const activeMachines = new Set(todayOperations?.map((op) => op.machine_id)).size;

  // AGENT-TRACE: Calculate total delay hours across all operations
  const totalDelayHours =
    todayOperations?.reduce((sum, op) => {
      const operationDelays = (op as any).delay_entries || [];
      return (
        sum +
        operationDelays.reduce((delaySum: number, d: any) => delaySum + (d.duration_hours || 0), 0)
      );
    }, 0) || 0;

  // Calculate total material moved (BCM) - sum of (loads × bin_factor)
  let totalMaterialBCM = 0;
  todayOperations?.forEach((op) => {
    const binFactor = op.machine?.bin_factor || 0;
    // Find loads for this machine across both shifts
    const machineLoads =
      todayLoads
        ?.filter((l) => l.machine_id === op.machine_id)
        ?.reduce((sum, l) => sum + (l.total_loads || 0), 0) || 0;
    totalMaterialBCM += machineLoads * binFactor;
  });

  // Calculate average BCM/hour
  const avgBcmPerHour = totalHours > 0 ? totalMaterialBCM / totalHours : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-medium text-[var(--text-heading)]">Machine Operations</h2>
        <p className="text-[var(--text-muted)] text-sm">
          {new Date().toLocaleDateString("en-ZA", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <GlassCard>
          <p className="text-[var(--text-muted)] text-sm">Today&apos;s Hours</p>
          <p className="text-2xl font-medium text-[var(--text-heading)] mt-1">
            {totalHours.toFixed(1)}h
          </p>
        </GlassCard>
        <GlassCard>
          <p className="text-[var(--text-muted)] text-sm">Active Machines</p>
          <p className="text-2xl font-medium text-accent-green mt-1">{activeMachines}</p>
        </GlassCard>
        <GlassCard>
          <p className="text-[var(--text-muted)] text-sm">Material Moved</p>
          <p className="text-2xl font-medium text-[var(--accent-blue)] mt-1">
            {totalMaterialBCM.toFixed(1)} BCM
          </p>
        </GlassCard>
        <GlassCard>
          <p className="text-[var(--text-muted)] text-sm">BCM/Hour</p>
          <p className="text-2xl font-medium text-accent-blue mt-1">{avgBcmPerHour.toFixed(1)}</p>
        </GlassCard>
        <GlassCard>
          <p className="text-[var(--text-muted)] text-sm">Total Delays</p>
          <p className="text-2xl font-medium text-accent-red mt-1">{totalDelayHours.toFixed(1)}h</p>
        </GlassCard>
      </div>

      {/* Shift Coverage Compliance Widget */}
      <Suspense
        fallback={<div className="h-20 animate-pulse bg-[var(--bg-tertiary)] rounded-2xl" />}
      >
        <MachineOperationsComplianceWidget departmentId={deptId} departmentSlug={deptSlug} />
      </Suspense>

      {/* Add Operation Form */}
      <Suspense
        fallback={<div className="h-64 animate-pulse bg-[var(--bg-tertiary)] rounded-2xl" />}
      >
        <MachineOperationsForm
          departmentId={deptId}
          machines={machines || []}
          operators={operators || []}
          sites={sites || []}
          todayOperations={todayOperations || []}
        />
      </Suspense>

      {/* Today's Operations List */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-[var(--text-heading)]">Today&apos;s Operations</h3>
        <Suspense
          fallback={
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 animate-pulse bg-[var(--bg-tertiary)] rounded-2xl" />
              ))}
            </div>
          }
        >
          <MachineOperationsList operations={todayOperations || []} todayLoads={todayLoads || []} />
        </Suspense>
      </div>
    </div>
  );
}
