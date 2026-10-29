import { KPICard, KPIGrid } from '@repo/ui/KPI';
import { PageHeader } from '@repo/ui/PageHeader';
import { getCurrentShift } from '@repo/utils';
import type { BreakdownControlRoomView } from '@/features/departments';
import {
  buildCarryOverBreakdownDelays,
  createStandardOverviewDelays,
  createZeroOverviewDelays,
  OVERVIEW_DELAY_BY_CATEGORY,
} from '@/lib/shift-sheet-buckets';
import { getDepartmentContext, requireDepartment } from '~/lib/dept-context';
import { breakdownShiftDelayHours } from '~/lib/shift-completeness';
import { EngineeringNotesForm } from './EngineeringNotesForm';
import { type EngineeringNote, EngineeringNotesList } from './EngineeringNotesList';
import { EngineeringNotesTabsClient } from './EngineeringNotesTabsClient';
import {
  type CarryOverBreakdownInfo,
  EngineeringOverviewTable,
  type MachineOverviewInitialRow,
  type OverviewOperatorOption,
} from './EngineeringOverviewTable';
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
  searchParams,
}: {
  params: Promise<{ department: string }>;
  searchParams?: Promise<{ tab?: string; shift?: string }>;
}) {
  const { department } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  requireDepartment(department, ['control-room', 'engineering']);

  const { deptId, supabase, today } = await getDepartmentContext({
    department,
  });

  const currentShift: 'day' | 'night' =
    resolvedSearchParams.shift === 'day' || resolvedSearchParams.shift === 'night'
      ? resolvedSearchParams.shift
      : getCurrentShift();
  const initialTab: 'overview' | 'notes' =
    resolvedSearchParams.tab === 'notes' ? 'notes' : 'overview';

  const [
    { data: machines },
    { data: operators },
    { data: todayOperations },
    { data: previousSMRs },
    { data: baselineSmrReadings },
    { data: engDept },
    { data: todayNotes },
    { data: directBreakdowns },
    { data: viewBreakdowns },
    { data: todayTireInspections },
  ] = await Promise.all([
    supabase
      .from('machines')
      .select('id, name, machine_type, serial_number, site_id, sites(name)')
      .eq('active', true)
      .order('name'),
    supabase
      .from('operators')
      .select('id, full_name, employee_code')
      .eq('active', true)
      .order('full_name'),
    supabase
      .from('machine_operations')
      .select(
        `id, machine_id, operator_id, shift_type, start_smu, end_smu, hours_worked,
         operator:operators(full_name),
         delay_entries:delay_entries(
           id, status, duration_hours, manual_duration_hours, is_manual_override,
           description, deleted_at,
           delay_category:delay_categories(name)
         )`
      )
      .eq('department_id', deptId)
      .eq('shift_date', today)
      .eq('shift_type', currentShift),
    supabase
      .from('machine_operations')
      .select('id, machine_id, end_smu, operational_status, shift_date, shift_type')
      .not('end_smu', 'is', null)
      .order('shift_date', { ascending: false })
      .order('end_smu', { ascending: false })
      .limit(500),
    supabase
      .from('smr_readings')
      .select('machine_id, reading_hours')
      .order('reading_date', { ascending: false })
      .limit(200),
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
  // Performance Optimization: Replaced 4 sequential .filter() array allocations with a single-pass loop
  let criticalCount = 0;
  let openCount = 0;
  let resolvedCount = 0;
  let followUpCount = 0;

  for (const item of combinedFeed) {
    if (item.severity === 'critical') {
      criticalCount++;
    }
    if (item.status === 'open' || item.status === 'in_progress') {
      openCount++;
    } else if (item.status === 'resolved' || item.status === 'closed') {
      resolvedCount++;
    }
    if (item.requires_follow_up) {
      followUpCount++;
    }
  }

  // Build latest opening SMR map and previous-shift breakdown status from previous shift operations and smr_readings
  const latestSmrByMachine = new Map<string, number>();
  const latestPrevOpByMachine = new Map<
    string,
    {
      id: string;
      machine_id: string;
      end_smu: number | null;
      operational_status?: string | null;
      shift_date?: string | null;
      shift_type?: string | null;
    }
  >();
  for (const row of (previousSMRs ?? []) as Array<{
    id: string;
    machine_id: string;
    end_smu: number | null;
    operational_status?: string | null;
    shift_date?: string | null;
    shift_type?: string | null;
  }>) {
    if (!latestSmrByMachine.has(row.machine_id) && row.end_smu !== null) {
      latestSmrByMachine.set(row.machine_id, Number(row.end_smu));
    }
    const isSameCurrentShift = row.shift_date === today && row.shift_type === currentShift;
    if (!isSameCurrentShift && !latestPrevOpByMachine.has(row.machine_id)) {
      latestPrevOpByMachine.set(row.machine_id, row);
    }
  }
  for (const row of (baselineSmrReadings ?? []) as Array<{
    machine_id: string;
    reading_hours: number | null;
  }>) {
    if (!latestSmrByMachine.has(row.machine_id) && row.reading_hours !== null) {
      latestSmrByMachine.set(row.machine_id, Number(row.reading_hours));
    }
  }

  // Build active (unbooked-out) carry-over breakdown lookup by machine id / serial / name
  const activeBreakdownByMachineId = new Map<string, CarryOverBreakdownInfo>();
  for (const bd of mergedBreakdowns) {
    if (bd.status !== 'active') continue;
    const matchedMachine = (machines || []).find(
      (m) =>
        m.id === bd.fleet_id ||
        m.serial_number === bd.fleet_id ||
        (bd.machine_name && m.name.toLowerCase() === bd.machine_name.toLowerCase()) ||
        m.name.toLowerCase() === bd.fleet_id.toLowerCase()
    );
    if (!matchedMachine || activeBreakdownByMachineId.has(matchedMachine.id)) continue;

    const isFromPreviousShift =
      bd.date_in < today ||
      (bd.date_in === today && inferShiftFromTime(bd.time_in) !== currentShift);
    const parsedDelay = breakdownShiftDelayHours(bd);
    activeBreakdownByMachineId.set(matchedMachine.id, {
      id: bd.id,
      reason: bd.reason.replace(/\s*\[Shift Delay:\s*[\d.]+h\]/i, '').trim(),
      dateIn: bd.date_in,
      timeIn: bd.time_in ?? null,
      delayHours: parsedDelay > 0 ? parsedDelay : isFromPreviousShift ? 12 : 2,
      isFromPreviousShift,
    });
  }

  // Also auto-carry over any machine whose most recent previous shift operation ended with operational_status = 'BREAKDOWN'
  for (const [machineId, prevOp] of latestPrevOpByMachine.entries()) {
    if (prevOp.operational_status === 'BREAKDOWN' && !activeBreakdownByMachineId.has(machineId)) {
      activeBreakdownByMachineId.set(machineId, {
        id: `prev-op-bd-${prevOp.id}`,
        reason: 'Ended previous shift on breakdown (auto-carried over)',
        dateIn: prevOp.shift_date ?? today,
        timeIn: null,
        delayHours: 12,
        isFromPreviousShift: true,
      });
    }
  }

  // Build current shift operation lookup by machine_id
  interface RawMachineOpRow {
    id: string;
    machine_id: string;
    operator_id: string | null;
    shift_type: string;
    start_smu: number | null;
    end_smu: number | null;
    hours_worked: number | null;
    operator?: { full_name: string } | Array<{ full_name: string }> | null;
    delay_entries?: Array<{
      id: string;
      status: string | null;
      duration_hours: number | null;
      manual_duration_hours: number | null;
      is_manual_override: boolean | null;
      description: string | null;
      deleted_at: string | null;
      delay_category?: { name: string } | Array<{ name: string }> | null;
    }> | null;
  }

  const opByMachineId = new Map<string, RawMachineOpRow>();
  for (const op of (todayOperations ?? []) as unknown as RawMachineOpRow[]) {
    if (!opByMachineId.has(op.machine_id)) {
      opByMachineId.set(op.machine_id, op);
    }
  }

  const overviewRows: MachineOverviewInitialRow[] = (machines ?? []).map((m) => {
    const existingOp = opByMachineId.get(m.id);
    const carryOver = activeBreakdownByMachineId.get(m.id) ?? null;
    const defaultStartSmr = latestSmrByMachine.get(m.id) ?? 0;

    if (existingOp) {
      const delays = createZeroOverviewDelays();
      const comments = new Set<string>();
      let hasAnyDelayEntry = false;

      for (const entry of existingOp.delay_entries ?? []) {
        if (entry.deleted_at) continue;
        const catObj = Array.isArray(entry.delay_category)
          ? entry.delay_category[0]
          : entry.delay_category;
        const catKey = (catObj?.name ?? '').trim().toLowerCase();
        const bucketKey = OVERVIEW_DELAY_BY_CATEGORY[catKey];
        const hours =
          entry.is_manual_override && entry.manual_duration_hours !== null
            ? Number(entry.manual_duration_hours)
            : Number(entry.duration_hours ?? 0);

        if (bucketKey && Number.isFinite(hours) && hours > 0) {
          delays[bucketKey] = Number((delays[bucketKey] + hours).toFixed(2));
          hasAnyDelayEntry = true;
        }
        if (entry.description?.trim()) {
          comments.add(entry.description.trim());
        }
      }

      const opRel = Array.isArray(existingOp.operator)
        ? existingOp.operator[0]
        : existingOp.operator;
      const startSmr =
        existingOp.start_smu !== null ? Number(existingOp.start_smu) : defaultStartSmr;
      const stopSmr = existingOp.end_smu !== null ? Number(existingOp.end_smu) : startSmr;

      const baseDelays = hasAnyDelayEntry ? delays : createStandardOverviewDelays();
      const finalDelays =
        carryOver && baseDelays.breakdown === 0
          ? buildCarryOverBreakdownDelays({
              carryOverDelayHours: carryOver.delayHours,
              startSmr,
              stopSmr,
              baseDelays,
            })
          : baseDelays;

      return {
        machineId: m.id,
        machineName: m.name,
        machineType: m.machine_type,
        serialNumber: m.serial_number ?? null,
        siteId: (m as { site_id?: string | null }).site_id ?? null,
        startSmr,
        stopSmr,
        operatorId: existingOp.operator_id ?? null,
        operatorName: opRel?.full_name ?? null,
        delays: finalDelays,
        comment:
          [...comments].join(' · ') ||
          (carryOver ? `[Carry-Over Breakdown] ${carryOver.reason}` : ''),
        hasExistingOperation: true,
        carryOverBreakdown: carryOver,
      };
    }

    const initialDelays = carryOver
      ? buildCarryOverBreakdownDelays({
          carryOverDelayHours: carryOver.delayHours,
          startSmr: defaultStartSmr,
          stopSmr: defaultStartSmr,
        })
      : createStandardOverviewDelays();

    return {
      machineId: m.id,
      machineName: m.name,
      machineType: m.machine_type,
      serialNumber: m.serial_number ?? null,
      siteId: (m as { site_id?: string | null }).site_id ?? null,
      startSmr: defaultStartSmr,
      stopSmr: defaultStartSmr,
      operatorId: null,
      operatorName: null,
      delays: initialDelays,
      comment: carryOver ? `[Carry-Over Breakdown] ${carryOver.reason}` : '',
      hasExistingOperation: false,
      carryOverBreakdown: carryOver,
    };
  });

  const operatorOptions: OverviewOperatorOption[] = (operators ?? []).map((op) => ({
    id: op.id,
    fullName: op.full_name,
    employeeCode: op.employee_code,
  }));

  return (
    <div className="space-y-6">
      <PageHeader title="Operations" />

      <EngineeringNotesTabsClient
        initialTab={initialTab}
        machineCount={overviewRows.length}
        notesCount={combinedFeed.length}
        overviewContent={
          <EngineeringOverviewTable
            departmentId={deptId}
            shiftDate={today}
            initialShiftType={currentShift}
            initialRows={overviewRows}
            operators={operatorOptions}
          />
        }
        notesContent={
          <div className="space-y-6">
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
              <h3 className="font-medium text-[var(--text-heading)] text-lg">
                Today&apos;s Engineering Issues &amp; Activity
              </h3>
              <EngineeringNotesList notes={combinedFeed} />
            </div>
          </div>
        }
      />
    </div>
  );
}
