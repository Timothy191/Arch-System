import { getDepartmentContext } from "~/lib/dept-context";
import { DailyLogForm } from "./DailyLogForm";
import { GlassCard } from "@repo/ui/GlassCard";

export default async function DailyLogPage({
  params,
}: {
  params: Promise<{ department: string }>;
}) {
  const { department } = await params;
  const { deptId, supabase, today } = await getDepartmentContext({
    department,
  });

  // Standard daily log for non-safety departments (centralised fleet)
  const { data: machines } = await supabase
    .from("machines")
    .select("id, name, machine_type")
    .eq("active", true)
    .order("name");

  const { data: todayLogs } = await supabase
    .from("daily_logs")
    .select("id, shift, notes")
    .eq("department_id", deptId)
    .eq("log_date", today);

  const existingShifts = (todayLogs || []).map((l) => l.shift as "day" | "night");
  const allShiftsLogged = existingShifts.length >= 2;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-medium text-[var(--text-heading)]">Daily Log</h2>

      {allShiftsLogged ? (
        <GlassCard className="border-accent-green/20">
          <p className="text-accent-green text-sm font-medium">
            &#10003; All shifts logged for today
          </p>
          <p className="text-[var(--text-secondary)] text-sm mt-1">
            <a
              href={`/${department}/history`}
              className="text-[var(--accent-cyan)] hover:underline"
            >
              View History
            </a>
          </p>
        </GlassCard>
      ) : (
        <>
          {existingShifts.length > 0 && (
            <GlassCard className="border-accent-blue/20">
              <p className="text-accent-blue text-sm font-medium">
                {existingShifts.length} shift
                {existingShifts.length > 1 ? "s" : ""} already logged: {existingShifts.join(", ")}
              </p>
            </GlassCard>
          )}
          <DailyLogForm
            departmentId={deptId}
            departmentSlug={department}
            machines={machines || []}
          />
        </>
      )}
    </div>
  );
}
