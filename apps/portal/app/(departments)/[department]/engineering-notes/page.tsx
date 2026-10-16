import { KPICard, KPIGrid } from '@repo/ui/KPI';
import { PageHeader } from '@repo/ui/PageHeader';
import type { BreakdownControlRoomView } from '@/features/departments';
import { getDepartmentContext, requireDepartment } from '~/lib/dept-context';
import { EngineeringNotesForm } from './EngineeringNotesForm';
import { type EngineeringNote, EngineeringNotesList } from './EngineeringNotesList';
import { PredictiveAlertsWidget } from './PredictiveAlertsWidget';

interface BreakdownRow {
  id: string;
  fleet_id: string;
  machine_name: string | null;
  machine_type: string;
  reason: string;
  repair_notes?: string | null;
  date_in: string;
  time_in: string;
  date_out: string | null;
  time_out?: string | null;
  status: 'active' | 'completed';
  created_at: string;
}

interface TireInspectionRow {
  id: string;
  inspection_date: string;
  tread_depth_mm: number;
  pressure_psi: number;
  condition_status: 'good' | 'warning' | 'critical';
  notes: string | null;
  created_at: string;
  tire?:
    | {
        serial_number: string;
        position: string;
        machine?:
          | {
              name: string;
              sites?: { name: string }[] | { name: string } | null;
            }
          | {
              name: string;
              sites?: { name: string }[] | { name: string } | null;
            }[]
          | null;
      }
    | {
        serial_number: string;
        position: string;
        machine?:
          | {
              name: string;
              sites?: { name: string }[] | { name: string } | null;
            }
          | {
              name: string;
              sites?: { name: string }[] | { name: string } | null;
            }[]
          | null;
      }[]
    | null;
}

function inferShiftFromTime(timeStr: string | null | undefined): 'day' | 'night' {
  if (!timeStr) return 'day';
  const hour = Number.parseInt(timeStr.slice(0, 2), 10);
  if (Number.isNaN(hour)) return 'day';
  return hour >= 6 && hour < 18 ? 'day' : 'night';
}

function inferBreakdownIssueType(reason: string, machineType: string): string {
  const combined = `${reason} ${machineType}`.toLowerCase();
  if (
    combined.includes('electric') ||
    combined.includes('alternator') ||
    combined.includes('starter') ||
    combined.includes('sensor') ||
    combined.includes('wiring')
  ) {
    return 'electrical';
  }
  if (
    combined.includes('hydraul') ||
    combined.includes('hose') ||
    combined.includes('pump') ||
    combined.includes('cylinder') ||
    combined.includes('seal')
  ) {
    return 'hydraulic';
  }
  if (
    combined.includes('frame') ||
    combined.includes('chassis') ||
    combined.includes('bucket') ||
    combined.includes('blade') ||
    combined.includes('boom')
  ) {
    return 'structural';
  }
  return 'mechanical';
}

export default async function EngineeringNotesPage({
  params,
}: {
  params: Promise<{ department: string }>;
}) {
  const { department } = await params;
  requireDepartment(department, 'control-room');

  const { deptId, supabase, today } = await getDepartmentContext({
    department,
  });

  const [
    { data: machines },
    { data: engDept },
    { data: todayNotes },
    { data: directBreakdowns },
    { data: viewBreakdowns },
    { data: todayTireInspections },
  ] = await Promise.all([
    supabase
      .from('machines')
      .select('id, name, machine_type, serial_number, sites(name)')
      .eq('active', true)
      .order('name'),
    supabase.from('departments').select('id').eq('name', 'engineering').maybeSingle(),
    supabase
      .from('engineering_notes')
      .select('*, machine:machines(name, sites(name))')
      .or(`note_date.eq.${today},status.in.(open,in_progress)`)
      .order('created_at', { ascending: false }),
    supabase
      .from('breakdowns')
      .select(
        'id, fleet_id, machine_name, machine_type, reason, repair_notes, date_in, time_in, date_out, time_out, status, created_at'
      )
      .is('deleted_at', null)
      .or(`status.eq.active,date_in.eq.${today},date_out.eq.${today}`)
      .order('created_at', { ascending: false }),
    supabase
      .from('breakdowns_control_room_view')
      .select('*')
      .order('created_at', { ascending: false }),
    supabase
      .from('tire_inspections')
      .select(
        'id, inspection_date, tread_depth_mm, pressure_psi, condition_status, notes, created_at, tire:tires(serial_number, position, machine:machines(name, sites(name)))'
      )
      .eq('inspection_date', today)
      .order('created_at', { ascending: false }),
  ]);

  const { data: engDailyLogs } = engDept?.id
    ? await supabase
        .from('daily_logs')
        .select('id, log_date, shift, notes, created_at')
        .eq('department_id', engDept.id)
        .eq('log_date', today)
        .order('created_at', { ascending: false })
    : {
        data: null as Array<{
          id: string;
          log_date: string;
          shift: string;
          notes: string | null;
          created_at: string;
        }> | null,
      };

  // Merge and deduplicate breakdowns from base table and shared view
  const breakdownMap = new Map<string, BreakdownRow>();
  for (const bd of (directBreakdowns || []) as BreakdownRow[]) {
    breakdownMap.set(bd.id, bd);
  }
  for (const bd of (viewBreakdowns || []) as BreakdownControlRoomView[]) {
    if (!breakdownMap.has(bd.id)) {
      breakdownMap.set(bd.id, {
        id: bd.id,
        fleet_id: bd.fleet_id,
        machine_name: bd.machine_name,
        machine_type: bd.machine_type,
        reason: bd.reason,
        repair_notes: null,
        date_in: bd.date_in,
        time_in: bd.time_in,
        date_out: bd.date_out,
        time_out: null,
        status: bd.status,
        created_at: bd.created_at,
      });
    }
  }
  const mergedBreakdowns = Array.from(breakdownMap.values());

  const breakdownDrafts: BreakdownControlRoomView[] = mergedBreakdowns.map((bd) => ({
    id: bd.id,
    fleet_id: bd.fleet_id,
    machine_name: bd.machine_name,
    machine_type: bd.machine_type,
    reason: bd.reason,
    date_in: bd.date_in,
    time_in: bd.time_in,
    date_out: bd.date_out,
    status: bd.status,
    created_at: bd.created_at,
  }));

  const noteItems: EngineeringNote[] = ((todayNotes || []) as EngineeringNote[]).map((n) => ({
    ...n,
    source: 'engineering_note' as const,
  }));

  // Convert Engineering breakdowns into unified EngineeringNote feed items (unless already copied as a note)
  const breakdownItems: EngineeringNote[] = mergedBreakdowns
    .filter(
      (bd) =>
        !noteItems.some(
          (n) =>
            n.description.includes(`[${bd.fleet_id}]`) &&
            n.description.toLowerCase().includes(bd.reason.toLowerCase())
        )
    )
    .map((bd) => {
      const matchedMachine = (machines || []).find(
        (m) =>
          m.id === bd.fleet_id ||
          m.serial_number === bd.fleet_id ||
          (bd.machine_name && m.name.toLowerCase() === bd.machine_name.toLowerCase()) ||
          m.name.toLowerCase() === bd.fleet_id.toLowerCase()
      );
      return {
        id: `breakdown-${bd.id}`,
        shift_type: inferShiftFromTime(bd.time_in),
        issue_type: inferBreakdownIssueType(bd.reason, bd.machine_type),
        severity: bd.status === 'active' ? 'high' : 'medium',
        machine_id: matchedMachine?.id ?? null,
        description: `[${bd.fleet_id}] ${bd.reason} (${bd.machine_type} · In: ${bd.date_in} ${bd.time_in?.slice(0, 5) || ''})`,
        action_taken:
          bd.repair_notes ||
          (bd.status === 'completed'
            ? `Repair completed${bd.date_out ? ` on ${bd.date_out}` : ''}${bd.time_out ? ` at ${bd.time_out.slice(0, 5)}` : ''}`
            : 'Active Engineering breakdown — repair in progress'),
        requires_follow_up: bd.status === 'active',
        status: bd.status === 'active' ? 'open' : 'resolved',
        created_at: bd.created_at,
        source: 'breakdown' as const,
        machine: matchedMachine
          ? { name: matchedMachine.name, sites: matchedMachine.sites }
          : { name: bd.machine_name || bd.fleet_id, sites: null },
      };
    });

  // Convert Engineering daily shift logs into activity items
  const dailyLogItems: EngineeringNote[] = (engDailyLogs || [])
    .filter((dl) => Boolean(dl.notes?.trim()))
    .map((dl) => ({
      id: `eng-daily-log-${dl.id}`,
      shift_type: dl.shift === 'night' ? 'night' : 'day',
      issue_type: 'activity',
      severity: 'medium',
      machine_id: null,
      description: dl.notes!.trim(),
      action_taken: `Logged by Engineering Department (${dl.shift.toUpperCase()} Shift Log)`,
      requires_follow_up: false,
      status: 'open',
      created_at: dl.created_at,
      source: 'engineering_activity' as const,
      machine: null,
    }));

  // Convert Engineering tire inspections into activity items
  const tireInspectionItems: EngineeringNote[] = (
    (todayTireInspections || []) as TireInspectionRow[]
  ).map((ti) => {
    const tireObj = Array.isArray(ti.tire) ? ti.tire[0] : ti.tire;
    const machineObj = tireObj?.machine
      ? Array.isArray(tireObj.machine)
        ? tireObj.machine[0]
        : tireObj.machine
      : null;
    const severity: EngineeringNote['severity'] =
      ti.condition_status === 'critical'
        ? 'critical'
        : ti.condition_status === 'warning'
          ? 'high'
          : 'low';
    return {
      id: `tire-inspection-${ti.id}`,
      shift_type: 'day',
      issue_type: 'tire_inspection',
      severity,
      machine_id: null,
      description: `Tire Inspection [${tireObj?.serial_number || 'Tire'} · ${tireObj?.position || 'Pos'}]: ${ti.pressure_psi} PSI, ${ti.tread_depth_mm} mm tread${ti.notes ? ` — ${ti.notes}` : ''}`,
      action_taken: `Condition: ${ti.condition_status.toUpperCase()} (Engineering Tire Management)`,
      requires_follow_up: ti.condition_status === 'critical' || ti.condition_status === 'warning',
      status: ti.condition_status === 'good' ? 'resolved' : 'open',
      created_at: ti.created_at,
      source: 'tire_inspection' as const,
      machine: machineObj ? { name: machineObj.name, sites: machineObj.sites } : null,
    };
  });

  const combinedFeed: EngineeringNote[] = [
    ...noteItems,
    ...breakdownItems,
    ...dailyLogItems,
    ...tireInspectionItems,
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // Calculate statistics across all Engineering issues, breakdowns, and activities
  const criticalCount = combinedFeed.filter((n) => n.severity === 'critical').length;
  const openCount = combinedFeed.filter(
    (n) => n.status === 'open' || n.status === 'in_progress'
  ).length;
  const resolvedCount = combinedFeed.filter(
    (n) => n.status === 'resolved' || n.status === 'closed'
  ).length;
  const followUpCount = combinedFeed.filter((n) => n.requires_follow_up).length;

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
        breakdownDrafts={breakdownDrafts}
      />

      <div className="space-y-4">
        <h3 className="text-lg font-medium text-[var(--text-heading)]">
          Today&apos;s Engineering Issues &amp; Activity
        </h3>
        <EngineeringNotesList notes={combinedFeed} />
      </div>
    </div>
  );
}
