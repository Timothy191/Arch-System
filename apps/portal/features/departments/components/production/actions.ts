'use server';

import { logger } from '@repo/logger/server';
import { FixedWindowStrategy, MemoryStore, RateLimiter } from '@repo/rate-limiter';
import { CacheCategory, cacheInvalidateTags } from '@repo/redis';
import { getAuthenticatedEmployee } from '@repo/supabase';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { revalidatePath } from 'next/cache';
import { withCache } from '@/lib/cache-utils';
import {
  AuthError,
  DatabaseError,
  ForbiddenError,
  RateLimitError,
  ValidationError,
} from '@/lib/errors/error-classes';
import {
  COMBINED_DELAY_GROUP_LABELS,
  COMBINED_DELAY_GROUP_ORDER,
  type CombinedDelayGroupKey,
  type CombinedDelayGroupSummary,
  classifyDelayGroup,
  type DailyProductionRollupRow,
  DEFAULT_PRODUCTION_PLATFORM_TARGETS,
  type ForemanReportSummary,
  type MonthlyProductionTarget,
  type ProductionDailyPerformanceRow,
  type ProductionHorizonTargets,
  type ProductionMachineComplianceRow,
  type ProductionMachineComplianceStatus,
  type ProductionMachineHorizonKey,
  type ProductionMachineHorizonMetrics,
  type ProductionMachinesHorizonSummary,
  type ProductionMachinesTargetReport,
  type ProductionMonthlyPerformanceRow,
  type ProductionMonthReportData,
  type ProductionPerformanceData,
  type ProductionPlatformTargets,
  type ProductionShiftPerformanceRow,
  type ProductionWeeklyPerformanceRow,
  productionPlatformTargetsSchema,
} from './production-types';

export type {
  CombinedDelayGroupKey,
  CombinedDelayGroupSummary,
  DailyProductionRollupRow,
  ForemanReportSummary,
  MonthlyProductionTarget,
  ProductionDailyPerformanceRow,
  ProductionHorizonKey,
  ProductionHorizonTargets,
  ProductionMachineComplianceRow,
  ProductionMachineComplianceStatus,
  ProductionMachineHorizonKey,
  ProductionMachineHorizonMetrics,
  ProductionMachinesHorizonSummary,
  ProductionMachinesTargetReport,
  ProductionMonthlyPerformanceRow,
  ProductionMonthReportData,
  ProductionPdfScope,
  ProductionPerformanceData,
  ProductionPlatformTargets,
  ProductionReportTab,
  ProductionShiftPerformanceRow,
  ProductionWeeklyPerformanceRow,
} from './production-types';

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

const TARGET_REPORT_TYPE = 'production_platform_targets';
const DEFAULT_BIN_FACTOR = 18.5;
const DOZER_BCM_PER_HOUR = 250;
const MEETING_TARGET_THRESHOLD_PCT = 90;
const STANDARD_SHIFT_HOURS = 12;
const MINUTES_PER_HOUR = 60;

const targetsSaveLimiter = new RateLimiter({
  store: new MemoryStore(),
  strategy: new FixedWindowStrategy(),
  limit: 20,
  windowMs: 60_000,
  keyPrefix: 'ratelimit:production_platform_targets:',
});

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

function formatCalendarDate(monthStr: string, day: number): string {
  return `${monthStr}-${String(day).padStart(2, '0')}`;
}

function cloneDefaultPlatformTargets(): ProductionPlatformTargets {
  return {
    shift: { ...DEFAULT_PRODUCTION_PLATFORM_TARGETS.shift },
    daily: { ...DEFAULT_PRODUCTION_PLATFORM_TARGETS.daily },
    weekly: { ...DEFAULT_PRODUCTION_PLATFORM_TARGETS.weekly },
    monthly: { ...DEFAULT_PRODUCTION_PLATFORM_TARGETS.monthly },
    notes: DEFAULT_PRODUCTION_PLATFORM_TARGETS.notes ?? null,
    updatedAt: null,
  };
}

/**
 * Shared SSoT query so ANY department (Production, Control Room, Drilling, Hub)
 * can pull the monthly Coal & Waste target and current actual progress.
 */
async function getMonthlyProductionTarget(monthStr?: string): Promise<MonthlyProductionTarget> {
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

  try {
    const { data: adminTargetsRow } = await supabase
      .from('report_templates')
      .select('config')
      .eq('report_type', 'operational_targets')
      .is('deleted_at', null)
      .maybeSingle();
    if (adminTargetsRow?.config && typeof adminTargetsRow.config === 'object') {
      const monthly = (
        adminTargetsRow.config as {
          monthly?: {
            coalTonnesTarget?: number;
            wasteTonnesTarget?: number;
            volumeBcmTarget?: number;
          };
        }
      ).monthly;
      if (monthly) {
        return {
          target_month: targetMonth,
          coal_target_tonnes: Number(monthly.coalTonnesTarget) || 125000,
          waste_target_tonnes: Number(monthly.wasteTonnesTarget) || 350000,
          bcm_target: Number(monthly.volumeBcmTarget) || 160000,
          notes: `${targetMonth} Target (from Admin Operational Targets)`,
          updated_at: null,
        };
      }
    }
  } catch {
    // Fall back to static monthly defaults when report_templates is unavailable
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
 * Reads Production Platform Targets (Shift, Daily, Weekly, Monthly) from `report_templates`.
 */
export async function getProductionPlatformTargets(): Promise<ProductionPlatformTargets> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data } = await supabase
      .from('report_templates')
      .select('config, updated_at')
      .eq('report_type', TARGET_REPORT_TYPE)
      .is('deleted_at', null)
      .maybeSingle();

    if (data?.config && typeof data.config === 'object') {
      const parsed = productionPlatformTargetsSchema.safeParse(data.config);
      if (parsed.success) {
        return {
          ...parsed.data,
          notes: parsed.data.notes ?? null,
          updatedAt: parsed.data.updatedAt ?? data.updated_at ?? null,
        };
      }
    }

    const { data: adminTargetsRow } = await supabase
      .from('report_templates')
      .select('config, updated_at')
      .eq('report_type', 'operational_targets')
      .is('deleted_at', null)
      .maybeSingle();
    if (adminTargetsRow?.config && typeof adminTargetsRow.config === 'object') {
      const cfg = adminTargetsRow.config as {
        shift?: ProductionPlatformTargets['shift'] & { volumeBcmTarget?: number };
        daily?: ProductionPlatformTargets['daily'] & { volumeBcmTarget?: number };
        monthly?: ProductionPlatformTargets['monthly'] & { volumeBcmTarget?: number };
      };
      if (cfg.shift && cfg.daily && cfg.monthly) {
        const weeklyDays = 7;
        const dailyVolumeBcmTarget =
          (cfg.daily as { volumeBcmTarget?: number }).volumeBcmTarget ?? cfg.daily.pitBcmTarget;
        const dailyRolloverTargetBcm = cfg.daily.rolloverTargetBcm ?? 1300;
        return {
          shift: { ...cfg.shift },
          daily: { ...cfg.daily },
          weekly: {
            loadsTarget: cfg.daily.loadsTarget * weeklyDays,
            coalTonnesTarget: cfg.daily.coalTonnesTarget * weeklyDays,
            wasteTonnesTarget: cfg.daily.wasteTonnesTarget * weeklyDays,
            pitBcmTarget: dailyVolumeBcmTarget * weeklyDays,
            rolloverTargetBcm: dailyRolloverTargetBcm * weeklyDays,
            smrHoursTarget: cfg.daily.smrHoursTarget * weeklyDays,
          },
          monthly: { ...cfg.monthly },
          notes: 'Derived from Admin Operational Targets',
          updatedAt: adminTargetsRow.updated_at ?? null,
        };
      }
    }
  } catch {
    // Fallback to structured industrial defaults when table/row is absent
  }

  return cloneDefaultPlatformTargets();
}

/**
 * Validates, rate-limits, persists, and broadcasts Production Platform Targets across horizons,
 * syncing monthly Coal, Waste, and Pit BCM targets to `production_monthly_targets`.
 */
export async function saveProductionPlatformTargets(
  rawInput: ProductionPlatformTargets
): Promise<{ success: true; targets: ProductionPlatformTargets }> {
  const supabase = await createServerSupabaseClient();
  const principal = await getAuthenticatedEmployee(supabase);
  if (!principal?.user) {
    throw new AuthError('Unauthorized');
  }

  const accessibleDepts = principal.employee?.accessible_departments ?? [];
  const isAdmin = (principal.employee?.role ?? '').toLowerCase() === 'admin';
  if (!isAdmin && accessibleDepts.length > 0 && !accessibleDepts.includes('production')) {
    throw new ForbiddenError('Insufficient department access to modify production targets');
  }

  const parsed = productionPlatformTargetsSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid production target input');
  }

  const { allowed } = await targetsSaveLimiter.check(principal.user.id);
  if (!allowed) {
    throw new RateLimitError('Too many target updates. Please wait a minute before retrying.');
  }

  const nowIso = new Date().toISOString();
  const normalizedTargets: ProductionPlatformTargets = {
    shift: parsed.data.shift,
    daily: parsed.data.daily,
    weekly: parsed.data.weekly,
    monthly: parsed.data.monthly,
    notes: parsed.data.notes?.trim() || null,
    updatedAt: nowIso,
  };

  const { data: existing, error: fetchError } = await supabase
    .from('report_templates')
    .select('id')
    .eq('report_type', TARGET_REPORT_TYPE)
    .is('deleted_at', null)
    .maybeSingle();

  if (fetchError) {
    throw new DatabaseError('Failed to check existing production targets', {
      table: 'report_templates',
      cause: fetchError,
    });
  }

  if (existing?.id) {
    const { error: updateError } = await supabase
      .from('report_templates')
      .update({
        config: normalizedTargets as never,
        updated_at: nowIso,
      })
      .eq('id', existing.id);

    if (updateError) {
      throw new DatabaseError('Failed to update production platform targets', {
        table: 'report_templates',
        cause: updateError,
      });
    }
  } else {
    const { error: insertError } = await supabase.from('report_templates').insert({
      name: 'Production Platform Targets (Shift, Daily, Weekly, Monthly)',
      description:
        'Multi-horizon Production targets for Pit BCM, ROM Coal, Overburden Waste, Loads, Rollover BCM, and Fleet SMR Hours',
      report_type: TARGET_REPORT_TYPE,
      config: normalizedTargets as never,
      updated_at: nowIso,
    });

    if (insertError) {
      throw new DatabaseError('Failed to save production platform targets', {
        table: 'report_templates',
        cause: insertError,
      });
    }
  }

  const currentMonth = nowIso.slice(0, 7);
  try {
    await supabase.from('production_monthly_targets' as never).upsert(
      {
        target_month: currentMonth,
        coal_target_tonnes: Math.round(normalizedTargets.monthly.coalTonnesTarget),
        waste_target_tonnes: Math.round(normalizedTargets.monthly.wasteTonnesTarget),
        bcm_target: Math.round(normalizedTargets.monthly.pitBcmTarget),
        notes: normalizedTargets.notes || `${currentMonth} Production Target`,
        updated_by: principal.user.id,
        updated_at: nowIso,
      } as never,
      { onConflict: 'target_month' }
    );
  } catch {
    // Keep report_templates save resilient if production_monthly_targets migration is pending
  }

  logger.info({
    event: 'production_platform_targets_saved',
    actorId: principal.user.id,
    action: existing?.id ? 'update' : 'create',
    monthSynced: currentMonth,
  });

  await cacheInvalidateTags([
    'config:production_platform_targets',
    'table:production_logs',
    'table:daily_logs',
  ]);
  revalidatePath('/production');
  revalidatePath('/production/daily-log');
  revalidatePath('/production/machines');
  revalidatePath('/production/history');
  revalidatePath('/production/reports');
  revalidatePath('/control-room');
  revalidatePath('/drilling');
  revalidatePath('/hub');

  return { success: true as const, targets: normalizedTargets };
}

/**
 * Automatically pulls Production Department data for any selected month,
 * populating every calendar day `1..totalDays` of the month.
 */
export async function getProductionDepartmentData(
  monthStr?: string,
  _deptId?: string
): Promise<ProductionMonthReportData> {
  const availableMonths = buildAvailableMonths();
  const selectedMonth = monthStr || availableMonths[0]!.value;

  return withCache(
    async () => {
      const supabase = await createServerSupabaseClient();
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
      const createEmptyBucket = (date: string): MutableDayBucket => ({
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
      });

      // Pre-populate all calendar days 1..totalDays so every day of the month renders in the ledger
      for (let day = 1; day <= totalDays; day++) {
        const calendarDate = formatCalendarDate(selectedMonth, day);
        dayMap.set(calendarDate, createEmptyBucket(calendarDate));
      }

      const ensureDay = (date: string): MutableDayBucket => {
        let bucket = dayMap.get(date);
        if (!bucket) {
          bucket = createEmptyBucket(date);
          dayMap.set(date, bucket);
        }
        return bucket;
      };

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

      for (const hl of hourlyLoads ?? []) {
        const b = ensureDay(hl.load_date);
        const loads = Number(hl.total_loads) || 0;
        const machineObj = Array.isArray(hl.machine) ? hl.machine[0] : hl.machine;
        const binFactor = Number(machineObj?.bin_factor) || DEFAULT_BIN_FACTOR;
        const bcm = loads * binFactor;
        b.haulTruckLoads += loads;
        b.haulTruckBcm += bcm;
        if (hl.machine_id) b.machineIds.add(hl.machine_id);
      }

      for (const ea of excavatorAssignments ?? []) {
        const act = Array.isArray(ea.excavator_activity)
          ? ea.excavator_activity[0]
          : ea.excavator_activity;
        const date = act?.activity_date;
        if (!date) continue;
        const b = ensureDay(date);
        b.excavatorBcm += Number(ea.total_bcm) || 0;
      }

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
          b.dozerPushBcm += hrs * DOZER_BCM_PER_HOUR;
        }
      }

      for (const dr of dozerRolls ?? []) {
        const b = ensureDay(dr.roll_date);
        const hrs = Number(dr.hours_operated) || 0;
        if (hrs > 0 && b.dozerPushBcm === 0) {
          b.dozerPushBcm += hrs * DOZER_BCM_PER_HOUR;
        }
        if (dr.machine_id) b.machineIds.add(dr.machine_id);
      }

      const dailyRows: DailyProductionRollupRow[] = Array.from(dayMap.values())
        .sort((a, b) => b.date.localeCompare(a.date))
        .map((b) => {
          const hasData =
            b.dayShiftCoalTonnes > 0 ||
            b.nightShiftCoalTonnes > 0 ||
            b.dayShiftWasteTonnes > 0 ||
            b.nightShiftWasteTonnes > 0 ||
            b.haulTruckLoads > 0 ||
            b.excavatorBcm > 0 ||
            b.dozerPushBcm > 0 ||
            b.fleetOperatingHours > 0;

          const totalBcm = Math.max(b.haulTruckBcm, b.excavatorBcm) + b.dozerPushBcm;
          let dayCoal = b.dayShiftCoalTonnes;
          let nightCoal = b.nightShiftCoalTonnes;
          let dayWaste = b.dayShiftWasteTonnes;
          let nightWaste = b.nightShiftWasteTonnes;

          const loggedSum = dayCoal + nightCoal + dayWaste + nightWaste;
          if (loggedSum === 0 && totalBcm > 0) {
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
            hasData,
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

      let coalTonnes = 0;
      let wasteTonnes = 0;
      let haulTruckLoads = 0;
      let haulTruckBcm = 0;
      let excavatorBcm = 0;
      let dozerPushBcm = 0;
      let totalBcm = 0;
      let totalFleetOperatingHours = 0;
      let daysLogged = 0;

      for (const r of dailyRows) {
        if (r.hasData) daysLogged += 1;
        coalTonnes += r.totalCoalTonnes;
        wasteTonnes += r.totalWasteTonnes;
        haulTruckLoads += r.haulTruckLoads;
        haulTruckBcm += r.haulTruckBcm;
        excavatorBcm += r.excavatorBcm;
        dozerPushBcm += r.dozerPushBcm;
        totalBcm += r.totalBcm;
        totalFleetOperatingHours += r.fleetOperatingHours;
      }

      const totalTonnes = coalTonnes + wasteTonnes;
      const fleetOperatingHours = Number(totalFleetOperatingHours.toFixed(1));
      const stripRatio = coalTonnes > 0 ? Number((wasteTonnes / coalTonnes).toFixed(2)) : 0;

      const expectedTonnesFromBcm = Math.round(totalBcm * 1.95);
      const reconciliationDriftPct =
        expectedTonnesFromBcm > 0
          ? Number(
              (((totalTonnes - expectedTonnesFromBcm) / expectedTonnesFromBcm) * 100).toFixed(2)
            )
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
      const remainingDays = Math.max(1, totalDays - daysLogged);
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
          daysLogged,
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
    },
    {
      category: CacheCategory.METRICS,
      keyParts: ['production', 'monthly-report-v2', selectedMonth],
      tags: [
        'table:production_logs',
        'table:daily_logs',
        'table:hourly_loads',
        'table:machine_operations',
      ],
    }
  );
}

// ─── Item 3: Production Machines Target Compliance ──────────────────────────

type MachineRoleCategory = 'haulage' | 'excavation' | 'dozer' | 'support';

function classifyProductionMachineRole(
  machineType: string | null | undefined
): MachineRoleCategory {
  const norm = (machineType ?? '').toLowerCase();
  if (/dozer/.test(norm)) return 'dozer';
  if (/excavator|shovel|loader/.test(norm)) return 'excavation';
  if (/haul|truck|adt|dumper|tipper/.test(norm)) return 'haulage';
  return 'support';
}

function isProductionFleetMachine(machineType: string | null | undefined): boolean {
  const norm = (machineType ?? '').toLowerCase();
  return /haul|truck|adt|dumper|tipper|excavator|dozer|loader|shovel|grader/.test(norm);
}

interface MachineActualAccumulator {
  loads: number;
  pitBcm: number;
  rolloverBcm: number;
  hours: number;
}

function createEmptyMachineAcc(): MachineActualAccumulator {
  return { loads: 0, pitBcm: 0, rolloverBcm: 0, hours: 0 };
}

function computeHorizonMetrics(options: {
  actual: MachineActualAccumulator;
  role: MachineRoleCategory;
  horizonTargets: ProductionHorizonTargets;
  roleCounts: Record<MachineRoleCategory, number>;
  totalActiveCount: number;
}): ProductionMachineHorizonMetrics {
  const { actual, role, horizonTargets, roleCounts, totalActiveCount } = options;
  const haulerCount = Math.max(1, roleCounts.haulage);
  const excavatorCount = Math.max(1, roleCounts.excavation);
  const dozerCount = Math.max(1, roleCounts.dozer);
  const fleetCount = Math.max(1, totalActiveCount);

  let targetLoads = 0;
  let targetPitBcm = 0;
  let targetRolloverBcm = 0;
  const targetHours = Number((horizonTargets.smrHoursTarget / fleetCount).toFixed(1));

  if (role === 'haulage') {
    targetLoads = Math.round(horizonTargets.loadsTarget / haulerCount);
    targetPitBcm = Math.round(horizonTargets.pitBcmTarget / haulerCount);
  } else if (role === 'excavation') {
    targetLoads = Math.round(horizonTargets.loadsTarget / excavatorCount);
    targetPitBcm = Math.round(horizonTargets.pitBcmTarget / excavatorCount);
  } else if (role === 'dozer') {
    targetRolloverBcm = Math.round(horizonTargets.rolloverTargetBcm / dozerCount);
    targetPitBcm = targetRolloverBcm;
  } else {
    targetPitBcm = Math.round(horizonTargets.pitBcmTarget / fleetCount);
  }

  const ratios: number[] = [];
  if (targetLoads > 0) ratios.push((actual.loads / targetLoads) * 100);
  if (targetPitBcm > 0) ratios.push((actual.pitBcm / targetPitBcm) * 100);
  if (targetRolloverBcm > 0) ratios.push((actual.rolloverBcm / targetRolloverBcm) * 100);
  if (targetHours > 0) ratios.push((actual.hours / targetHours) * 100);

  const hasAnyActivity =
    actual.loads > 0 || actual.pitBcm > 0 || actual.rolloverBcm > 0 || actual.hours > 0;
  const rawAttainment =
    ratios.length > 0 ? ratios.reduce((acc, r) => acc + r, 0) / ratios.length : 0;
  const attainmentPct = Number(Math.min(150, rawAttainment).toFixed(1));

  let status: ProductionMachineComplianceStatus = 'idle';
  if (hasAnyActivity) {
    status = attainmentPct >= MEETING_TARGET_THRESHOLD_PCT ? 'meeting' : 'below';
  }

  return {
    actualLoads: Math.round(actual.loads),
    targetLoads,
    actualPitBcm: Math.round(actual.pitBcm),
    targetPitBcm,
    actualRolloverBcm: Math.round(actual.rolloverBcm),
    targetRolloverBcm,
    actualHours: Number(actual.hours.toFixed(1)),
    targetHours,
    attainmentPct,
    status,
  };
}

function summarizeHorizonRows(
  rows: readonly ProductionMachineComplianceRow[],
  horizon: ProductionMachineHorizonKey
): ProductionMachinesHorizonSummary {
  let meetingCount = 0;
  let belowCount = 0;
  let idleCount = 0;
  let attainmentSum = 0;

  for (const row of rows) {
    const metrics = row.horizons[horizon];
    attainmentSum += metrics.attainmentPct;
    if (metrics.status === 'meeting') meetingCount += 1;
    else if (metrics.status === 'below') belowCount += 1;
    else idleCount += 1;
  }

  return {
    totalFleet: rows.length,
    meetingCount,
    belowCount,
    idleCount,
    avgAttainmentPct: rows.length > 0 ? Number((attainmentSum / rows.length).toFixed(1)) : 0,
  };
}

/**
 * Evaluates active production fleet compliance against Shift, Daily, and Monthly targets.
 */
export async function getProductionMachinesTargetReport(
  asOfDate?: string
): Promise<ProductionMachinesTargetReport> {
  const effectiveDate = asOfDate || new Date().toISOString().split('T')[0]!;
  const monthPrefix = effectiveDate.slice(0, 7);
  const { startDate } = getMonthDateBounds(monthPrefix);

  const supabase = await createServerSupabaseClient();
  const [targets, machinesRes, loadsRes, assignmentsRes, dozerRes, opsRes] = await Promise.all([
    getProductionPlatformTargets(),
    supabase
      .from('machines')
      .select('id, name, machine_type, serial_number, bin_factor, active, site:sites(name)')
      .eq('active', true)
      .order('name'),
    supabase
      .from('hourly_loads')
      .select('machine_id, load_date, shift_type, total_loads')
      .gte('load_date', startDate)
      .lte('load_date', effectiveDate),
    supabase
      .from('excavator_dumper_assignments')
      .select(
        'dumper_machine_id, total_loads, total_bcm, excavator_activity!inner(activity_date, shift_type, machine_id)'
      )
      .gte('excavator_activity.activity_date', startDate)
      .lte('excavator_activity.activity_date', effectiveDate),
    supabase
      .from('dozer_rolls')
      .select('machine_id, roll_date, shift_type, hours_operated')
      .gte('roll_date', startDate)
      .lte('roll_date', effectiveDate),
    supabase
      .from('machine_operations')
      .select('machine_id, shift_date, shift_type, hours_worked')
      .gte('shift_date', startDate)
      .lte('shift_date', effectiveDate),
  ]);

  const rawMachines = machinesRes.data ?? [];
  const filteredMachines = rawMachines.filter((m) => isProductionFleetMachine(m.machine_type));
  const fleet = filteredMachines.length > 0 ? filteredMachines : rawMachines;

  const hasTodayNightShift =
    (loadsRes.data ?? []).some((r) => r.load_date === effectiveDate && r.shift_type === 'night') ||
    (opsRes.data ?? []).some((r) => r.shift_date === effectiveDate && r.shift_type === 'night');
  const activeShiftType: 'day' | 'night' = hasTodayNightShift ? 'night' : 'day';

  const binFactorByMachine = new Map<string, number>();
  const roleByMachine = new Map<string, MachineRoleCategory>();
  const roleCounts: Record<MachineRoleCategory, number> = {
    haulage: 0,
    excavation: 0,
    dozer: 0,
    support: 0,
  };

  for (const m of fleet) {
    binFactorByMachine.set(m.id, Number(m.bin_factor) || DEFAULT_BIN_FACTOR);
    const role = classifyProductionMachineRole(m.machine_type);
    roleByMachine.set(m.id, role);
    roleCounts[role] += 1;
  }

  const shiftMap = new Map<string, MachineActualAccumulator>();
  const dailyMap = new Map<string, MachineActualAccumulator>();
  const monthlyMap = new Map<string, MachineActualAccumulator>();

  const getAcc = (map: Map<string, MachineActualAccumulator>, machineId: string) => {
    let acc = map.get(machineId);
    if (!acc) {
      acc = createEmptyMachineAcc();
      map.set(machineId, acc);
    }
    return acc;
  };

  const applyRecord = (
    machineId: string | null | undefined,
    date: string | null | undefined,
    shiftType: string | null | undefined,
    delta: Partial<MachineActualAccumulator>
  ) => {
    if (!machineId || !date || !roleByMachine.has(machineId)) return;
    const targetsToUpdate: MachineActualAccumulator[] = [getAcc(monthlyMap, machineId)];
    if (date === effectiveDate) {
      targetsToUpdate.push(getAcc(dailyMap, machineId));
      const normalizedShift = shiftType === 'night' ? 'night' : 'day';
      if (normalizedShift === activeShiftType) {
        targetsToUpdate.push(getAcc(shiftMap, machineId));
      }
    }
    for (const acc of targetsToUpdate) {
      acc.loads += delta.loads ?? 0;
      acc.pitBcm += delta.pitBcm ?? 0;
      acc.rolloverBcm += delta.rolloverBcm ?? 0;
      acc.hours += delta.hours ?? 0;
    }
  };

  for (const hl of loadsRes.data ?? []) {
    const loads = Number(hl.total_loads) || 0;
    const bcm = loads * (binFactorByMachine.get(hl.machine_id) ?? DEFAULT_BIN_FACTOR);
    applyRecord(hl.machine_id, hl.load_date, hl.shift_type, { loads, pitBcm: bcm });
  }

  for (const ea of assignmentsRes.data ?? []) {
    const act = Array.isArray(ea.excavator_activity)
      ? ea.excavator_activity[0]
      : ea.excavator_activity;
    if (!act?.activity_date) continue;
    const bcm = Number(ea.total_bcm) || 0;
    const loads = Number(ea.total_loads) || 0;
    applyRecord(act.machine_id, act.activity_date, act.shift_type, { loads, pitBcm: bcm });
  }

  for (const op of opsRes.data ?? []) {
    const hrs = Number(op.hours_worked) || 0;
    const role = roleByMachine.get(op.machine_id);
    const rollover = role === 'dozer' && hrs > 0 ? hrs * DOZER_BCM_PER_HOUR : 0;
    applyRecord(op.machine_id, op.shift_date, op.shift_type, {
      hours: hrs,
      rolloverBcm: rollover,
      pitBcm: rollover,
    });
  }

  for (const dr of dozerRes.data ?? []) {
    const hrs = Number(dr.hours_operated) || 0;
    const rollover = hrs * DOZER_BCM_PER_HOUR;
    const monthlyAcc = getAcc(monthlyMap, dr.machine_id);
    if (hrs > 0 && monthlyAcc.rolloverBcm === 0) {
      applyRecord(dr.machine_id, dr.roll_date, dr.shift_type, {
        rolloverBcm: rollover,
        pitBcm: rollover,
      });
    }
  }

  const rows: ProductionMachineComplianceRow[] = fleet.map((m) => {
    const siteRel = Array.isArray(m.site) ? m.site[0] : m.site;
    const role = roleByMachine.get(m.id) ?? 'support';
    return {
      machineId: m.id,
      name: m.name,
      machineType: m.machine_type || 'Production Equipment',
      serialNumber: m.serial_number ?? null,
      siteName: siteRel?.name || 'Main Pit',
      roleCategory: role,
      horizons: {
        shift: computeHorizonMetrics({
          actual: shiftMap.get(m.id) ?? createEmptyMachineAcc(),
          role,
          horizonTargets: targets.shift,
          roleCounts,
          totalActiveCount: fleet.length,
        }),
        daily: computeHorizonMetrics({
          actual: dailyMap.get(m.id) ?? createEmptyMachineAcc(),
          role,
          horizonTargets: targets.daily,
          roleCounts,
          totalActiveCount: fleet.length,
        }),
        monthly: computeHorizonMetrics({
          actual: monthlyMap.get(m.id) ?? createEmptyMachineAcc(),
          role,
          horizonTargets: targets.monthly,
          roleCounts,
          totalActiveCount: fleet.length,
        }),
      },
    };
  });

  return {
    asOfDate: effectiveDate,
    activeShiftLabel: activeShiftType === 'night' ? 'Night Shift' : 'Day Shift',
    targets,
    summaryByHorizon: {
      shift: summarizeHorizonRows(rows, 'shift'),
      daily: summarizeHorizonRows(rows, 'daily'),
      monthly: summarizeHorizonRows(rows, 'monthly'),
    },
    machines: rows,
  };
}

// ─── Items 4, 5, 7: Performance, Combined Delays & Foreman Report ────────────

interface DelayAccumulator {
  hours: number;
  events: number;
}

interface RawDelayEntry {
  duration_hours: number | null;
  deleted_at: string | null;
  delay_category?: { name: string } | { name: string }[] | null;
}

function getDelayCategoryName(cat: RawDelayEntry['delay_category']): string | null {
  if (!cat) return null;
  return Array.isArray(cat) ? (cat[0]?.name ?? null) : cat.name;
}

/**
 * Aggregates Shift, Daily, Weekly, Monthly production performance vs targets,
 * Combined Delays across Production/Engineering/Natural/Non-Site groups, and Foreman Report summary.
 */
export async function getProductionPerformanceData(
  monthStr?: string,
  _deptId?: string
): Promise<ProductionPerformanceData> {
  const availableMonths = buildAvailableMonths();
  const selectedMonth = monthStr || availableMonths[0]!.value;
  const { startDate, endDate, totalDays, monthLabel } = getMonthDateBounds(selectedMonth);

  const supabase = await createServerSupabaseClient();
  const [monthReport, targets, hourlyRes, excavatorRes, dozerRes, opsRes, logsRes] =
    await Promise.all([
      getProductionDepartmentData(selectedMonth, _deptId),
      getProductionPlatformTargets(),
      supabase
        .from('hourly_loads')
        .select('load_date, shift_type, total_loads, machine:machines!machine_id(bin_factor)')
        .gte('load_date', startDate)
        .lte('load_date', endDate),
      supabase
        .from('excavator_dumper_assignments')
        .select('total_bcm, excavator_activity!inner(activity_date, shift_type)')
        .gte('excavator_activity.activity_date', startDate)
        .lte('excavator_activity.activity_date', endDate),
      supabase
        .from('dozer_rolls')
        .select('roll_date, shift_type, hours_operated')
        .gte('roll_date', startDate)
        .lte('roll_date', endDate),
      supabase
        .from('machine_operations')
        .select(
          'shift_date, shift_type, hours_worked, machine:machines(machine_type), delay_entries:delay_entries(duration_hours, deleted_at, delay_category:delay_categories(name))'
        )
        .gte('shift_date', startDate)
        .lte('shift_date', endDate),
      supabase
        .from('daily_logs')
        .select('log_date, shift, notes')
        .gte('log_date', startDate)
        .lte('log_date', endDate)
        .order('log_date', { ascending: false }),
    ]);

  const dailyDelayHours = new Map<string, number>();
  const delayGroupMap = new Map<CombinedDelayGroupKey, DelayAccumulator>();
  for (const key of COMBINED_DELAY_GROUP_ORDER) {
    delayGroupMap.set(key, { hours: 0, events: 0 });
  }

  interface MutableShiftBucket {
    date: string;
    shiftType: 'day' | 'night';
    haulBcm: number;
    excavatorBcm: number;
    rolloverBcm: number;
    haulLoads: number;
    smrHours: number;
    combinedDelayHours: number;
  }

  const shiftMap = new Map<string, MutableShiftBucket>();
  const ensureShift = (date: string, rawShift: string | null | undefined): MutableShiftBucket => {
    const shiftType: 'day' | 'night' = rawShift === 'night' ? 'night' : 'day';
    const key = `${date}|${shiftType}`;
    let bucket = shiftMap.get(key);
    if (!bucket) {
      bucket = {
        date,
        shiftType,
        haulBcm: 0,
        excavatorBcm: 0,
        rolloverBcm: 0,
        haulLoads: 0,
        smrHours: 0,
        combinedDelayHours: 0,
      };
      shiftMap.set(key, bucket);
    }
    return bucket;
  };

  for (const hl of hourlyRes.data ?? []) {
    const b = ensureShift(hl.load_date, hl.shift_type);
    const loads = Number(hl.total_loads) || 0;
    const machineObj = Array.isArray(hl.machine) ? hl.machine[0] : hl.machine;
    const binFactor = Number(machineObj?.bin_factor) || DEFAULT_BIN_FACTOR;
    b.haulLoads += loads;
    b.haulBcm += loads * binFactor;
  }

  for (const ea of excavatorRes.data ?? []) {
    const act = Array.isArray(ea.excavator_activity)
      ? ea.excavator_activity[0]
      : ea.excavator_activity;
    if (!act?.activity_date) continue;
    const b = ensureShift(act.activity_date, act.shift_type);
    b.excavatorBcm += Number(ea.total_bcm) || 0;
  }

  for (const op of opsRes.data ?? []) {
    const b = ensureShift(op.shift_date, op.shift_type);
    const hrs = Number(op.hours_worked) || 0;
    b.smrHours += hrs;
    const machineObj = Array.isArray(op.machine) ? op.machine[0] : op.machine;
    const isDozer = Boolean(machineObj?.machine_type?.toLowerCase().includes('dozer'));
    if (isDozer && hrs > 0) {
      b.rolloverBcm += hrs * DOZER_BCM_PER_HOUR;
    }

    const entries = (op.delay_entries ?? []) as unknown as RawDelayEntry[];
    for (const entry of entries) {
      if (entry.deleted_at) continue;
      const delayHrs = Number(entry.duration_hours) || 0;
      if (delayHrs <= 0) continue;
      b.combinedDelayHours += delayHrs;
      dailyDelayHours.set(op.shift_date, (dailyDelayHours.get(op.shift_date) ?? 0) + delayHrs);
      const groupKey = classifyDelayGroup(getDelayCategoryName(entry.delay_category));
      const groupAcc = delayGroupMap.get(groupKey)!;
      groupAcc.hours += delayHrs;
      groupAcc.events += 1;
    }
  }

  for (const dr of dozerRes.data ?? []) {
    const b = ensureShift(dr.roll_date, dr.shift_type);
    const hrs = Number(dr.hours_operated) || 0;
    if (hrs > 0 && b.rolloverBcm === 0) {
      b.rolloverBcm += hrs * DOZER_BCM_PER_HOUR;
    }
  }

  const dailyCoalWasteMap = new Map<string, DailyProductionRollupRow>();
  for (const dr of monthReport.dailyRows) {
    dailyCoalWasteMap.set(dr.date, dr);
  }

  const shiftRows: ProductionShiftPerformanceRow[] = Array.from(shiftMap.values())
    .sort((a, b) =>
      a.date === b.date ? (a.shiftType === 'night' ? -1 : 1) : b.date.localeCompare(a.date)
    )
    .map((b) => {
      const pitBcm = Math.round(Math.max(b.haulBcm, b.excavatorBcm) + b.rolloverBcm);
      const dayRow = dailyCoalWasteMap.get(b.date);
      const coalTonnes =
        b.shiftType === 'night'
          ? (dayRow?.nightShiftCoalTonnes ?? 0)
          : (dayRow?.dayShiftCoalTonnes ?? 0);
      const wasteTonnes =
        b.shiftType === 'night'
          ? (dayRow?.nightShiftWasteTonnes ?? 0)
          : (dayRow?.dayShiftWasteTonnes ?? 0);
      const pitBcmTarget = targets.shift.pitBcmTarget;
      const pitBcmAttainmentPct =
        pitBcmTarget > 0 ? Number(((pitBcm / pitBcmTarget) * 100).toFixed(1)) : 0;
      const availableHrs = b.smrHours + b.combinedDelayHours;
      const productiveEfficiencyPct =
        availableHrs > 0
          ? Number(((b.smrHours / availableHrs) * 100).toFixed(1))
          : pitBcm > 0
            ? Number(
                Math.max(
                  0,
                  ((STANDARD_SHIFT_HOURS - b.combinedDelayHours) / STANDARD_SHIFT_HOURS) * 100
                ).toFixed(1)
              )
            : 0;

      return {
        id: `${b.date}|${b.shiftType}`,
        date: b.date,
        shiftType: b.shiftType,
        pitBcm,
        pitBcmTarget,
        pitBcmAttainmentPct,
        coalTonnes,
        wasteTonnes,
        haulLoads: b.haulLoads,
        rolloverBcm: Math.round(b.rolloverBcm),
        smrHours: Number(b.smrHours.toFixed(1)),
        combinedDelayHours: Number(b.combinedDelayHours.toFixed(1)),
        productiveEfficiencyPct,
      };
    });

  const dailyRows: ProductionDailyPerformanceRow[] = monthReport.dailyRows.map((row) => {
    const pitBcmTarget = targets.daily.pitBcmTarget;
    const delayHrs = Number((dailyDelayHours.get(row.date) ?? 0).toFixed(1));
    const pitBcmVariance = row.totalBcm - pitBcmTarget;
    const pitBcmAttainmentPct =
      pitBcmTarget > 0 ? Number(((row.totalBcm / pitBcmTarget) * 100).toFixed(1)) : 0;
    return {
      date: row.date,
      hasData: row.hasData,
      pitBcm: row.totalBcm,
      pitBcmTarget,
      pitBcmVariance,
      pitBcmAttainmentPct,
      coalTonnes: row.totalCoalTonnes,
      wasteTonnes: row.totalWasteTonnes,
      haulLoads: row.haulTruckLoads,
      rolloverBcm: row.dozerPushBcm,
      smrHours: row.fleetOperatingHours,
      combinedDelayHours: delayHrs,
    };
  });

  const weekRanges: Array<{ label: string; startDay: number; endDay: number }> = [
    { label: 'Week 1', startDay: 1, endDay: 7 },
    { label: 'Week 2', startDay: 8, endDay: 14 },
    { label: 'Week 3', startDay: 15, endDay: 21 },
    { label: 'Week 4', startDay: 22, endDay: 28 },
  ];
  if (totalDays > 28) {
    weekRanges.push({ label: 'Week 5', startDay: 29, endDay: totalDays });
  }

  const weeklyRows: ProductionWeeklyPerformanceRow[] = weekRanges.map((wk) => {
    const wkStart = formatCalendarDate(selectedMonth, wk.startDay);
    const wkEnd = formatCalendarDate(selectedMonth, wk.endDay);
    let daysCaptured = 0;
    let pitBcm = 0;
    let coalTonnes = 0;
    let wasteTonnes = 0;
    let haulLoads = 0;
    let rolloverBcm = 0;
    let smrHours = 0;
    let combinedDelayHours = 0;

    for (const d of dailyRows) {
      if (d.date >= wkStart && d.date <= wkEnd) {
        if (d.hasData) daysCaptured += 1;
        pitBcm += d.pitBcm;
        coalTonnes += d.coalTonnes;
        wasteTonnes += d.wasteTonnes;
        haulLoads += d.haulLoads;
        rolloverBcm += d.rolloverBcm;
        smrHours += d.smrHours;
        combinedDelayHours += d.combinedDelayHours;
      }
    }

    const pitBcmTarget = targets.weekly.pitBcmTarget;
    return {
      weekLabel: wk.label,
      dateRangeLabel: `${wkStart.slice(5)} to ${wkEnd.slice(5)}`,
      startDate: wkStart,
      endDate: wkEnd,
      daysCaptured,
      pitBcm,
      pitBcmTarget,
      pitBcmAttainmentPct:
        pitBcmTarget > 0 ? Number(((pitBcm / pitBcmTarget) * 100).toFixed(1)) : 0,
      coalTonnes,
      wasteTonnes,
      haulLoads,
      rolloverBcm,
      smrHours: Number(smrHours.toFixed(1)),
      combinedDelayHours: Number(combinedDelayHours.toFixed(1)),
    };
  });

  let totalCombinedDelayHours = 0;
  for (const acc of delayGroupMap.values()) {
    totalCombinedDelayHours += acc.hours;
  }
  const avgBcmPerSmrHour =
    monthReport.totals.fleetOperatingHours > 0
      ? monthReport.totals.totalBcm / monthReport.totals.fleetOperatingHours
      : DEFAULT_BIN_FACTOR * 8;

  const delayGroups: CombinedDelayGroupSummary[] = COMBINED_DELAY_GROUP_ORDER.map((key) => {
    const acc = delayGroupMap.get(key)!;
    const delayHours = Number(acc.hours.toFixed(1));
    const sharePct =
      totalCombinedDelayHours > 0
        ? Number(((acc.hours / totalCombinedDelayHours) * 100).toFixed(1))
        : 0;
    return {
      key,
      label: COMBINED_DELAY_GROUP_LABELS[key],
      delayHours,
      delayMinutes: Math.round(acc.hours * MINUTES_PER_HOUR),
      sharePct,
      estimatedPitBcmImpact: Math.round(acc.hours * avgBcmPerSmrHour),
      eventCount: acc.events,
    };
  });

  const monthlyRow: ProductionMonthlyPerformanceRow = {
    month: selectedMonth,
    monthLabel,
    pitBcm: monthReport.totals.totalBcm,
    pitBcmTarget: targets.monthly.pitBcmTarget,
    pitBcmAttainmentPct:
      targets.monthly.pitBcmTarget > 0
        ? Number(((monthReport.totals.totalBcm / targets.monthly.pitBcmTarget) * 100).toFixed(1))
        : 0,
    coalTonnes: monthReport.totals.coalTonnes,
    coalTarget: targets.monthly.coalTonnesTarget,
    wasteTonnes: monthReport.totals.wasteTonnes,
    wasteTarget: targets.monthly.wasteTonnesTarget,
    haulLoads: monthReport.totals.haulTruckLoads,
    loadsTarget: targets.monthly.loadsTarget,
    rolloverBcm: monthReport.totals.dozerPushBcm,
    rolloverTarget: targets.monthly.rolloverTargetBcm,
    smrHours: monthReport.totals.fleetOperatingHours,
    smrHoursTarget: targets.monthly.smrHoursTarget,
    combinedDelayHours: Number(totalCombinedDelayHours.toFixed(1)),
    stripRatio: monthReport.totals.stripRatio,
  };

  const totalHoursPool = monthReport.totals.fleetOperatingHours + totalCombinedDelayHours;
  const productiveEfficiencyPct =
    totalHoursPool > 0
      ? Number(((monthReport.totals.fleetOperatingHours / totalHoursPool) * 100).toFixed(1))
      : 100;

  const topDelayGroup = [...delayGroups].sort((a, b) => b.delayHours - a.delayHours)[0];
  const keyVariances: string[] = [
    `Pit BCM Moved: ${monthReport.totals.totalBcm.toLocaleString('en-US')} BCM vs ${targets.monthly.pitBcmTarget.toLocaleString('en-US')} BCM target (${monthlyRow.pitBcmAttainmentPct}% attainment).`,
    `Combined Delays recorded: ${totalCombinedDelayHours.toFixed(1)} hrs total — largest driver: ${topDelayGroup?.label ?? 'Production Delays'} (${topDelayGroup?.delayHours.toFixed(1) ?? '0.0'} hrs).`,
    `Active production days captured: ${monthReport.totals.daysLogged} of ${monthReport.totals.totalDaysInMonth} calendar days in ${monthLabel}.`,
  ];

  const handoverNotes = (logsRes.data ?? [])
    .filter((l) => Boolean(l.notes && l.notes.trim().length > 0))
    .slice(0, 5)
    .map((l) => `${l.log_date} (${l.shift}): ${l.notes!.trim()}`);

  if (handoverNotes.length === 0) {
    handoverNotes.push(
      'Maintain Pit BCM haul cycle focus and clear primary loading benches prior to shift handover.'
    );
  }

  const foremanSummary: ForemanReportSummary = {
    reportDate: endDate,
    supervisorSummary: `${monthLabel} Foreman Production Summary across ${monthReport.totals.daysLogged} active day(s): ${monthReport.totals.totalBcm.toLocaleString('en-US')} Pit BCM moved with ${totalCombinedDelayHours.toFixed(1)} hrs combined delays.`,
    pitBenchProgress: `Haul Truck Pit BCM: ${monthReport.totals.haulTruckBcm.toLocaleString('en-US')} BCM · Excavator Pit BCM: ${monthReport.totals.excavatorBcm.toLocaleString('en-US')} BCM · Dozer Rollover: ${monthReport.totals.dozerPushBcm.toLocaleString('en-US')} BCM.`,
    productiveEfficiencyPct,
    totalPitBcm: monthReport.totals.totalBcm,
    pitBcmTarget: targets.monthly.pitBcmTarget,
    pitBcmAttainmentPct: monthlyRow.pitBcmAttainmentPct,
    totalCoalTonnes: monthReport.totals.coalTonnes,
    totalWasteTonnes: monthReport.totals.wasteTonnes,
    totalHaulLoads: monthReport.totals.haulTruckLoads,
    totalRolloverBcm: monthReport.totals.dozerPushBcm,
    totalSmrHours: monthReport.totals.fleetOperatingHours,
    totalCombinedDelayHours: Number(totalCombinedDelayHours.toFixed(1)),
    delayGroups,
    keyVariances,
    handoverNotes,
  };

  return {
    selectedMonth,
    monthLabel,
    availableMonths,
    targets,
    shiftRows,
    dailyRows,
    weeklyRows,
    monthlyRows: [monthlyRow],
    delayGroups,
    foremanSummary,
  };
}
