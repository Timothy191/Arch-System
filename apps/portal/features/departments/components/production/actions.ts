'use server';

import { cacheInvalidateTags } from '@repo/redis';
import { getAuthenticatedEmployee } from '@repo/supabase';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { revalidatePath } from 'next/cache';
import { AuthError, DatabaseError } from '@/lib/errors/error-classes';

export interface MonthlyProductionTarget {
  target_month: string; // 'YYYY-MM'
  coal_target_tonnes: number;
  waste_target_tonnes: number;
  bcm_target: number;
  notes: string | null;
  updated_at: string | null;
}

export interface DailyProductionRollupRow {
  date: string;
  dayShiftCoalTonnes: number;
  nightShiftCoalTonnes: number;
  totalCoalTonnes: number;
  dayShiftWasteTonnes: number;
  nightShiftWasteTonnes: number;
  totalWasteTonnes: number;
  haulTruckLoads: number;
  haulTruckBcm: number;
  excavatorBcm: number;
  dozerPushBcm: number;
  totalBcm: number;
  fleetOperatingHours: number;
  activeMachinesCount: number;
  stripRatio: number;
}

export interface ProductionMonthReportData {
  selectedMonth: string; // 'YYYY-MM'
  monthLabel: string;
  availableMonths: Array<{ value: string; label: string; isPastMonth: boolean }>;
  target: MonthlyProductionTarget;
  totals: {
    coalTonnes: number;
    wasteTonnes: number;
    totalTonnes: number;
    haulTruckLoads: number;
    haulTruckBcm: number;
    excavatorBcm: number;
    dozerPushBcm: number;
    totalBcm: number;
    fleetOperatingHours: number;
    stripRatio: number;
    expectedTonnesFromBcm: number;
    reconciliationDriftPct: number;
    daysLogged: number;
    totalDaysInMonth: number;
    coalTargetProgressPct: number;
    wasteTargetProgressPct: number;
    bcmTargetProgressPct: number;
    remainingCoalTonnes: number;
    remainingWasteTonnes: number;
    requiredDailyCoalRate: number;
    requiredDailyWasteRate: number;
  };
  dailyRows: DailyProductionRollupRow[];
}

const DEFAULT_MONTHLY_TARGETS: Record<
  string,
  { coal: number; waste: number; bcm: number; notes: string }
> = {
  '2026-08': {
    coal: 120000,
    waste: 336000,
    bcm: 152000,
    notes: 'August 2026 Opencast ROM & Overburden Target',
  },
  '2026-09': {
    coal: 125000,
    waste: 350000,
    bcm: 160000,
    notes: 'September 2026 Opencast ROM & Overburden Target',
  },
  '2026-10': {
    coal: 130000,
    waste: 364000,
    bcm: 168000,
    notes: 'October 2026 Opencast ROM & Overburden Target',
  },
  '2026-11': {
    coal: 135000,
    waste: 378000,
    bcm: 175000,
    notes: 'November 2026 Opencast ROM & Overburden Target',
  },
};

function getMonthDateBounds(monthStr: string): {
  startDate: string;
  endDate: string;
  totalDays: number;
  monthLabel: string;
} {
  const [yStr, mStr] = monthStr.split('-');
  const year = Number(yStr) || new Date().getFullYear();
  const monthIndex = (Number(mStr) || new Date().getMonth() + 1) - 1;
  const firstDay = new Date(Date.UTC(year, monthIndex, 1));
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0));
  const startDate = firstDay.toISOString().split('T')[0]!;
  const endDate = lastDay.toISOString().split('T')[0]!;
  const totalDays = lastDay.getUTCDate();
  const monthLabel = firstDay.toLocaleDateString('en-ZA', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  return { startDate, endDate, totalDays, monthLabel };
}

function buildAvailableMonths(): Array<{ value: string; label: string; isPastMonth: boolean }> {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const list: Array<{ value: string; label: string; isPastMonth: boolean }> = [];

  for (let offset = 0; offset <= 5; offset++) {
    const d = new Date(Date.UTC(currentYear, currentMonth - offset, 1));
    const value = d.toISOString().slice(0, 7);
    const label = d.toLocaleDateString('en-ZA', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });
    list.push({
      value,
      label:
        offset === 0 ? `${label} (Current MTD)` : offset === 1 ? `${label} (Passed Month)` : label,
      isPastMonth: offset > 0,
    });
  }
  return list;
}

/**
 * Shared SSoT query so ANY department (Production, Control Room, Drilling, Hub)
 * can pull the monthly Coal & Waste target and current actual progress.
 */
export async function getMonthlyProductionTarget(
  monthStr?: string
): Promise<MonthlyProductionTarget> {
  const supabase = await createServerSupabaseClient();
  const targetMonth = monthStr || new Date().toISOString().slice(0, 7);

  try {
    const { data } = await supabase
      .from('production_monthly_targets' as never)
      .select(
        'target_month, coal_target_tonnes, waste_target_tonnes, bcm_target, notes, updated_at'
      )
      .eq('target_month', targetMonth)
      .maybeSingle();

    if (data) {
      const row = data as Record<string, unknown>;
      return {
        target_month: String(row.target_month || targetMonth),
        coal_target_tonnes: Number(row.coal_target_tonnes) || 125000,
        waste_target_tonnes: Number(row.waste_target_tonnes) || 350000,
        bcm_target: Number(row.bcm_target) || 160000,
        notes: (row.notes as string | null) ?? null,
        updated_at: (row.updated_at as string | null) ?? null,
      };
    }
  } catch {
    // Fallback to default target when migration 189 is pending on remote DB
  }

  const fallback = DEFAULT_MONTHLY_TARGETS[targetMonth] ?? {
    coal: 125000,
    waste: 350000,
    bcm: 160000,
    notes: `${targetMonth} Monthly Opencast Target`,
  };

  return {
    target_month: targetMonth,
    coal_target_tonnes: fallback.coal,
    waste_target_tonnes: fallback.waste,
    bcm_target: fallback.bcm,
    notes: fallback.notes,
    updated_at: null,
  };
}

/**
 * Set or update the monthly Coal, Waste, and BCM target for a given month ('YYYY-MM').
 */
export async function upsertMonthlyProductionTarget(input: {
  target_month: string;
  coal_target_tonnes: number;
  waste_target_tonnes: number;
  bcm_target: number;
  notes?: string;
}): Promise<MonthlyProductionTarget> {
  const supabase = await createServerSupabaseClient();
  const principal = await getAuthenticatedEmployee(supabase);
  if (!principal?.user) {
    throw new AuthError('Unauthorized');
  }

  const month = input.target_month.trim();
  const coalTarget = Math.max(0, Number(input.coal_target_tonnes) || 0);
  const wasteTarget = Math.max(0, Number(input.waste_target_tonnes) || 0);
  const bcmTarget = Math.max(0, Number(input.bcm_target) || 0);

  const payload = {
    target_month: month,
    coal_target_tonnes: coalTarget,
    waste_target_tonnes: wasteTarget,
    bcm_target: bcmTarget,
    notes: input.notes?.trim() || `${month} Production Target`,
    updated_by: principal.user.id,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('production_monthly_targets' as never)
    .upsert(payload as never, { onConflict: 'target_month' });

  if (error) {
    throw new DatabaseError('Failed to save monthly production target', {
      table: 'production_monthly_targets',
      cause: error,
    });
  }

  await cacheInvalidateTags(['table:production_logs', 'table:daily_logs']);
  revalidatePath('/production');
  revalidatePath('/production/reports');
  revalidatePath('/control-room');
  revalidatePath('/control-room/reports');
  revalidatePath('/drilling');
  revalidatePath('/hub');

  return {
    target_month: month,
    coal_target_tonnes: coalTarget,
    waste_target_tonnes: wasteTarget,
    bcm_target: bcmTarget,
    notes: payload.notes,
    updated_at: payload.updated_at,
  };
}

/**
 * Automatically pulls and reconciles Production Department data for any selected month
 * from all primary operational sources:
 *  - `daily_logs` + `production_logs` (Weighbridge & ROM Coal/Waste tonnes)
 *  - `hourly_loads` + `machines.bin_factor` (Haul truck load telemetry)
 *  - `excavator_dumper_assignments` + `excavator_activity` (Excavator bank BCM)
 *  - `machine_operations` + `dozer_rolls` (Fleet SMR hours & Dozer push BCM)
 *  - `production_monthly_targets` (Coal, Waste & BCM targets)
 */
export async function getProductionDepartmentData(
  monthStr?: string,
  _deptId?: string
): Promise<ProductionMonthReportData> {
  const supabase = await createServerSupabaseClient();
  const availableMonths = buildAvailableMonths();
  const selectedMonth = monthStr || availableMonths[0]!.value;
  const { startDate, endDate, totalDays, monthLabel } = getMonthDateBounds(selectedMonth);

  const [
    target,
    { data: dailyLogs },
    { data: hourlyLoads },
    { data: excavatorAssignments },
    { data: machineOps },
    { data: dozerRolls },
  ] = await Promise.all([
    getMonthlyProductionTarget(selectedMonth),
    supabase
      .from('daily_logs')
      .select('id, log_date, shift, department_id')
      .gte('log_date', startDate)
      .lte('log_date', endDate)
      .order('log_date', { ascending: false }),
    supabase
      .from('hourly_loads')
      .select(
        'id, machine_id, load_date, shift_type, total_loads, machine:machines!machine_id(name, machine_type, bin_factor)'
      )
      .gte('load_date', startDate)
      .lte('load_date', endDate),
    supabase
      .from('excavator_dumper_assignments')
      .select('total_bcm, excavator_activity!inner(activity_date, shift_type)')
      .gte('excavator_activity.activity_date', startDate)
      .lte('excavator_activity.activity_date', endDate),
    supabase
      .from('machine_operations')
      .select(
        'id, machine_id, shift_date, shift_type, hours_worked, machine:machines(name, machine_type, bin_factor)'
      )
      .gte('shift_date', startDate)
      .lte('shift_date', endDate),
    supabase
      .from('dozer_rolls')
      .select('id, machine_id, roll_date, shift_type, blade_passes, hours_operated')
      .gte('roll_date', startDate)
      .lte('roll_date', endDate),
  ]);

  const logIds = (dailyLogs ?? []).map((l) => l.id);
  const { data: prodLogs } =
    logIds.length > 0
      ? await supabase
          .from('production_logs')
          .select('daily_log_id, coal_tonnes, waste_tonnes')
          .in('daily_log_id', logIds)
      : {
          data: [] as Array<{
            daily_log_id: string;
            coal_tonnes: number | null;
            waste_tonnes: number | null;
          }>,
        };

  const logMetaById = new Map<string, { date: string; shift: 'day' | 'night' }>();
  for (const dl of dailyLogs ?? []) {
    logMetaById.set(dl.id, {
      date: dl.log_date,
      shift: dl.shift === 'night' ? 'night' : 'day',
    });
  }

  interface MutableDayBucket {
    date: string;
    dayShiftCoalTonnes: number;
    nightShiftCoalTonnes: number;
    dayShiftWasteTonnes: number;
    nightShiftWasteTonnes: number;
    haulTruckLoads: number;
    haulTruckBcm: number;
    excavatorBcm: number;
    dozerPushBcm: number;
    fleetOperatingHours: number;
    machineIds: Set<string>;
  }

  const dayMap = new Map<string, MutableDayBucket>();
  const ensureDay = (date: string): MutableDayBucket => {
    let bucket = dayMap.get(date);
    if (!bucket) {
      bucket = {
        date,
        dayShiftCoalTonnes: 0,
        nightShiftCoalTonnes: 0,
        dayShiftWasteTonnes: 0,
        nightShiftWasteTonnes: 0,
        haulTruckLoads: 0,
        haulTruckBcm: 0,
        excavatorBcm: 0,
        dozerPushBcm: 0,
        fleetOperatingHours: 0,
        machineIds: new Set<string>(),
      };
      dayMap.set(date, bucket);
    }
    return bucket;
  };

  // 1. Aggregate production_logs (direct weighbridge / ROM coal & waste logs)
  for (const pl of prodLogs ?? []) {
    const meta = logMetaById.get(pl.daily_log_id);
    if (!meta) continue;
    const b = ensureDay(meta.date);
    const coal = Number(pl.coal_tonnes) || 0;
    const waste = Number(pl.waste_tonnes) || 0;
    if (meta.shift === 'night') {
      b.nightShiftCoalTonnes += coal;
      b.nightShiftWasteTonnes += waste;
    } else {
      b.dayShiftCoalTonnes += coal;
      b.dayShiftWasteTonnes += waste;
    }
  }

  // 2. Aggregate hourly_loads (Control Room & Production haul truck loads)
  for (const hl of hourlyLoads ?? []) {
    const b = ensureDay(hl.load_date);
    const loads = Number(hl.total_loads) || 0;
    const machineObj = Array.isArray(hl.machine) ? hl.machine[0] : hl.machine;
    const binFactor = Number(machineObj?.bin_factor) || 18.5;
    const bcm = loads * binFactor;
    b.haulTruckLoads += loads;
    b.haulTruckBcm += bcm;
    if (hl.machine_id) b.machineIds.add(hl.machine_id);
  }

  // 3. Aggregate excavator_dumper_assignments (Excavator BCM)
  for (const ea of excavatorAssignments ?? []) {
    const act = Array.isArray(ea.excavator_activity)
      ? ea.excavator_activity[0]
      : ea.excavator_activity;
    const date = act?.activity_date;
    if (!date) continue;
    const b = ensureDay(date);
    b.excavatorBcm += Number(ea.total_bcm) || 0;
  }

  // 4. Aggregate machine_operations (SMR fleet operating hours + Dozer BCM)
  for (const op of machineOps ?? []) {
    const b = ensureDay(op.shift_date);
    const hrs = Number(op.hours_worked) || 0;
    b.fleetOperatingHours += hrs;
    if (op.machine_id) b.machineIds.add(op.machine_id);
    const machineObj = Array.isArray(op.machine) ? op.machine[0] : op.machine;
    const isDozer =
      machineObj?.machine_type === 'Dozer' ||
      Boolean(machineObj?.machine_type?.toLowerCase().includes('dozer'));
    if (isDozer && hrs > 0) {
      b.dozerPushBcm += hrs * 250;
    }
  }

  // 5. Aggregate dozer_rolls
  for (const dr of dozerRolls ?? []) {
    const b = ensureDay(dr.roll_date);
    const hrs = Number(dr.hours_operated) || 0;
    if (hrs > 0 && b.dozerPushBcm === 0) {
      b.dozerPushBcm += hrs * 250;
    }
    if (dr.machine_id) b.machineIds.add(dr.machine_id);
  }

  // Build sorted daily rows; when direct production_logs are absent for a day that has
  // haul/excavator BCM, automatically derive ROM Coal & Overburden Waste tonnes from BCM
  // (using standard opencast density 1.55 t/BCM for coal seam and 2.15 t/BCM for overburden)
  const dailyRows: DailyProductionRollupRow[] = Array.from(dayMap.values())
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((b) => {
      const totalBcm = Math.max(b.haulTruckBcm, b.excavatorBcm) + b.dozerPushBcm;
      let dayCoal = b.dayShiftCoalTonnes;
      let nightCoal = b.nightShiftCoalTonnes;
      let dayWaste = b.dayShiftWasteTonnes;
      let nightWaste = b.nightShiftWasteTonnes;

      const loggedSum = dayCoal + nightCoal + dayWaste + nightWaste;
      if (loggedSum === 0 && totalBcm > 0) {
        // Auto-derive from haulage/excavator BCM when manual weighbridge log wasn't entered yet
        const derivedCoal = Math.round(totalBcm * 0.28 * 1.55);
        const derivedWaste = Math.round(totalBcm * 0.72 * 2.15);
        dayCoal = Math.round(derivedCoal * 0.54);
        nightCoal = derivedCoal - dayCoal;
        dayWaste = Math.round(derivedWaste * 0.54);
        nightWaste = derivedWaste - dayWaste;
      }

      const totalCoalTonnes = dayCoal + nightCoal;
      const totalWasteTonnes = dayWaste + nightWaste;
      const stripRatio =
        totalCoalTonnes > 0 ? Number((totalWasteTonnes / totalCoalTonnes).toFixed(2)) : 0;

      return {
        date: b.date,
        dayShiftCoalTonnes: Math.round(dayCoal),
        nightShiftCoalTonnes: Math.round(nightCoal),
        totalCoalTonnes: Math.round(totalCoalTonnes),
        dayShiftWasteTonnes: Math.round(dayWaste),
        nightShiftWasteTonnes: Math.round(nightWaste),
        totalWasteTonnes: Math.round(totalWasteTonnes),
        haulTruckLoads: b.haulTruckLoads,
        haulTruckBcm: Math.round(b.haulTruckBcm),
        excavatorBcm: Math.round(b.excavatorBcm),
        dozerPushBcm: Math.round(b.dozerPushBcm),
        totalBcm: Math.round(totalBcm),
        fleetOperatingHours: Number(b.fleetOperatingHours.toFixed(1)),
        activeMachinesCount: b.machineIds.size,
        stripRatio,
      };
    });

  const coalTonnes = dailyRows.reduce((s, r) => s + r.totalCoalTonnes, 0);
  const wasteTonnes = dailyRows.reduce((s, r) => s + r.totalWasteTonnes, 0);
  const totalTonnes = coalTonnes + wasteTonnes;
  const haulTruckLoads = dailyRows.reduce((s, r) => s + r.haulTruckLoads, 0);
  const haulTruckBcm = dailyRows.reduce((s, r) => s + r.haulTruckBcm, 0);
  const excavatorBcm = dailyRows.reduce((s, r) => s + r.excavatorBcm, 0);
  const dozerPushBcm = dailyRows.reduce((s, r) => s + r.dozerPushBcm, 0);
  const totalBcm = dailyRows.reduce((s, r) => s + r.totalBcm, 0);
  const fleetOperatingHours = Number(
    dailyRows.reduce((s, r) => s + r.fleetOperatingHours, 0).toFixed(1)
  );
  const stripRatio = coalTonnes > 0 ? Number((wasteTonnes / coalTonnes).toFixed(2)) : 0;

  const expectedTonnesFromBcm = Math.round(totalBcm * 1.95);
  const reconciliationDriftPct =
    expectedTonnesFromBcm > 0
      ? Number((((totalTonnes - expectedTonnesFromBcm) / expectedTonnesFromBcm) * 100).toFixed(2))
      : 0;

  const coalTargetProgressPct =
    target.coal_target_tonnes > 0
      ? Number(Math.min(100, (coalTonnes / target.coal_target_tonnes) * 100).toFixed(1))
      : 0;
  const wasteTargetProgressPct =
    target.waste_target_tonnes > 0
      ? Number(Math.min(100, (wasteTonnes / target.waste_target_tonnes) * 100).toFixed(1))
      : 0;
  const bcmTargetProgressPct =
    target.bcm_target > 0
      ? Number(Math.min(100, (totalBcm / target.bcm_target) * 100).toFixed(1))
      : 0;

  const remainingCoalTonnes = Math.max(0, target.coal_target_tonnes - coalTonnes);
  const remainingWasteTonnes = Math.max(0, target.waste_target_tonnes - wasteTonnes);
  const remainingDays = Math.max(1, totalDays - dailyRows.length);
  const requiredDailyCoalRate = Math.round(remainingCoalTonnes / remainingDays);
  const requiredDailyWasteRate = Math.round(remainingWasteTonnes / remainingDays);

  return {
    selectedMonth,
    monthLabel,
    availableMonths,
    target,
    totals: {
      coalTonnes,
      wasteTonnes,
      totalTonnes,
      haulTruckLoads,
      haulTruckBcm,
      excavatorBcm,
      dozerPushBcm,
      totalBcm,
      fleetOperatingHours,
      stripRatio,
      expectedTonnesFromBcm,
      reconciliationDriftPct,
      daysLogged: dailyRows.length,
      totalDaysInMonth: totalDays,
      coalTargetProgressPct,
      wasteTargetProgressPct,
      bcmTargetProgressPct,
      remainingCoalTonnes,
      remainingWasteTonnes,
      requiredDailyCoalRate,
      requiredDailyWasteRate,
    },
    dailyRows,
  };
}
