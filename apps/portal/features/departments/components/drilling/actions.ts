'use server';

import { drillOperationSchema } from '@repo/contract/schemas/drill.schema';
import { AuthError, ForbiddenError, ValidationError } from '@repo/errors';
import { logger } from '@repo/logger/server';
import { FixedWindowStrategy, MemoryStore, RateLimiter } from '@repo/rate-limiter';
import { cacheInvalidateTags } from '@repo/redis';
import { getAuthenticatedEmployee } from '@repo/supabase';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { revalidatePath } from 'next/cache';

const DRILL_RIG_MACHINE_TYPE = 'Drill Rig';
const DEFAULT_DRILL_RIG_IMAGE = '/images/fleet/atlas-copco-drill.webp';
const DRILLING_SLUG = 'drilling';
const DRILL_DAILY_RATE_LIMIT = 30;
const DRILL_DAILY_WINDOW_MS = 60_000;
const DATE_ISO_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const UNASSIGNED_SITE_LABEL = 'Unassigned Site';
const DECIMAL_PRECISION = 2;
const DRILL_DAILY_CACHE_TAGS = ['table:drill_operations', 'table:daily_logs'] as const;
const DRILL_REVALIDATE_PATHS = [
  '/drilling',
  '/drilling/daily-log',
  '/drilling/drilling-operations',
] as const;

const drillDailyLogLimiter = new RateLimiter({
  store: new MemoryStore(),
  strategy: new FixedWindowStrategy(),
  limit: DRILL_DAILY_RATE_LIMIT,
  windowMs: DRILL_DAILY_WINDOW_MS,
  keyPrefix: 'ratelimit:drilling_daily_log:',
});

export type DrillShiftType = 'day' | 'night';

export interface DrillShiftSnapshot {
  readonly id: string | null;
  readonly shiftType: DrillShiftType;
  readonly metersDrilled: number;
  readonly holes: number;
  readonly site: string | null;
  readonly blockDrilled: string | null;
  readonly operatorName: string | null;
  readonly comments: string | null;
  readonly status: string;
}

export interface DrillRigDailyCardItem {
  readonly machineId: string;
  readonly name: string;
  readonly machineType: string;
  readonly serialNumber: string | null;
  readonly imageUrl: string;
  readonly homeSiteName: string | null;
  readonly homeSiteCode: string | null;
  readonly dayShift: DrillShiftSnapshot | null;
  readonly nightShift: DrillShiftSnapshot | null;
  readonly dailyMetersDrilled: number;
  readonly dailyHolesDrilled: number;
  readonly whereSite: string;
  readonly whereBlock: string | null;
  readonly whereDisplay: string;
  readonly isLogged: boolean;
}

export interface DrillingDailyLogSummary {
  readonly activeRigs: number;
  readonly loggedRigs: number;
  readonly totalDailyMeters: number;
  readonly totalDailyHoles: number;
  readonly activeSitesCount: number;
  readonly activeSites: readonly string[];
}

export interface DrillingDailyLogPageData {
  readonly departmentId: string;
  readonly logDate: string;
  readonly summary: DrillingDailyLogSummary;
  readonly rigs: readonly DrillRigDailyCardItem[];
}

export interface SaveDrillDailyLogInput {
  readonly departmentId: string;
  readonly machineId: string;
  readonly operationDate: string;
  readonly shiftType: DrillShiftType;
  readonly metersDrilled: number;
  readonly holes: number;
  readonly site: string;
  readonly blockDrilled: string;
  readonly comments?: string | null;
  readonly operatorName?: string | null;
}

export interface DrillDailySavedRecord {
  readonly id: string;
  readonly machineId: string;
  readonly departmentId: string;
  readonly operationDate: string;
  readonly shiftType: DrillShiftType;
  readonly metersDrilled: number;
  readonly holes: number;
  readonly site: string | null;
  readonly blockDrilled: string | null;
  readonly operatorName: string | null;
  readonly comments: string | null;
  readonly status: string;
}

export type SaveDrillDailyLogResult =
  | { readonly success: true; readonly record: DrillDailySavedRecord }
  | { readonly success: false; readonly error: string };

interface RawSiteRelation {
  readonly name?: string | null;
  readonly site_code?: string | null;
}

interface RawDrillMachineRow {
  readonly id: string;
  readonly name: string;
  readonly machine_type: string;
  readonly serial_number?: string | null;
  readonly image_url?: string | null;
  readonly site?: RawSiteRelation | readonly RawSiteRelation[] | null;
}

interface RawDrillOperationRow {
  readonly id: string;
  readonly machine_id: string;
  readonly shift_type: string | null;
  readonly meters_drilled: number | null;
  readonly holes: number | null;
  readonly site: string | null;
  readonly block_drilled: string | null;
  readonly operator_name: string | null;
  readonly comments: string | null;
  readonly notes?: string | null;
  readonly status: string | null;
}

interface RawSavedOperationRow {
  readonly id: string;
  readonly machine_id: string;
  readonly department_id: string;
  readonly operation_date: string;
  readonly shift_type: string | null;
  readonly meters_drilled: number | null;
  readonly holes: number | null;
  readonly site: string | null;
  readonly block_drilled: string | null;
  readonly operator_name: string | null;
  readonly comments: string | null;
  readonly status: string | null;
}

interface EmployeeAccessContext {
  readonly role: string;
  readonly department_id: string;
  readonly accessible_departments: readonly string[];
}

function hasDrillingDepartmentAccess(
  employee: EmployeeAccessContext,
  departmentId: string
): boolean {
  if (employee.role === 'admin') {
    return true;
  }
  if (employee.department_id === departmentId) {
    return true;
  }
  return (
    Array.isArray(employee.accessible_departments) &&
    (employee.accessible_departments.includes(departmentId) ||
      employee.accessible_departments.includes(DRILLING_SLUG))
  );
}

function normalizeSiteRelation(
  relation: RawSiteRelation | readonly RawSiteRelation[] | null | undefined
): RawSiteRelation | null {
  if (!relation) {
    return null;
  }
  if (Array.isArray(relation)) {
    return relation[0] ?? null;
  }
  return relation as RawSiteRelation;
}

function normalizeText(rawText: string | null | undefined): string | null {
  if (typeof rawText !== 'string') {
    return null;
  }
  const trimmed = rawText.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toShiftSnapshot(row: RawDrillOperationRow): DrillShiftSnapshot {
  const shiftType: DrillShiftType = row.shift_type === 'night' ? 'night' : 'day';
  return {
    id: row.id,
    shiftType,
    metersDrilled: Number(row.meters_drilled ?? 0),
    holes: Number(row.holes ?? 0),
    site: normalizeText(row.site),
    blockDrilled: normalizeText(row.block_drilled),
    operatorName: normalizeText(row.operator_name),
    comments: normalizeText(row.comments ?? row.notes),
    status: normalizeText(row.status) ?? 'active',
  };
}

function resolveWhereBlock(
  dayShift: DrillShiftSnapshot | null,
  nightShift: DrillShiftSnapshot | null
): string | null {
  const blocks = [dayShift?.blockDrilled ?? null, nightShift?.blockDrilled ?? null].filter(
    (blockLabel): blockLabel is string => Boolean(blockLabel)
  );
  const uniqueBlocks = Array.from(new Set(blocks));
  return uniqueBlocks.length > 0 ? uniqueBlocks.join(' / ') : null;
}

function resolveWhereSite(options: {
  readonly dayShift: DrillShiftSnapshot | null;
  readonly nightShift: DrillShiftSnapshot | null;
  readonly homeSiteName: string | null;
  readonly homeSiteCode: string | null;
}): string {
  const shiftSite = options.nightShift?.site ?? options.dayShift?.site;
  if (shiftSite) {
    return shiftSite;
  }
  if (options.homeSiteName) {
    return options.homeSiteName;
  }
  if (options.homeSiteCode) {
    return options.homeSiteCode;
  }
  return UNASSIGNED_SITE_LABEL;
}

function buildRigDailyCard(options: {
  readonly machine: RawDrillMachineRow;
  readonly dayShift: DrillShiftSnapshot | null;
  readonly nightShift: DrillShiftSnapshot | null;
}): DrillRigDailyCardItem {
  const siteRelation = normalizeSiteRelation(options.machine.site);
  const homeSiteName = normalizeText(siteRelation?.name);
  const homeSiteCode = normalizeText(siteRelation?.site_code);
  const resolvedImage = normalizeText(options.machine.image_url) ?? DEFAULT_DRILL_RIG_IMAGE;
  const dailyMetersDrilled = Number(
    ((options.dayShift?.metersDrilled ?? 0) + (options.nightShift?.metersDrilled ?? 0)).toFixed(
      DECIMAL_PRECISION
    )
  );
  const dailyHolesDrilled = (options.dayShift?.holes ?? 0) + (options.nightShift?.holes ?? 0);
  const whereSite = resolveWhereSite({
    dayShift: options.dayShift,
    nightShift: options.nightShift,
    homeSiteName,
    homeSiteCode,
  });
  const whereBlock = resolveWhereBlock(options.dayShift, options.nightShift);
  const whereDisplay = whereBlock ? `${whereSite} · ${whereBlock}` : whereSite;

  return {
    machineId: options.machine.id,
    name: options.machine.name,
    machineType: options.machine.machine_type,
    serialNumber: normalizeText(options.machine.serial_number),
    imageUrl: resolvedImage,
    homeSiteName,
    homeSiteCode,
    dayShift: options.dayShift,
    nightShift: options.nightShift,
    dailyMetersDrilled,
    dailyHolesDrilled,
    whereSite,
    whereBlock,
    whereDisplay,
    isLogged: Boolean(options.dayShift || options.nightShift),
  };
}

function computeDailySummary(rigs: readonly DrillRigDailyCardItem[]): DrillingDailyLogSummary {
  const activeSitesSet = new Set<string>();
  let loggedRigs = 0;
  let totalDailyMeters = 0;
  let totalDailyHoles = 0;

  for (const rig of rigs) {
    if (rig.isLogged) {
      loggedRigs += 1;
    }
    totalDailyMeters += rig.dailyMetersDrilled;
    totalDailyHoles += rig.dailyHolesDrilled;
    if (rig.whereSite !== UNASSIGNED_SITE_LABEL) {
      activeSitesSet.add(rig.whereSite);
    }
  }

  const activeSites = Array.from(activeSitesSet);
  return {
    activeRigs: rigs.length,
    loggedRigs,
    totalDailyMeters: Number(totalDailyMeters.toFixed(DECIMAL_PRECISION)),
    totalDailyHoles,
    activeSitesCount: activeSites.length,
    activeSites,
  };
}

async function fetchActiveDrillRigs(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>
): Promise<readonly RawDrillMachineRow[]> {
  const primaryQuery = await supabase
    .from('machines')
    .select('id, name, machine_type, serial_number, image_url, site:sites(name, site_code)')
    .eq('machine_type', DRILL_RIG_MACHINE_TYPE)
    .eq('active', true)
    .order('name');

  const typedPrimary = primaryQuery as unknown as {
    readonly data: readonly RawDrillMachineRow[] | null;
    readonly error: { readonly message: string } | null;
  };

  if (!typedPrimary.error) {
    return typedPrimary.data ?? [];
  }

  const fallbackQuery = await supabase
    .from('machines')
    .select('id, name, machine_type, serial_number, site:sites(name, site_code)')
    .eq('machine_type', DRILL_RIG_MACHINE_TYPE)
    .eq('active', true)
    .order('name');

  const typedFallback = fallbackQuery as unknown as {
    readonly data: readonly RawDrillMachineRow[] | null;
  };
  return typedFallback.data ?? [];
}

/**
 * Loads active drill rigs and their Day/Night shift drill operations for a given date.
 */
export async function loadDrillingDailyLogData(options: {
  readonly deptId: string;
  readonly logDate: string;
}): Promise<DrillingDailyLogPageData> {
  if (!options.deptId.trim()) {
    throw new ValidationError('Department ID is required');
  }
  if (!DATE_ISO_REGEX.test(options.logDate)) {
    throw new ValidationError('Log date must use YYYY-MM-DD format');
  }

  const supabase = await createServerSupabaseClient();
  const principal = await getAuthenticatedEmployee(supabase);
  if (!principal?.employee) {
    throw new AuthError('Unauthorized');
  }
  if (!hasDrillingDepartmentAccess(principal.employee, options.deptId)) {
    throw new ForbiddenError('Insufficient drilling department access');
  }

  const [machines, opsResult] = await Promise.all([
    fetchActiveDrillRigs(supabase),
    supabase
      .from('drill_operations')
      .select(
        'id, machine_id, shift_type, meters_drilled, holes, site, block_drilled, operator_name, comments, notes, status'
      )
      .eq('department_id', options.deptId)
      .eq('operation_date', options.logDate),
  ]);

  const opsRows = (opsResult.data ?? []) as unknown as readonly RawDrillOperationRow[];
  const shiftMap = new Map<
    string,
    { day: DrillShiftSnapshot | null; night: DrillShiftSnapshot | null }
  >();

  for (const opRow of opsRows) {
    const snapshot = toShiftSnapshot(opRow);
    const current = shiftMap.get(opRow.machine_id) ?? { day: null, night: null };
    if (snapshot.shiftType === 'night') {
      current.night = snapshot;
    } else {
      current.day = snapshot;
    }
    shiftMap.set(opRow.machine_id, current);
  }

  const rigs = machines.map((machine) => {
    const shifts = shiftMap.get(machine.id);
    return buildRigDailyCard({
      machine,
      dayShift: shifts?.day ?? null,
      nightShift: shifts?.night ?? null,
    });
  });

  return {
    departmentId: options.deptId,
    logDate: options.logDate,
    summary: computeDailySummary(rigs),
    rigs,
  };
}

/**
 * Persists a single drill rig's Day or Night daily meters, holes, and location ("Where").
 */
export async function saveDrillDailyEntry(
  rawInput: SaveDrillDailyLogInput
): Promise<SaveDrillDailyLogResult> {
  const supabase = await createServerSupabaseClient();
  const principal = await getAuthenticatedEmployee(supabase);
  if (!principal?.employee) {
    return { success: false, error: 'Unauthorized access' };
  }

  if (!hasDrillingDepartmentAccess(principal.employee, rawInput.departmentId)) {
    return { success: false, error: 'Forbidden: Drilling department access required' };
  }

  const parsed = drillOperationSchema.safeParse({
    machine_id: rawInput.machineId,
    department_id: rawInput.departmentId,
    operation_date: rawInput.operationDate,
    shift_type: rawInput.shiftType,
    meters_drilled: Number(rawInput.metersDrilled),
    holes: Math.trunc(Number(rawInput.holes)),
    site: normalizeText(rawInput.site),
    block_drilled: normalizeText(rawInput.blockDrilled),
    comments: normalizeText(rawInput.comments),
    operator_name: normalizeText(rawInput.operatorName),
    status: 'active',
  });

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]?.message ?? 'Invalid drilling daily entry';
    return { success: false, error: `Validation error: ${firstIssue}` };
  }

  const { allowed } = await drillDailyLogLimiter.check(principal.user.id);
  if (!allowed) {
    return { success: false, error: 'Rate limit exceeded. Please wait before submitting again.' };
  }

  const upsertPayload = {
    ...parsed.data,
    updated_at: new Date().toISOString(),
    updated_by: principal.user.id,
  };

  const { data: savedRow, error: upsertError } = await supabase
    .from('drill_operations')
    .upsert(upsertPayload as unknown as Record<string, unknown>, {
      onConflict: 'machine_id,operation_date,shift_type',
    })
    .select(
      'id, machine_id, department_id, operation_date, shift_type, meters_drilled, holes, site, block_drilled, operator_name, comments, status'
    )
    .single();

  if (upsertError || !savedRow) {
    return {
      success: false,
      error: upsertError?.message ?? 'Failed to save drilling daily log entry',
    };
  }

  const typedRow = savedRow as unknown as RawSavedOperationRow;
  logger.info({
    event: 'drilling_daily_log_saved',
    actorId: principal.user.id,
    employeeId: principal.employee.id,
    departmentId: typedRow.department_id,
    machineId: typedRow.machine_id,
    operationDate: typedRow.operation_date,
    shiftType: typedRow.shift_type,
    metersDrilled: Number(typedRow.meters_drilled ?? 0),
    holes: Number(typedRow.holes ?? 0),
  });

  for (const path of DRILL_REVALIDATE_PATHS) {
    revalidatePath(path);
  }
  await cacheInvalidateTags([...DRILL_DAILY_CACHE_TAGS]);

  return {
    success: true,
    record: {
      id: typedRow.id,
      machineId: typedRow.machine_id,
      departmentId: typedRow.department_id,
      operationDate: typedRow.operation_date,
      shiftType: typedRow.shift_type === 'night' ? 'night' : 'day',
      metersDrilled: Number(typedRow.meters_drilled ?? 0),
      holes: Number(typedRow.holes ?? 0),
      site: normalizeText(typedRow.site),
      blockDrilled: normalizeText(typedRow.block_drilled),
      operatorName: normalizeText(typedRow.operator_name),
      comments: normalizeText(typedRow.comments),
      status: normalizeText(typedRow.status) ?? 'active',
    },
  };
}
