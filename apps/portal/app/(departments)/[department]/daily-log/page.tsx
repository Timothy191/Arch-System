import { getDepartmentContext } from "~/lib/dept-context";
import { DailyLogForm } from "./DailyLogForm";
import { SafetyIncidentForm } from "@/features/departments/components/safety/SafetyIncidentForm";
import { SafetyIncidentsList } from "@/features/departments/components/safety/SafetyIncidentsList";
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

  const isSafety = department === "safety";

  if (isSafety) {
    // Parallel fetch of independent safety reference data and incidents
    const [
      { data: categories },
      { data: severities },
      { data: todayIncidents },
    ] = await Promise.all([
      supabase
        .from("safety_incident_categories")
        .select("id, name, color, icon")
        .order("sort_order"),
      supabase
        .from("safety_severities")
        .select("id, level, color")
        .order("sort_order"),
      supabase
        .from("safety_incidents")
        .select(
          "id, incident_type, severity_id, severity:safety_severities(color), category:safety_incident_categories(name), description, location, injured_parties, status, shift_type, created_at",
        )
        .eq("department_id", deptId)
        .eq("incident_date", today)
        .order("created_at", { ascending: false }),
    ]);

    const formattedIncidents = (todayIncidents || []).map((inc: any) => ({
      ...inc,
      severity_color: Array.isArray(inc.severity)
        ? inc.severity[0]?.color
        : inc.severity?.color,
      category_name: Array.isArray(inc.category)
        ? inc.category[0]?.name
        : inc.category?.name,
    }));

    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-medium text-[var(--text-heading)]">
          Safety Daily Log
        </h2>

        {formattedIncidents.length > 0 && (
          <GlassCard className="border-accent-blue/20">
            <p className="text-accent-blue text-sm font-medium">
              {formattedIncidents.length} incident
              {formattedIncidents.length > 1 ? "s" : ""} logged today
            </p>
          </GlassCard>
        )}

        <SafetyIncidentForm
          departmentId={deptId}
          categories={categories || []}
          severities={severities || []}
        />

        <div className="space-y-4">
          <h3 className="text-lg font-medium text-[var(--text-heading)]">
            Today&apos;s Incidents
          </h3>
          <SafetyIncidentsList incidents={formattedIncidents} />
        </div>
      </div>
    );
  }

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

  const existingShifts = (todayLogs || []).map(
    (l) => l.shift as "day" | "night",
  );
  const allShiftsLogged = existingShifts.length >= 2;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-medium text-[var(--text-heading)]">
        Daily Log
      </h2>

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
                {existingShifts.length > 1 ? "s" : ""} already logged:{" "}
                {existingShifts.join(", ")}
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
