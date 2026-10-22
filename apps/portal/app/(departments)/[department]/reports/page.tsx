import '@/styles/print-report.css';
import { redirect } from 'next/navigation';
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
  searchParams: Promise<{ from?: string; to?: string; tab?: string }>;
}) {
  const { department: deptSlug } = await params;
  if (deptSlug === 'plant-processing') {
    redirect('/plant-processing/history');
  }
  const { from: fromParam, to: toParam, tab: tabParam } = await searchParams;
  const initialTab: 'shift' | 'day' | 'archived' | 'pdf-report' =
    tabParam === 'pdf-report' || tabParam === 'day' || tabParam === 'archived' ? tabParam : 'shift';
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
    { data: operations, error: operationsError },
    { data: loads, error: loadsError },
    { data: delays },
    { data: excavatorAssignments, error: assignmentsError },
    { data: dozerRolls, error: dozerRollsError },
    { data: breakdowns, error: breakdownsError },
    { data: engNotes, error: engNotesError },
    { data: dailyLogs, error: dailyLogsError },
    completeness,
  ] = await Promise.all([
    supabase
      .from('machine_operations')
      .select(
        'id, machine_id, shift_date, shift_type, start_smu, end_smu, hours_worked, operator_name, machine:machines(name, machine_type, bin_factor, serial_number, sites(name)), operator:operators(full_name), site:sites(name), delay_entries:delay_entries(duration_hours, deleted_at, description, delay_category:delay_categories(name))'
      )
      .gte('shift_date', fromDateStr)
      .lte('shift_date', toDateStr)
      .order('shift_date', { ascending: false }),
    supabase
      .from('hourly_loads')
      .select(
        'id, machine_id, excavator_id, material_type, load_date, shift_type, total_loads, machine:machines!machine_id(name, machine_type, bin_factor, sites(name)), excavator:machines!excavator_id(name, sites(name))'
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
        'total_loads, total_bcm, material_type, dumper_machine_id, dumper:machines!dumper_machine_id(name, machine_type, bin_factor), excavator_activity!inner(id, machine_id, activity_date, shift_type, department_id, passes, loads, material_type, notes, machine:machines(name, machine_type), operator:operators(full_name), site:sites(name), block_mined:mine_blocks(name, code))'
      )
      .gte('excavator_activity.activity_date', fromDateStr)
      .lte('excavator_activity.activity_date', toDateStr),
    supabase
      .from('dozer_rolls')
      .select(
        'id, machine_id, roll_date, shift_type, blade_passes, hours_operated, machine:machines(name, machine_type, sites(name)), operator:operators(full_name)'
      )
      .gte('roll_date', fromDateStr)
      .lte('roll_date', toDateStr),
    supabase
      .from('breakdowns')
      .select(
        'id, fleet_id, machine_name, machine_type, reason, repair_notes, date_in, time_in, date_out, duration_minutes, status, created_at'
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
  const queryWarnings: string[] = [];
  const namedErrors: Array<[string, { message?: string } | null | undefined]> = [
    ['machine_operations', operationsError],
    ['hourly_loads', loadsError],
    ['excavator_dumper_assignments', assignmentsError],
    ['dozer_rolls', dozerRollsError],
    ['breakdowns', breakdownsError],
    ['engineering_notes', engNotesError],
    ['daily_logs', dailyLogsError],
  ];
  for (const [tableName, err] of namedErrors) {
    if (err?.message) {
      queryWarnings.push(`${tableName}: ${err.message}`);
    }
  }
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

  // Build per-machine load map and excavator/dumper activity summaries
  const machineDateShiftLoadsMap = new Map<string, number>();
  interface ExcavatorSummaryAccum {
    machineId: string;
    machineName: string;
    operatorName: string;
    siteName: string;
    date: string;
    shift: 'day' | 'night';
    blockCodes: Set<string>;
    materials: Set<string>;
    totalLoads: number;
    totalBcm: number;
    dumpers: Map<string, { loads: number; bcm: number }>;
  }
  interface DumperSummaryAccum {
    machineId: string;
    machineName: string;
    machineType: string;
    siteName: string;
    date: string;
    shift: 'day' | 'night';
    excavators: Set<string>;
    materials: Set<string>;
    totalLoads: number;
    totalBcm: number;
  }

  const excavatorSummaryMap = new Map<string, ExcavatorSummaryAccum>();
  const dumperSummaryMap = new Map<string, DumperSummaryAccum>();

  for (const a of (excavatorAssignments || []) as Array<{
    total_loads?: number | null;
    total_bcm?: number | null;
    material_type?: string | null;
    dumper_machine_id?: string | null;
    dumper?:
      | { name?: string; machine_type?: string; bin_factor?: number | null }
      | { name?: string; machine_type?: string; bin_factor?: number | null }[]
      | null;
    excavator_activity?:
      | {
          id?: string;
          machine_id?: string;
          activity_date: string;
          shift_type: string;
          passes?: number | null;
          loads?: number | null;
          material_type?: string | null;
          machine?:
            | { name?: string; machine_type?: string }
            | { name?: string; machine_type?: string }[]
            | null;
          operator?: { full_name?: string } | { full_name?: string }[] | null;
          site?: { name?: string } | { name?: string }[] | null;
          block_mined?:
            | { name?: string; code?: string }
            | { name?: string; code?: string }[]
            | null;
        }
      | Array<{
          id?: string;
          machine_id?: string;
          activity_date: string;
          shift_type: string;
          passes?: number | null;
          loads?: number | null;
          material_type?: string | null;
          machine?:
            | { name?: string; machine_type?: string }
            | { name?: string; machine_type?: string }[]
            | null;
          operator?: { full_name?: string } | { full_name?: string }[] | null;
          site?: { name?: string } | { name?: string }[] | null;
          block_mined?:
            | { name?: string; code?: string }
            | { name?: string; code?: string }[]
            | null;
        }>
      | null;
  }>) {
    const act = Array.isArray(a.excavator_activity)
      ? a.excavator_activity[0]
      : a.excavator_activity;
    if (!act) continue;
    const shift: 'day' | 'night' = act.shift_type === 'night' ? 'night' : 'day';
    const excMach = Array.isArray(act.machine) ? act.machine[0] : act.machine;
    const excOp = Array.isArray(act.operator) ? act.operator[0] : act.operator;
    const excSite = Array.isArray(act.site) ? act.site[0] : act.site;
    const excBlock = Array.isArray(act.block_mined) ? act.block_mined[0] : act.block_mined;
    const dumperMach = Array.isArray(a.dumper) ? a.dumper[0] : a.dumper;
    const siteName = excSite?.name || 'General Pit';
    const excId = act.machine_id || excMach?.name || 'excavator';
    const excKey = `${excId}|${act.activity_date}|${shift}`;
    const loadsCount = Number(a.total_loads ?? act.loads ?? 0);
    const bcmCount = Number(a.total_bcm ?? 0);
    const mat = a.material_type || act.material_type || '';

    if (!excavatorSummaryMap.has(excKey)) {
      excavatorSummaryMap.set(excKey, {
        machineId: excId,
        machineName: excMach?.name || 'Excavator',
        operatorName: excOp?.full_name || 'Assigned Operator',
        siteName,
        date: act.activity_date,
        shift,
        blockCodes: new Set<string>(),
        materials: new Set<string>(),
        totalLoads: 0,
        totalBcm: 0,
        dumpers: new Map<string, { loads: number; bcm: number }>(),
      });
    }
    const excEntry = excavatorSummaryMap.get(excKey)!;
    if (excBlock?.code || excBlock?.name) {
      excEntry.blockCodes.add(excBlock.code || excBlock.name || '');
    }
    if (mat) excEntry.materials.add(mat);
    excEntry.totalLoads += loadsCount;
    excEntry.totalBcm += bcmCount;
    if (dumperMach?.name) {
      const prevD = excEntry.dumpers.get(dumperMach.name) || { loads: 0, bcm: 0 };
      excEntry.dumpers.set(dumperMach.name, {
        loads: prevD.loads + loadsCount,
        bcm: prevD.bcm + bcmCount,
      });
    }

    if (a.dumper_machine_id) {
      const dKey = `${a.dumper_machine_id}|${act.activity_date}|${shift}`;
      if (!dumperSummaryMap.has(dKey)) {
        dumperSummaryMap.set(dKey, {
          machineId: a.dumper_machine_id,
          machineName: dumperMach?.name || 'Haul Truck',
          machineType: dumperMach?.machine_type || 'ADT',
          siteName,
          date: act.activity_date,
          shift,
          excavators: new Set<string>(),
          materials: new Set<string>(),
          totalLoads: 0,
          totalBcm: 0,
        });
      }
      const dEntry = dumperSummaryMap.get(dKey)!;
      if (excMach?.name) dEntry.excavators.add(excMach.name);
      if (mat) dEntry.materials.add(mat);
      dEntry.totalLoads += loadsCount;
      dEntry.totalBcm += bcmCount;
    }
  }

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

  // Track hourly_loads & bin_factor BCM per (site, date, shift) and enrich excavator/dumper summaries
  const loadBcmMap = new Map<string, number>();
  for (const l of (loads || []) as Array<{
    machine_id?: string | null;
    excavator_id?: string | null;
    material_type?: string | null;
    load_date: string;
    shift_type: string;
    total_loads: number | null;
    machine?:
      | {
          name?: string;
          machine_type?: string;
          bin_factor?: number | null;
          sites?: { name: string }[] | { name: string } | null;
        }
      | {
          name?: string;
          machine_type?: string;
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
    const shift: 'day' | 'night' = l.shift_type === 'night' ? 'night' : 'day';
    if (l.machine_id) {
      const mk = `${l.machine_id}|${l.load_date}|${shift}`;
      machineDateShiftLoadsMap.set(
        mk,
        (machineDateShiftLoadsMap.get(mk) || 0) + (l.total_loads || 0)
      );
    }

    const excObj = Array.isArray(l.excavator) ? l.excavator[0] : l.excavator;
    const machObj = Array.isArray(l.machine) ? l.machine[0] : l.machine;
    const excSites = excObj?.sites;
    const machSites = machObj?.sites;
    const siteName =
      (Array.isArray(excSites) ? excSites[0]?.name : excSites?.name) ||
      (Array.isArray(machSites) ? machSites[0]?.name : machSites?.name) ||
      'General Pit';

    const row = getOrCreate(siteName, l.load_date, shift);
    const loadCount = Number(l.total_loads || 0);
    row.loads += loadCount;

    const bf = Number(machObj?.bin_factor || 40.5);
    const loadBcm = loadCount * bf;
    const k = `${row.site}|${row.date}|${row.shift}`;
    loadBcmMap.set(k, (loadBcmMap.get(k) || 0) + loadBcm);

    if (l.excavator_id && loadCount > 0) {
      const excKey = `${l.excavator_id}|${l.load_date}|${shift}`;
      if (!excavatorSummaryMap.has(excKey)) {
        excavatorSummaryMap.set(excKey, {
          machineId: l.excavator_id,
          machineName: excObj?.name || 'Excavator',
          operatorName: 'Assigned Operator',
          siteName,
          date: l.load_date,
          shift,
          blockCodes: new Set<string>(),
          materials: new Set<string>(),
          totalLoads: 0,
          totalBcm: 0,
          dumpers: new Map<string, { loads: number; bcm: number }>(),
        });
      }
      const excEntry = excavatorSummaryMap.get(excKey)!;
      if (l.material_type) excEntry.materials.add(l.material_type);
      if (excEntry.totalLoads === 0) {
        excEntry.totalLoads += loadCount;
        excEntry.totalBcm += loadBcm;
      }
    }

    if (l.machine_id && loadCount > 0) {
      const dKey = `${l.machine_id}|${l.load_date}|${shift}`;
      if (!dumperSummaryMap.has(dKey)) {
        dumperSummaryMap.set(dKey, {
          machineId: l.machine_id,
          machineName: machObj?.name || 'Haul Truck',
          machineType: machObj?.machine_type || 'ADT',
          siteName,
          date: l.load_date,
          shift,
          excavators: new Set<string>(),
          materials: new Set<string>(),
          totalLoads: loadCount,
          totalBcm: loadBcm,
        });
      } else {
        const dEntry = dumperSummaryMap.get(dKey)!;
        if (excObj?.name) dEntry.excavators.add(excObj.name);
        if (l.material_type) dEntry.materials.add(l.material_type);
        if (dEntry.totalLoads === 0) {
          dEntry.totalLoads += loadCount;
          dEntry.totalBcm += loadBcm;
        }
      }
    }
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

  // Dozer rolls lookup map
  interface DozerRollAccum {
    machineId: string;
    machineName: string;
    operatorName: string;
    siteName: string;
    date: string;
    shift: 'day' | 'night';
    bladePasses: number;
    hoursOperated: number;
  }
  const dozerRollMap = new Map<string, DozerRollAccum>();
  for (const r of (dozerRolls || []) as Array<{
    machine_id?: string | null;
    roll_date: string;
    shift_type: string;
    blade_passes: number | null;
    hours_operated: number | null;
    machine?:
      | {
          name?: string;
          machine_type?: string;
          sites?: { name: string }[] | { name: string } | null;
        }
      | {
          name?: string;
          machine_type?: string;
          sites?: { name: string }[] | { name: string } | null;
        }[]
      | null;
    operator?: { full_name?: string } | { full_name?: string }[] | null;
  }>) {
    const machObj = Array.isArray(r.machine) ? r.machine[0] : r.machine;
    const opObj = Array.isArray(r.operator) ? r.operator[0] : r.operator;
    const machSites = machObj?.sites;
    const siteName =
      (Array.isArray(machSites) ? machSites[0]?.name : machSites?.name) || 'General Pit';
    const shift: 'day' | 'night' = r.shift_type === 'night' ? 'night' : 'day';
    const row = getOrCreate(siteName, r.roll_date, shift);
    const passes = Number(r.blade_passes || 0);
    const hoursOp = Number(r.hours_operated || 0);
    row.dozerPasses += passes;
    if (r.machine_id) {
      const dk = `${r.machine_id}|${r.roll_date}|${shift}`;
      const prev = dozerRollMap.get(dk);
      dozerRollMap.set(dk, {
        machineId: r.machine_id,
        machineName: machObj?.name || 'Dozer',
        operatorName: opObj?.full_name || prev?.operatorName || 'Assigned Operator',
        siteName,
        date: r.roll_date,
        shift,
        bladePasses: (prev?.bladePasses || 0) + passes,
        hoursOperated: (prev?.hoursOperated || 0) + hoursOp,
      });
    } else if (hoursOp > 0) {
      const uk = `unkeyed-${siteName}|${r.roll_date}|${shift}`;
      const prev = dozerRollMap.get(uk);
      dozerRollMap.set(uk, {
        machineId: uk,
        machineName: machObj?.name || 'Dozer',
        operatorName: opObj?.full_name || prev?.operatorName || 'Assigned Operator',
        siteName,
        date: r.roll_date,
        shift,
        bladePasses: (prev?.bladePasses || 0) + passes,
        hoursOperated: (prev?.hoursOperated || 0) + hoursOp,
      });
    }
  }

  // Breakdown engineering minutes lookup by machineName/fleet_id + date
  const breakdownMinutesByMachineDate = new Map<string, number>();
  for (const bd of (breakdowns || []) as Array<{
    fleet_id?: string | null;
    machine_name?: string | null;
    date_in: string;
    duration_minutes?: number | null;
  }>) {
    const mins = Number(bd.duration_minutes || 0);
    if (mins > 0) {
      if (bd.machine_name) {
        const k = `${bd.machine_name.toLowerCase()}|${bd.date_in}`;
        breakdownMinutesByMachineDate.set(k, (breakdownMinutesByMachineDate.get(k) || 0) + mins);
      }
      if (bd.fleet_id) {
        const k = `${bd.fleet_id.toLowerCase()}|${bd.date_in}`;
        breakdownMinutesByMachineDate.set(k, (breakdownMinutesByMachineDate.get(k) || 0) + mins);
      }
    }
  }

  const formatExcavatorSummary = (exc: ExcavatorSummaryAccum | undefined, fallbackBcm: number) => {
    if (!exc || (exc.totalLoads === 0 && exc.totalBcm === 0)) {
      return fallbackBcm > 0
        ? `Excavator Loading · ${fallbackBcm.toFixed(1)} BCM`
        : 'Excavator Bench Operations';
    }
    const parts: string[] = [];
    if (exc.blockCodes.size > 0) {
      parts.push(`Block ${Array.from(exc.blockCodes).join(', ')}`);
    }
    if (exc.materials.size > 0) {
      parts.push(Array.from(exc.materials).join(' / '));
    }
    parts.push(`${exc.totalLoads} loads (${exc.totalBcm.toFixed(1)} BCM)`);
    if (exc.dumpers.size > 0) {
      const dumperList = Array.from(exc.dumpers.entries())
        .map(([name, stats]) => `${name} (${stats.loads})`)
        .join(', ');
      parts.push(`Dumpers: ${dumperList}`);
    }
    return parts.join(' · ');
  };

  const formatDumperSummary = (
    dumper: DumperSummaryAccum | undefined,
    fallbackLoads: number,
    fallbackBcm: number
  ) => {
    if (dumper && (dumper.totalLoads > 0 || dumper.totalBcm > 0)) {
      const parts: string[] = [];
      if (dumper.excavators.size > 0) {
        parts.push(`Excavator: ${Array.from(dumper.excavators).join(', ')}`);
      }
      if (dumper.materials.size > 0) {
        parts.push(Array.from(dumper.materials).join(' / '));
      }
      parts.push(`${dumper.totalLoads} loads (${dumper.totalBcm.toFixed(1)} BCM)`);
      return parts.join(' · ');
    }
    if (fallbackLoads > 0) {
      return `${fallbackLoads} haul loads (${fallbackBcm.toFixed(1)} BCM)`;
    }
    return 'Site Operations';
  };

  const machineOperationLogs: MachineOperationLogItem[] = [];
  const seenMachineShiftKeys = new Set<string>();

  for (const op of (operations || []) as Array<{
    id: string;
    machine_id: string;
    shift_date: string;
    shift_type: string;
    start_smu: number | null;
    end_smu: number | null;
    hours_worked: number | null;
    operator_name?: string | null;
    machine?:
      | {
          name: string;
          machine_type: string;
          bin_factor: number | null;
          serial_number?: string | null;
          sites?: { name: string }[] | { name: string } | null;
        }
      | {
          name: string;
          machine_type: string;
          bin_factor: number | null;
          serial_number?: string | null;
          sites?: { name: string }[] | { name: string } | null;
        }[]
      | null;
    operator?: { full_name: string } | { full_name: string }[] | null;
    site?: { name: string } | { name: string }[] | null;
    delay_entries?: Array<{
      duration_hours: number | null;
      deleted_at: string | null;
      description?: string | null;
      delay_category?: { name: string } | { name: string }[] | null;
    }> | null;
  }>) {
    const machineObj = Array.isArray(op.machine) ? op.machine[0] : op.machine;
    const operatorObj = Array.isArray(op.operator) ? op.operator[0] : op.operator;
    const opSiteObj = Array.isArray(op.site) ? op.site[0] : op.site;
    const machineSites = machineObj?.sites;
    const machineSiteName = Array.isArray(machineSites)
      ? machineSites[0]?.name
      : machineSites?.name;
    const shift: 'day' | 'night' = op.shift_type === 'night' ? 'night' : 'day';
    const mKey = `${op.machine_id}|${op.shift_date}|${shift}`;
    seenMachineShiftKeys.add(mKey);

    const excSummary = excavatorSummaryMap.get(mKey);
    const dumperSummary = dumperSummaryMap.get(mKey);
    const dozerSummary = dozerRollMap.get(mKey);

    const siteName =
      opSiteObj?.name ||
      excSummary?.siteName ||
      dumperSummary?.siteName ||
      dozerSummary?.siteName ||
      machineSiteName ||
      'General Pit';

    const hours =
      op.hours_worked != null
        ? Number(op.hours_worked)
        : op.start_smu != null && op.end_smu != null && Number(op.end_smu) >= Number(op.start_smu)
          ? Number(op.end_smu) - Number(op.start_smu)
          : 0;

    const machineTypeStr = machineObj?.machine_type || 'Equipment';
    const machineNameStr = machineObj?.name || 'Unknown Machine';
    const isExcavator =
      machineTypeStr === 'Excavator' ||
      machineTypeStr.toLowerCase().includes('excavator') ||
      machineNameStr.toLowerCase().includes('excavator') ||
      Boolean(excSummary);
    const isDozer =
      !isExcavator &&
      (machineTypeStr === 'Dozer' ||
        Boolean(machineTypeStr.toLowerCase().includes('dozer')) ||
        Boolean(dozerSummary));

    let productionDelayMinutes = 0;
    let engineeringDelayMinutes = 0;
    let naturalDelayMinutes = 0;
    let nonSiteDelayMinutes = 0;

    for (const d of op.delay_entries || []) {
      if (d.deleted_at) continue;
      const mins = Math.round(Number(d.duration_hours || 0) * 60);
      if (mins <= 0) continue;
      const catObj = Array.isArray(d.delay_category) ? d.delay_category[0] : d.delay_category;
      const catName = (catObj?.name || '').toLowerCase();
      const desc = (d.description || '').toLowerCase();
      if (
        catName.includes('weather') ||
        catName.includes('natural') ||
        /weather|rain|storm|lightning|fog|wind|natural|mud|flood/.test(desc)
      ) {
        naturalDelayMinutes += mins;
      } else if (
        catName.includes('engineering') ||
        catName.includes('breakdown') ||
        catName.includes('equipment') ||
        /breakdown|mech|maint|repair|elec|hydraulic|engine|tire|tyre/.test(desc)
      ) {
        engineeringDelayMinutes += mins;
      } else if (
        catName.includes('external') ||
        catName.includes('safety') ||
        catName.includes('non site') ||
        catName.includes('non-site') ||
        /external|eskom|power|community|roadblock|off-site|offsite|non-site/.test(desc)
      ) {
        nonSiteDelayMinutes += mins;
      } else {
        productionDelayMinutes += mins;
      }
    }

    if (engineeringDelayMinutes === 0) {
      const bdMins =
        breakdownMinutesByMachineDate.get(`${machineNameStr.toLowerCase()}|${op.shift_date}`) ||
        (machineObj?.serial_number
          ? breakdownMinutesByMachineDate.get(
              `${machineObj.serial_number.toLowerCase()}|${op.shift_date}`
            ) || 0
          : 0);
      if (bdMins > 0) {
        engineeringDelayMinutes += bdMins;
      }
    }

    const delayMin =
      productionDelayMinutes + engineeringDelayMinutes + naturalDelayMinutes + nonSiteDelayMinutes;

    const row = getOrCreate(siteName, op.shift_date, shift);
    row.hours += hours;
    row.delayMin += delayMin;

    const mLoads =
      dumperSummary?.totalLoads ||
      excSummary?.totalLoads ||
      machineDateShiftLoadsMap.get(mKey) ||
      0;
    let bcmMoved = 0;
    if (isDozer) {
      bcmMoved = hours * 250;
      row.dozerRolloverBcm += bcmMoved;
    } else if (isExcavator && excSummary && excSummary.totalBcm > 0) {
      bcmMoved = excSummary.totalBcm;
    } else if (dumperSummary && dumperSummary.totalBcm > 0) {
      bcmMoved = dumperSummary.totalBcm;
    } else {
      const bf = Number(machineObj?.bin_factor || 0);
      bcmMoved = mLoads * bf;
    }

    const siteGroupRole: 'excavator' | 'rollover' | 'site_machine' = isExcavator
      ? 'excavator'
      : isDozer
        ? 'rollover'
        : 'site_machine';

    const passes = dozerSummary?.bladePasses || 0;
    const excavatorActivity =
      siteGroupRole === 'excavator'
        ? formatExcavatorSummary(excSummary, bcmMoved)
        : siteGroupRole === 'rollover'
          ? `Roll-over: ${Number(bcmMoved.toFixed(1)).toLocaleString()} BCM (${hours.toFixed(1)}h × 250 BCM/h${passes > 0 ? ` · ${passes} passes` : ''})`
          : formatDumperSummary(dumperSummary, mLoads, bcmMoved);

    machineOperationLogs.push({
      id: op.id,
      date: op.shift_date,
      shift,
      machineName: machineNameStr,
      machineType: machineTypeStr,
      operatorName:
        operatorObj?.full_name ||
        op.operator_name ||
        excSummary?.operatorName ||
        dozerSummary?.operatorName ||
        'Assigned Operator',
      siteName,
      startSmu: op.start_smu != null ? Number(op.start_smu) : null,
      endSmu: op.end_smu != null ? Number(op.end_smu) : null,
      hoursWorked: hours,
      bcmMoved,
      isDozer,
      delayMinutes: delayMin,
      productionDelayMinutes,
      engineeringDelayMinutes,
      naturalDelayMinutes,
      nonSiteDelayMinutes,
      excavatorActivity,
      siteGroupRole,
      loadsCount: mLoads,
      bladePasses: passes,
      status: op.end_smu != null ? 'completed' : 'active',
    });
  }

  // Ensure excavators from excavator_activity without a separate machine_operations row are included
  for (const [excKey, exc] of excavatorSummaryMap.entries()) {
    if (seenMachineShiftKeys.has(excKey)) continue;
    seenMachineShiftKeys.add(excKey);
    machineOperationLogs.push({
      id: `exc-${excKey}`,
      date: exc.date,
      shift: exc.shift,
      machineName: exc.machineName,
      machineType: 'Excavator',
      operatorName: exc.operatorName,
      siteName: exc.siteName,
      startSmu: null,
      endSmu: null,
      hoursWorked: 0,
      bcmMoved: exc.totalBcm,
      isDozer: false,
      delayMinutes: 0,
      productionDelayMinutes: 0,
      engineeringDelayMinutes: 0,
      naturalDelayMinutes: 0,
      nonSiteDelayMinutes: 0,
      excavatorActivity: formatExcavatorSummary(exc, exc.totalBcm),
      siteGroupRole: 'excavator',
      loadsCount: exc.totalLoads,
      bladePasses: 0,
      status: 'completed',
    });
  }

  // Ensure dozers from dozer_rolls without a separate machine_operations row are included
  // and contribute their roll-over BCM once without double-counting
  for (const [dozerKey, dr] of dozerRollMap.entries()) {
    if (seenMachineShiftKeys.has(dozerKey)) continue;
    seenMachineShiftKeys.add(dozerKey);
    const rollBcm = dr.hoursOperated * 250;
    if (rollBcm > 0) {
      const row = getOrCreate(dr.siteName, dr.date, dr.shift);
      row.dozerRolloverBcm += rollBcm;
    }
    machineOperationLogs.push({
      id: `dozer-${dozerKey}`,
      date: dr.date,
      shift: dr.shift,
      machineName: dr.machineName,
      machineType: 'Dozer',
      operatorName: dr.operatorName,
      siteName: dr.siteName,
      startSmu: null,
      endSmu: null,
      hoursWorked: dr.hoursOperated,
      bcmMoved: rollBcm,
      isDozer: true,
      delayMinutes: 0,
      productionDelayMinutes: 0,
      engineeringDelayMinutes: 0,
      naturalDelayMinutes: 0,
      nonSiteDelayMinutes: 0,
      excavatorActivity: `Roll-over: ${Number(rollBcm.toFixed(1)).toLocaleString()} BCM (${dr.hoursOperated.toFixed(1)}h × 250 BCM/h${dr.bladePasses > 0 ? ` · ${dr.bladePasses} passes` : ''})`,
      siteGroupRole: 'rollover',
      loadsCount: 0,
      bladePasses: dr.bladePasses,
      status: 'completed',
    });
  }

  // Ensure dumpers/haul trucks from assignments/loads without a separate machine_operations row are included
  for (const [dKey, dm] of dumperSummaryMap.entries()) {
    if (seenMachineShiftKeys.has(dKey)) continue;
    seenMachineShiftKeys.add(dKey);
    machineOperationLogs.push({
      id: `dumper-${dKey}`,
      date: dm.date,
      shift: dm.shift,
      machineName: dm.machineName,
      machineType: dm.machineType,
      operatorName: 'Assigned Operator',
      siteName: dm.siteName,
      startSmu: null,
      endSmu: null,
      hoursWorked: 0,
      bcmMoved: dm.totalBcm,
      isDozer: false,
      delayMinutes: 0,
      productionDelayMinutes: 0,
      engineeringDelayMinutes: 0,
      naturalDelayMinutes: 0,
      nonSiteDelayMinutes: 0,
      excavatorActivity: formatDumperSummary(dm, dm.totalLoads, dm.totalBcm),
      siteGroupRole: 'site_machine',
      loadsCount: dm.totalLoads,
      bladePasses: 0,
      status: 'completed',
    });
  }

  // Legacy operational_delays
  for (const d of delays || []) {
    getOrCreate('General Pit', d.delay_date, d.shift_type).delayMin += Number(d.delay_minutes || 0);
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
      initialTab={initialTab}
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
      queryWarnings={queryWarnings}
    />
  );
}
