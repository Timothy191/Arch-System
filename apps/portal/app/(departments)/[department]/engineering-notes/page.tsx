import { getDepartmentContext, requireDepartment } from "~/lib/dept-context";
import { KPIGrid, KPICard } from "@repo/ui/KPI";
import { PageHeader } from "@repo/ui/PageHeader";
import { EngineeringNotesForm } from "./EngineeringNotesForm";
import { EngineeringNotesList } from "./EngineeringNotesList";
import { PredictiveAlertsWidget } from "./PredictiveAlertsWidget";

export default async function EngineeringNotesPage({
  params,
}: {
  params: Promise<{ department: string }>;
}) {
  const { department } = await params;
  requireDepartment(department, "control-room");

  const { deptId, supabase, today } = await getDepartmentContext({
    department,
  });

  // AGENT-TRACE: Use the secure view breakdowns_control_room_view instead of querying
  // the base breakdowns table directly. This view filters to only show breakdowns that:
  // 1. Are shared with Control Room (via shared_with_departments)
  // 2. Are either active or completed today
  // 3. Only exposes required fields (no repair_notes, created_by, etc.)
  // The view is read-only and enforced by RLS policies on the base table.
  const [{ data: machines }, { data: todayNotes }, { data: engBreakdowns }] = await Promise.all([
    supabase.from("machines").select("id, name, machine_type").eq("active", true).order("name"),
    supabase
      .from("engineering_notes")
      .select("*, machine:machines(name, sites(name))")
      .eq("department_id", deptId)
      .eq("note_date", today)
      .order("created_at", { ascending: false }),
    supabase
      .from("breakdowns_control_room_view")
      .select("*")
      .order("created_at", { ascending: false }),
  ]);

  // Calculate statistics
  const criticalCount = todayNotes?.filter((n) => n.severity === "critical").length || 0;
  const openCount =
    todayNotes?.filter((n) => n.status === "open" || n.status === "in_progress").length || 0;
  const resolvedCount = todayNotes?.filter((n) => n.status === "resolved").length || 0;
  const followUpCount = todayNotes?.filter((n) => n.requires_follow_up).length || 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Engineering Notes" />

      <PredictiveAlertsWidget />

      <KPIGrid cols={4}>
        <KPICard label="Critical" value={criticalCount} color="red" />
        <KPICard label="Open" value={openCount} color="blue" />
        <KPICard label="Resolved" value={resolvedCount} color="green" />
        <KPICard label="Follow-up" value={followUpCount} color="blue" />
      </KPIGrid>

      <EngineeringNotesForm
        departmentId={deptId}
        machines={machines || []}
        breakdownDrafts={engBreakdowns || []}
      />

      <div className="space-y-4">
        <h3 className="text-lg font-medium text-[var(--text-heading)]">
          Today&apos;s Engineering Issues
        </h3>
        <EngineeringNotesList notes={todayNotes || []} />
      </div>
    </div>
  );
}
