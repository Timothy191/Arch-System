import '@/styles/print-report.css';
import { getShiftCompleteness } from '@/lib/shift-completeness';
import { getDepartmentContext } from '~/lib/dept-context';
import {
  type EngineeringLogItem,
  type MachineOperationLogItem,
  ReportsDashboardClient,
  type ShiftCoverageMissingItem,
  type ShiftReportRow,
} from './ReportsDashboardClient';

export default async function ReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ department: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { department: deptSlug } = await params;
  const { from: fromParam, to: toParam } = await searchParams;
  const { dept, deptId, supabase, today } = await getDepartmentContext({
    department: deptSlug,
  });

  const todayStr = today || new Date().toISOString().split('T')[0]!;
  const toDateStr = toParam || todayStr;
  const fromDateStr =
    fromParam || new Date(Date.now() - 60 * 86400000).toISOString().split('T')[0]!;

  const currentHour = new Date().getHours();
  const currentShift: 'day' | 'night' = currentHour >= 6 && currentHour < 18 ? 'day' : 'night';
  const isControlRoom = dept.type === 'control_room';

  // Fetch data in parallel across Control Room & Department tables
  const [
    { data: operations },
    { data: loads },
    { data: delays },
    { data: excavatorAssignments },
    { data: dozerRolls },
    { data: breakdowns },
    { data: engNotes },
    { data: dailyLogs },
    completeness,
  ] = await Promise.all([
    supabase
      .from('machine_operations')
      .select(
        'id, machine_id, shift_date, shift_type, start_smu, end_smu, hours_worked, machine:machines(name, machine_type, bin_factor, sites(name)), operator:operators(full_name), site:sites(name), delay_entries:delay_entries(duration_hours, deleted_at)'
      )
      .gte('shift_date', fromDateStr)
      .lte('shift_date', toDateStr)
      .order('shift_date', { ascending: false }),
    supabase
      .from('hourly_loads')
      .select(
        'id, machine_id, load_date, shift_type, total_loads, machine:machines!machine_id(name, bin_factor, sites(name)), excavator:machines!excavator_id(name, sites(name))'
      )
      .gte('load_date', fromDateStr)
      .lte('load_date', toDateStr),
    // operational_delays table is deprecated; delay_entries are fetched via machine_operations
    Promise.resolve({
      data: [] as Array<{ delay_date: string; shift_type: string; delay_minutes: number }>,
    }),
    supabase
      .from('excavator_dumper_assignments')
      .select(
        'total_bcm, excavator_activity!inner(activity_date, shift_type, department_id, site:sites(name))'
      )
      .gte('excavator_activity.activity_date', fromDateStr)
      .lte('excavator_activity.activity_date', toDateStr),
    supabase
      .from('dozer_rolls')
      .select(
        'id, machine_id, roll_date, shift_type, blade_passes, hours_operated, machine:machines(name, sites(name))'
      )
      .gte('roll_date', fromDateStr)
      .lte('roll_date', toDateStr),
    supabase
      .from('breakdowns')
      .select(
        'id, fleet_id, machine_name, machine_type, reason, repair_notes, date_in, time_in, date_out, status, created_at'
      )
      .is('deleted_at', null)
      .gte('date_in', fromDateStr)
      .lte('date_in', toDateStr)
      .order('created_at', { ascending: false }),
    supabase
      .from('engineering_notes')
      .select(
        'id, note_date, shift_type, issue_type, severity, description, action_taken, status, created_at, machine:machines(name)'
      )
      .gte('note_date', fromDateStr)
      .lte('note_date', toDateStr)
      .order('created_at', { ascending: false }),
    supabase
      .from('daily_logs')
      .select('id, department_id, log_date, shift, notes, created_at')
      .gte('log_date', fromDateStr)
      .lte('log_date', toDateStr)
      .order('log_date', { ascending: false }),
    getShiftCompleteness(supabase, deptId, deptSlug, todayStr, currentShift),
  ]);

  // Also fetch machine_hours, fuel_logs, production_logs if dailyLogs exist
  const logIds = (dailyLogs || []).map((l) => l.id);
  const [{ data: machineHours }, { data: fuelLogs }, { data: productionLogs }] = await Promise.all([
    logIds.length > 0
      ? supabase
          .from('machine_hours')
          .select('daily_log_id, hours_worked')
          .in('daily_log_id', logIds)
      : Promise.resolve({ data: [] }),
    logIds.length > 0
      ? supabase.from('fuel_logs').select('daily_log_id, diesel_litres').in('daily_log_id', logIds)
      : Promise.resolve({ data: [] }),
    logIds.length > 0
      ? supabase
          .from('production_logs')
          .select('daily_log_id, coal_tonnes, waste_tonnes')
          .in('daily_log_id', logIds)
      : Promise.resolve({ data: [] }),
  ]);

  const machineHoursByLog = new Map<string, number>();
  machineHours?.forEach((m) => {
    machineHoursByLog.set(
      m.daily_log_id,
      (machineHoursByLog.get(m.daily_log_id) || 0) + (m.hours_worked || 0)
    );
  });

  const fuelLogsByLog = new Map<string, number>();
  fuelLogs?.forEach((f) => {
    fuelLogsByLog.set(
      f.daily_log_id,
      (fuelLogsByLog.get(f.daily_log_id) || 0) + (f.diesel_litres || 0)
    );
  });

  const productionByLog = new Map<string, { coal_tonnes: number; waste_tonnes: number }>();
  productionLogs?.forEach((p) => {
    productionByLog.set(p.daily_log_id, p);
  });

  // Build per-machine load map for machine operation BCM calculation
  const machineDateShiftLoadsMap = new Map<string, number>();
  (loads || []).forEach((l) => {
    const k = `${l.machine_id}|${l.load_date}|${l.shift_type}`;
    machineDateShiftLoadsMap.set(k, (machineDateShiftLoadsMap.get(k) || 0) + (l.total_loads || 0));
  });

  // Build unified ShiftReportRow map keyed by `${site}|${date}|${shift}`
  const rowMap = new Map<string, ShiftReportRow>();
  const getOrCreate = (siteRaw: string, date: string, shiftRaw: string): ShiftReportRow => {
    const site = siteRaw.trim() || 'General Pit';
    const shift: 'day' | 'night' = shiftRaw === 'night' ? 'night' : 'day';
    const k = `${site}|${date}|${shift}`;
    if (!rowMap.has(k)) {
      rowMap.set(k, {
        id: k,
        site,
        date,
        shift,
        hours: 0,
        loads: 0,
        haulBcm: 0,
        dozerRolloverBcm: 0,
        totalBcm: 0,
        delayMin: 0,
        dozerPasses: 0,
        fuelLitres: 0,
        coalTonnes: 0,
        wasteTonnes: 0,
        notes: '',
      });
    }
    return rowMap.get(k)!;
  };

  const machineOperationLogs: MachineOperationLogItem[] = [];

  for (const op of (operations || []) as Array<{
    id: string;
    machine_id: string;
    shift_date: string;
    shift_type: string;
    start_smu: number | null;
    end_smu: number | null;
    hours_worked: number | null;
    machine?:
      | {
          name: string;
          machine_type: string;
          bin_factor: number | null;
          sites?: { name: string }[] | { name: string } | null;
        }
      | {
          name: string;
          machine_type: string;
          bin_factor: number | null;
          sites?: { name: string }[] | { name: string } | null;
        }[]
      | null;
    operator?: { full_name: string } | { full_name: string }[] | null;
    site?: { name: string } | { name: string }[] | null;
    delay_entries?: Array<{ duration_hours: number | null; deleted_at: string | null }> | null;
  }>) {
    const machineObj = Array.isArray(op.machine) ? op.machine[0] : op.machine;
    const operatorObj = Array.isArray(op.operator) ? op.operator[0] : op.operator;
    const opSiteObj = Array.isArray(op.site) ? op.site[0] : op.site;
    const machineSites = machineObj?.sites;
    const machineSiteName = Array.isArray(machineSites)
      ? machineSites[0]?.name
      : machineSites?.name;
    const siteName = opSiteObj?.name || machineSiteName || 'General Pit';
    const shift: 'day' | 'night' = op.shift_type === 'night' ? 'night' : 'day';

    const hours =
      op.hours_worked != null
        ? Number(op.hours_worked)
        : op.start_smu != null && op.end_smu != null && Number(op.end_smu) >= Number(op.start_smu)
          ? Number(op.end_smu) - Number(op.start_smu)
          : 0;

    const isDozer =
      machineObj?.machine_type === 'Dozer' ||
      Boolean(machineObj?.machine_type?.toLowerCase().includes('dozer'));

    const delayMin = (op.delay_entries || [])
      .filter((d) => !d.deleted_at)
      .reduce((s, d) => s + Math.round(Number(d.duration_hours || 0) * 60), 0);

    const row = getOrCreate(siteName, op.shift_date, shift);
    row.hours += hours;
    row.delayMin += delayMin;

    let bcmMoved = 0;
    if (isDozer) {
      bcmMoved = hours * 250;
      row.dozerRolloverBcm += bcmMoved;
    } else {
      const mLoads =
        machineDateShiftLoadsMap.get(`${op.machine_id}|${op.shift_date}|${shift}`) || 0;
      const bf = Number(machineObj?.bin_factor || 0);
      bcmMoved = mLoads * bf;
    }

    machineOperationLogs.push({
      id: op.id,
      date: op.shift_date,
      shift,
      machineName: machineObj?.name || 'Unknown Machine',
      machineType: machineObj?.machine_type || 'Equipment',
      operatorName: operatorObj?.full_name || 'Assigned Operator',
      siteName,
      startSmu: op.start_smu != null ? Number(op.start_smu) : null,
      endSmu: op.end_smu != null ? Number(op.end_smu) : null,
      hoursWorked: hours,
      bcmMoved,
      isDozer,
      delayMinutes: delayMin,
      status: op.end_smu != null ? 'completed' : 'active',
    });
  }

  // Track hourly_loads & bin_factor BCM per (site, date, shift)
  const loadBcmMap = new Map<string, number>();
  for (const l of (loads || []) as Array<{
    load_date: string;
    shift_type: string;
    total_loads: number | null;
    machine?:
      | {
          name?: string;
          bin_factor?: number | null;
          sites?: { name: string }[] | { name: string } | null;
        }
      | {
          name?: string;
          bin_factor?: number | null;
          sites?: { name: string }[] | { name: string } | null;
        }[]
      | null;
    excavator?:
      | {
          name?: string;
          sites?: { name: string }[] | { name: string } | null;
        }
      | {
          name?: string;
          sites?: { name: string }[] | { name: string } | null;
        }[]
      | null;
  }>) {
    const excObj = Array.isArray(l.excavator) ? l.excavator[0] : l.excavator;
    const machObj = Array.isArray(l.machine) ? l.machine[0] : l.machine;
    const excSites = excObj?.sites;
    const machSites = machObj?.sites;
    const siteName =
      (Array.isArray(excSites) ? excSites[0]?.name : excSites?.name) ||
      (Array.isArray(machSites) ? machSites[0]?.name : machSites?.name) ||
      'General Pit';

    const row = getOrCreate(siteName, l.load_date, l.shift_type);
    const loadCount = Number(l.total_loads || 0);
    row.loads += loadCount;

    const bf = Number(machObj?.bin_factor || 40.5);
    const k = `${row.site}|${row.date}|${row.shift}`;
    loadBcmMap.set(k, (loadBcmMap.get(k) || 0) + loadCount * bf);
  }

  // Track excavator_dumper_assignments BCM per (site, date, shift)
  const assignmentBcmMap = new Map<string, number>();
  for (const a of excavatorAssignments || []) {
    const act = Array.isArray(a.excavator_activity)
      ? a.excavator_activity[0]
      : a.excavator_activity;
    if (act) {
      const rawSite = (act as unknown as { site?: { name: string } | { name: string }[] | null })
        .site;
      const siteName = (Array.isArray(rawSite) ? rawSite[0]?.name : rawSite?.name) || 'General Pit';
      const row = getOrCreate(siteName, act.activity_date, act.shift_type);
      const k = `${row.site}|${row.date}|${row.shift}`;
      assignmentBcmMap.set(k, (assignmentBcmMap.get(k) || 0) + Number(a.total_bcm || 0));
    }
  }

  // Legacy operational_delays
  for (const d of delays || []) {
    getOrCreate('General Pit', d.delay_date, d.shift_type).delayMin += Number(d.delay_minutes || 0);
  }

  // Dozer rolls
  for (const r of (dozerRolls || []) as Array<{
    roll_date: string;
    shift_type: string;
    blade_passes: number | null;
    hours_operated: number | null;
    machine?:
      | { name?: string; sites?: { name: string }[] | { name: string } | null }
      | { name?: string; sites?: { name: string }[] | { name: string } | null }[]
      | null;
  }>) {
    const machObj = Array.isArray(r.machine) ? r.machine[0] : r.machine;
    const machSites = machObj?.sites;
    const siteName =
      (Array.isArray(machSites) ? machSites[0]?.name : machSites?.name) || 'General Pit';
    const row = getOrCreate(siteName, r.roll_date, r.shift_type);
    row.dozerPasses += Number(r.blade_passes || 0);
    if (row.dozerRolloverBcm === 0 && Number(r.hours_operated || 0) > 0) {
      row.dozerRolloverBcm += Number(r.hours_operated || 0) * 250;
    }
  }

  // Daily logs (especially for non-Control Room or general shift notes)
  for (const dl of dailyLogs || []) {
    if (!isControlRoom && dl.department_id !== deptId) continue;
    const mh = machineHoursByLog.get(dl.id) || 0;
    const fl = fuelLogsByLog.get(dl.id) || 0;
    const pl = productionByLog.get(dl.id);
    if (mh > 0 || fl > 0 || pl || dl.notes) {
      const row = getOrCreate('General Pit', dl.log_date, dl.shift);
      if (row.hours === 0 && mh > 0) row.hours += mh;
      row.fuelLitres += fl;
      row.coalTonnes += Number(pl?.coal_tonnes || 0);
      row.wasteTonnes += Number(pl?.waste_tonnes || 0);
      if (dl.notes) {
        row.notes = row.notes ? `${row.notes} | ${dl.notes}` : dl.notes;
      }
    }
  }

  // Finalize haulBcm & totalBcm on each row
  for (const [k, row] of rowMap.entries()) {
    const assignBcm = assignmentBcmMap.get(k) || 0;
    const loadsBcm = loadBcmMap.get(k) || 0;
    row.haulBcm = Math.max(assignBcm, loadsBcm);
    row.totalBcm = row.haulBcm + row.dozerRolloverBcm;
  }

  const shiftRows = Array.from(rowMap.values()).sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    if (a.shift !== b.shift) return a.shift.localeCompare(b.shift);
    return a.site.localeCompare(b.site);
  });

  // Build Engineering & Breakdown logs
  const engineeringLogs: EngineeringLogItem[] = [
    ...(breakdowns || []).map((bd) => ({
      id: `bd-${bd.id}`,
      date: bd.date_in,
      shift: (bd.time_in && Number.parseInt(bd.time_in.slice(0, 2), 10) >= 18 ? 'night' : 'day') as
        | 'day'
        | 'night',
      source: 'breakdown' as const,
      machineName: bd.machine_name || bd.fleet_id,
      category: bd.machine_type || 'Breakdown',
      severity: (bd.status === 'active' ? 'high' : 'medium') as 'high' | 'medium',
      status: (bd.status === 'active' ? 'open' : 'resolved') as 'open' | 'resolved',
      description: `[${bd.fleet_id}] ${bd.reason}`,
      actionTaken:
        bd.repair_notes ||
        (bd.status === 'completed'
          ? `Completed${bd.date_out ? ` on ${bd.date_out}` : ''}`
          : 'Active Engineering breakdown'),
    })),
    ...(
      (engNotes || []) as Array<{
        id: string;
        note_date: string;
        shift_type: string;
        issue_type: string;
        severity: 'low' | 'medium' | 'high' | 'critical';
        description: string;
        action_taken: string | null;
        status: string;
        machine?: { name: string } | { name: string }[] | null;
      }>
    ).map((n) => {
      const mObj = Array.isArray(n.machine) ? n.machine[0] : n.machine;
      return {
        id: `note-${n.id}`,
        date: n.note_date,
        shift: (n.shift_type === 'night' ? 'night' : 'day') as 'day' | 'night',
        source: 'engineering_note' as const,
        machineName: mObj?.name || 'General Plant / Pit',
        category: n.issue_type,
        severity: n.severity,
        status: (n.status === 'resolved' || n.status === 'closed' ? 'resolved' : 'open') as
          | 'open'
          | 'resolved',
        description: n.description,
        actionTaken: n.action_taken || '',
      };
    }),
  ].sort((a, b) => b.date.localeCompare(a.date));

  // Shift coverage stats (non-blocking)
  const activeStatuses = completeness.statuses.filter((s) => !s.exempt);
  const totalFleetCount = activeStatuses.length;
  const coveredFleetCount = activeStatuses.filter((s) => s.hasEntry).length;
  const missingCoverage: ShiftCoverageMissingItem[] = activeStatuses
    .filter((s) => !s.hasEntry)
    .map((s) => ({
      machineId: s.machineId,
      machineName: s.machineName,
      machineType: s.machineType,
      formPath: s.formPath,
      formLabel: s.formLabel,
    }));

  // Export & PDF payloads
  const totalHours = shiftRows.reduce((s, r) => s + r.hours, 0);
  const totalLoads = shiftRows.reduce((s, r) => s + r.loads, 0);
  const totalBcm = shiftRows.reduce((s, r) => s + r.totalBcm, 0);
  const totalDelayMin = shiftRows.reduce((s, r) => s + r.delayMin, 0);

  const csvRows = [
    [
      'Date',
      'Shift',
      'Site',
      'Hours',
      'Total Loads',
      'Haul BCM',
      'Dozer Roll-over BCM',
      'Total BCM',
      'Delay (min)',
      'Dozer Passes',
    ],
    ...shiftRows.map((r) => [
      r.date,
      r.shift,
      r.site,
      r.hours.toFixed(2),
      r.loads.toString(),
      r.haulBcm.toFixed(2),
      r.dozerRolloverBcm.toFixed(2),
      r.totalBcm.toFixed(2),
      r.delayMin.toString(),
      r.dozerPasses.toString(),
    ]),
  ];

  const csvContent = csvRows
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const exportRows = shiftRows.map((r) => ({
    Date: r.date,
    Shift: r.shift,
    Site: r.site,
    Hours: Number(r.hours.toFixed(2)),
    'Total Loads': r.loads,
    'Haul BCM': Number(r.haulBcm.toFixed(2)),
    'Dozer Roll-over BCM': Number(r.dozerRolloverBcm.toFixed(2)),
    'Total BCM': Number(r.totalBcm.toFixed(2)),
    'Delay (min)': r.delayMin,
    'Dozer Passes': r.dozerPasses,
  }));

  const pdfReportData = {
    title: `${dept.displayName} Department Report`,
    subtitle: `Generated on ${todayStr} — Date range: ${fromDateStr} to ${toDateStr}`,
    kpis: [
      { label: 'Total Hours', value: `${totalHours.toFixed(1)} h` },
      { label: 'Total Loads', value: `${totalLoads.toLocaleString()}` },
      { label: 'Total Volume (BCM)', value: `${totalBcm.toFixed(1)} BCM` },
      { label: 'Delay Minutes', value: `${totalDelayMin.toLocaleString()} min` },
    ],
    tableHeaders: [
      'Date',
      'Shift',
      'Site',
      'Hours',
      'Loads',
      'Haul BCM',
      'Roll-over BCM',
      'Total BCM',
      'Delay (min)',
    ],
    tableRows: exportRows.map((r) => [
      r.Date,
      r.Shift,
      r.Site,
      r.Hours.toString(),
      r['Total Loads'].toString(),
      r['Haul BCM'].toString(),
      r['Dozer Roll-over BCM'].toString(),
      r['Total BCM'].toString(),
      r['Delay (min)'].toString(),
    ]),
  };

  return (
    <ReportsDashboardClient
      departmentId={deptId}
      departmentSlug={deptSlug}
      departmentName={dept.displayName}
      isControlRoom={isControlRoom}
      todayStr={todayStr}
      currentShift={currentShift}
      fromDateStr={fromDateStr}
      toDateStr={toDateStr}
      totalFleetCount={totalFleetCount}
      coveredFleetCount={coveredFleetCount}
      missingCoverage={missingCoverage}
      shiftRows={shiftRows}
      machineOperationLogs={machineOperationLogs}
      engineeringLogs={engineeringLogs}
      csvContent={csvContent}
      exportRows={exportRows}
      pdfReportData={pdfReportData}
    />
  );
}
