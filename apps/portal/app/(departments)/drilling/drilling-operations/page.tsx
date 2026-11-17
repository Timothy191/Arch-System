import { CacheCategory } from '@repo/redis';
import { createReadReplicaClient } from '@repo/supabase/read-replica';
import { getUserSafely } from '@repo/supabase/server';
import { redirect } from 'next/navigation';
import { withCache } from '@/lib/cache-utils';
import { cacheLife, cacheTag, tagDepartment } from '@/lib/server-cache';
import { getDaysInMonthCount } from '~/app/(departments)/[department]/reports/machine-activity-helpers';
import { getDepartmentContext } from '~/lib/dept-context';
import { DrillingOperationsTable, type DrillOpRow } from './DrillingOperationsTable';

const MONTH_PREFIX_LENGTH = 7;
const DAY_PAD_LENGTH = 2;
const DAY_PAD_CHAR = '0';
const MINUTES_PER_HOUR = 60;
const MONTH_FORMAT_REGEX = /^\d{4}-\d{2}$/;
const DRILL_RIG_MACHINE_TYPE = 'Drill Rig';
const DRILL_OPERATOR_CODE_PATTERN = 'OP-DR-%';
const AUTO_SYNCED_COMMENT = 'Auto-synced from Control Room';

interface DrillRigSummary {
  readonly id: string;
  readonly name: string;
}

interface DrillOperatorSummary {
  readonly id: string;
  readonly full_name: string;
}

interface CachedDrillingMonthlyOps {
  readonly drills: DrillRigSummary[];
  readonly ops: DrillOpRow[];
  readonly operators: DrillOperatorSummary[];
}

interface GetCachedDrillingMonthlyOpsOptions {
  readonly deptId: string;
  readonly resolvedMonth: string;
  readonly today: string;
}

interface ControlRoomDelayEntry {
  readonly duration_hours?: number | null;
  readonly deleted_at?: string | null;
  readonly delay_category?: { readonly name?: string | null } | null;
}

interface ControlRoomOpRow {
  readonly id: string;
  readonly machine_id: string;
  readonly shift_type?: string | null;
  readonly shift_date?: string | null;
  readonly start_smu?: number | null;
  readonly end_smu?: number | null;
  readonly hours_worked?: number | null;
  readonly block_drilled?: string | null;
  readonly meters_drilled?: number | null;
  readonly holes_drilled?: number | null;
  readonly operator?: { readonly full_name?: string | null } | null;
  readonly site?: { readonly name?: string | null } | null;
  readonly delay_entries?: readonly ControlRoomDelayEntry[] | null;
}

interface RawDrillOperationRow {
  readonly id: string;
  readonly machine_id: string;
  readonly shift_type: string | null;
  readonly operation_date: string | null;
  readonly open_hours: number | null;
  readonly close_hours: number | null;
  readonly total_hours: number | null;
  readonly holes: number | null;
  readonly meters_drilled: number | null;
  readonly operator_name: string | null;
  readonly block_drilled: string | null;
  readonly site: string | null;
  readonly external_delays_minutes: number | null;
  readonly standard_delays_hours: number | null;
  readonly production_delays_minutes: number | null;
  readonly engineering_delays_minutes: number | null;
  readonly non_productional_delays: number | null;
  readonly production_delays: number | null;
  readonly engineering_delays: number | null;
  readonly comments: string | null;
  readonly notes: string | null;
  readonly status: string | null;
}

interface MergeDrillOperationsOptions {
  readonly drillOps: readonly RawDrillOperationRow[];
  readonly controlRoomOps: readonly ControlRoomOpRow[];
  readonly today: string;
}

function sumCategoryDelayMinutes(
  delays: readonly ControlRoomDelayEntry[],
  categoryName: string
): number {
  return delays
    .filter((entry) => entry.delay_category?.name === categoryName)
    .reduce((sum: number, entry) => sum + Number(entry.duration_hours || 0) * MINUTES_PER_HOUR, 0);
}

function mergeDrillOperations({
  drillOps,
  controlRoomOps,
  today,
}: MergeDrillOperationsOptions): DrillOpRow[] {
  // Merge Control Room operations + synced drill_operations keyed by `${machine_id}:${opDate}:${shift}`
  const mergedMap = new Map<string, DrillOpRow>();

  for (const op of drillOps) {
    const shift = (op.shift_type === 'night' ? 'night' : 'day') as 'day' | 'night';
    const opDate = op.operation_date ?? today;
    const opKey = `${op.machine_id}:${opDate}:${shift}`;
    mergedMap.set(opKey, {
      id: op.id,
      machine_id: op.machine_id,
      shift_type: shift,
      operation_date: opDate,
      open_hours: op.open_hours != null ? Number(op.open_hours) : null,
      close_hours: op.close_hours != null ? Number(op.close_hours) : null,
      total_hours: op.total_hours != null ? Number(op.total_hours) : null,
      holes: op.holes != null ? Number(op.holes) : null,
      meters_drilled: op.meters_drilled != null ? Number(op.meters_drilled) : null,
      operator_name: op.operator_name ?? null,
      block_drilled: op.block_drilled ?? null,
      site: op.site ?? null,
      external_delays_minutes:
        Number(op.external_delays_minutes || op.non_productional_delays || 0) || null,
      standard_delays_hours:
        op.standard_delays_hours != null ? Number(op.standard_delays_hours) : null,
      production_delays_minutes:
        Number(op.production_delays_minutes || op.production_delays || 0) || null,
      engineering_delays_minutes:
        Number(op.engineering_delays_minutes || op.engineering_delays || 0) || null,
      comments: op.comments ?? op.notes ?? null,
      status: op.status ?? 'active',
    });
  }

  for (const crOp of controlRoomOps) {
    const shift = (crOp.shift_type === 'night' ? 'night' : 'day') as 'day' | 'night';
    const opDate = crOp.shift_date ?? today;
    const opKey = `${crOp.machine_id}:${opDate}:${shift}`;
    const existing = mergedMap.get(opKey);

    const activeDelays = Array.isArray(crOp.delay_entries)
      ? crOp.delay_entries.filter((entry) => !entry.deleted_at)
      : [];
    const extMin = sumCategoryDelayMinutes(activeDelays, 'External');
    const prodMin = sumCategoryDelayMinutes(activeDelays, 'Production');
    const engMin = sumCategoryDelayMinutes(activeDelays, 'Engineering');
    const startSmu =
      crOp.start_smu != null ? Number(crOp.start_smu) : (existing?.open_hours ?? null);
    const endSmu = crOp.end_smu != null ? Number(crOp.end_smu) : (existing?.close_hours ?? null);
    const totalHours =
      crOp.hours_worked != null
        ? Number(crOp.hours_worked)
        : startSmu != null && endSmu != null && endSmu >= startSmu
          ? endSmu - startSmu
          : (existing?.total_hours ?? null);

    mergedMap.set(opKey, {
      id: existing?.id ?? crOp.id,
      machine_id: crOp.machine_id,
      shift_type: shift,
      operation_date: opDate,
      open_hours: startSmu,
      close_hours: endSmu,
      total_hours: totalHours,
      holes: crOp.holes_drilled != null ? Number(crOp.holes_drilled) : (existing?.holes ?? 0),
      meters_drilled:
        crOp.meters_drilled != null ? Number(crOp.meters_drilled) : (existing?.meters_drilled ?? 0),
      operator_name: crOp.operator?.full_name ?? existing?.operator_name ?? null,
      block_drilled: crOp.block_drilled ?? existing?.block_drilled ?? null,
      site: crOp.site?.name ?? existing?.site ?? null,
      external_delays_minutes: extMin || existing?.external_delays_minutes || null,
      standard_delays_hours: existing?.standard_delays_hours ?? null,
      production_delays_minutes: prodMin || existing?.production_delays_minutes || null,
      engineering_delays_minutes: engMin || existing?.engineering_delays_minutes || null,
      comments: existing?.comments ?? AUTO_SYNCED_COMMENT,
      status: endSmu != null ? 'completed' : 'active',
    });
  }

  return Array.from(mergedMap.values());
}

async function loadDrillingMonthlyOps({
  deptId,
  resolvedMonth,
  today,
}: GetCachedDrillingMonthlyOpsOptions): Promise<CachedDrillingMonthlyOps> {
  const db = await createReadReplicaClient([]);
  const daysCount = getDaysInMonthCount(resolvedMonth);
  const monthStart = `${resolvedMonth}-01`;
  const monthEnd = `${resolvedMonth}-${String(daysCount).padStart(DAY_PAD_LENGTH, DAY_PAD_CHAR)}`;

  const [{ data: drills }, { data: drillOps }, { data: employees }, { data: fleetOperators }] =
    await Promise.all([
      db
        .from('machines')
        .select('id, name')
        .eq('machine_type', DRILL_RIG_MACHINE_TYPE)
        .eq('active', true)
        .order('name'),
      db
        .from('drill_operations')
        .select(
          'id, machine_id, shift_type, operation_date, open_hours, close_hours, total_hours, holes, meters_drilled, operator_name, block_drilled, site, external_delays_minutes, standard_delays_hours, production_delays_minutes, engineering_delays_minutes, non_productional_delays, production_delays, engineering_delays, comments, notes, status'
        )
        .eq('department_id', deptId)
        .gte('operation_date', monthStart)
        .lte('operation_date', monthEnd),
      db.from('employees').select('id, full_name').eq('department_id', deptId).order('full_name'),
      db
        .from('operators')
        .select('id, full_name, employee_code')
        .eq('active', true)
        .ilike('employee_code', DRILL_OPERATOR_CODE_PATTERN)
        .order('full_name'),
    ]);

  const operatorMap = new Map<string, DrillOperatorSummary>();
  for (const fleetOperator of fleetOperators ?? []) {
    operatorMap.set(fleetOperator.full_name, {
      id: String(fleetOperator.id),
      full_name: String(fleetOperator.full_name),
    });
  }
  for (const employee of employees ?? []) {
    if (!operatorMap.has(employee.full_name)) {
      operatorMap.set(employee.full_name, {
        id: String(employee.id),
        full_name: String(employee.full_name),
      });
    }
  }

  const drillList: DrillRigSummary[] = (drills ?? []).map((drill) => ({
    id: String(drill.id),
    name: String(drill.name),
  }));
  const drillIds = drillList.map((drill) => drill.id);

  // Fetch Control Room machine_operations for Drill Rigs across the selected month as primary SSoT
  const { data: controlRoomOps } =
    drillIds.length > 0
      ? await db
          .from('machine_operations')
          .select(
            'id, machine_id, shift_type, shift_date, start_smu, end_smu, hours_worked, block_drilled, meters_drilled, holes_drilled, operator:operators(full_name), site:sites(name), delay_entries:delay_entries(duration_hours, deleted_at, delay_category:delay_categories(name))'
          )
          .in('machine_id', drillIds)
          .gte('shift_date', monthStart)
          .lte('shift_date', monthEnd)
          .order('created_at', { ascending: false })
      : { data: [] as ControlRoomOpRow[] };

  return {
    drills: drillList,
    ops: mergeDrillOperations({
      drillOps: (drillOps ?? []) as unknown as RawDrillOperationRow[],
      controlRoomOps: (controlRoomOps ?? []) as unknown as ControlRoomOpRow[],
      today,
    }),
    operators: Array.from(operatorMap.values()),
  };
}

/**
 * Dual-tier cached monthly Drilling Shift Operations loader.
 * Auth and searchParams resolution remain outside the `'use cache'` boundary.
 */
async function getCachedDrillingMonthlyOps({
  deptId,
  resolvedMonth,
  today,
}: GetCachedDrillingMonthlyOpsOptions): Promise<CachedDrillingMonthlyOps> {
  'use cache';

  const opsTag = tagDepartment('drilling', `ops:${resolvedMonth}`);

  cacheLife('telemetry');

  cacheTag(opsTag);
  cacheTag('table:machines');
  cacheTag('table:drill_operations');
  cacheTag('table:machine_operations');

  return withCache(() => loadDrillingMonthlyOps({ deptId, resolvedMonth, today }), {
    category: CacheCategory.METRICS,
    keyParts: ['drilling', 'monthly-ops-v1', deptId, resolvedMonth],
    tags: [opsTag, 'table:machines', 'table:drill_operations', 'table:machine_operations'],
  });
}

interface DrillingOperationsPageProps {
  readonly searchParams?: Promise<{
    readonly month?: string;
    readonly machineId?: string;
  }>;
}

export default async function DrillingOperationsPage({
  searchParams,
}: DrillingOperationsPageProps = {}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const requestedMonth = resolvedSearchParams?.month;
  const machineId = resolvedSearchParams?.machineId;

  const { deptId, supabase, today } = await getDepartmentContext({
    department: 'drilling',
  });
  const user = await getUserSafely(supabase);
  if (!user) redirect('/login');

  const resolvedMonth =
    requestedMonth && MONTH_FORMAT_REGEX.test(requestedMonth)
      ? requestedMonth
      : today.slice(0, MONTH_PREFIX_LENGTH);

  const { drills, ops, operators } = await getCachedDrillingMonthlyOps({
    deptId,
    resolvedMonth,
    today,
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-2xl text-[var(--text-heading)]">
            Drilling Shift Operations Report
          </h2>
          <p className="mt-1 text-[var(--text-muted)] text-sm">
            Automatically compiled from Control Room machine operations (Meters, Site, Block, Holes
            &amp; SMR).
          </p>
        </div>
      </header>

      <DrillingOperationsTable
        departmentId={deptId}
        drills={drills}
        operators={operators}
        initialOps={ops}
        initialMonth={resolvedMonth}
        initialMachineId={machineId}
      />
    </div>
  );
}
