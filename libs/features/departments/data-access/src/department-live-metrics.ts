// ============================================================================
// AGENT-TRACE: Real-Time Department Operational Metrics & Shift Telemetry
// ============================================================================

export interface DepartmentMetricOverlay {
  stats: {
    label: string;
    value: string;
  };
  trend?: number[];
  status?: 'active' | 'maintenance' | 'alert';
}

export type DepartmentLiveMetricsMap = Record<string, DepartmentMetricOverlay>;

/**
 * Minimal database client interface to decouple from concrete Supabase/ReadReplica client types.
 */
export interface GenericDbClient {
  from: (...args: never[]) => unknown;
}

interface InternalQueryResult<T> {
  data?: T | null;
  count?: number | null;
}

interface InternalQueryBuilder<T = Record<string, unknown>>
  extends PromiseLike<InternalQueryResult<T[]>> {
  select: (
    columns: string,
    options?: { count?: 'exact' | 'planned' | 'estimated'; head?: boolean }
  ) => InternalQueryBuilder<T>;
  eq: (column: string, value: unknown) => InternalQueryBuilder<T>;
  is: (column: string, value: unknown) => InternalQueryBuilder<T>;
  order: (column: string, options?: { ascending?: boolean }) => InternalQueryBuilder<T>;
  limit: (count: number) => InternalQueryBuilder<T>;
  maybeSingle: () => Promise<InternalQueryResult<T>>;
}

interface HourlyLoadsRow {
  hour_01?: number | null;
  hour_02?: number | null;
  hour_03?: number | null;
  hour_04?: number | null;
  hour_05?: number | null;
  hour_06?: number | null;
  hour_07?: number | null;
  hour_08?: number | null;
  hour_09?: number | null;
  hour_10?: number | null;
  hour_11?: number | null;
  hour_12?: number | null;
  total_loads?: number | null;
}

interface ProductionLogEntry {
  coal_tonnes?: number | string | null;
  waste_tonnes?: number | string | null;
}

interface DailyLogWithProductionRow {
  id?: string;
  shift?: string;
  production_logs?: ProductionLogEntry | ProductionLogEntry[] | null;
}

interface MachineActiveRow {
  active?: boolean | null;
}

const PERCENT_SCALE = 100;

function unwrapSettled<T>(settled: PromiseSettledResult<T>): T | undefined {
  return settled.status === 'fulfilled' ? settled.value : undefined;
}

/**
 * Query and aggregate real-time shift telemetry across core operational tables.
 * AGENT-TRACE: Consolidates multi-table queries into parallel settled roundtrips with safe fallbacks.
 */
export async function fetchLiveDepartmentMetrics(
  db: GenericDbClient,
  today: string
): Promise<DepartmentLiveMetricsMap> {
  const result: DepartmentLiveMetricsMap = {};
  const queryTable = <T = Record<string, unknown>>(table: string): InternalQueryBuilder<T> =>
    (db.from as (tableName: string) => InternalQueryBuilder<T>)(table);

  try {
    const [
      hourlyLoadsSettled,
      productionSettled,
      breakdownsSettled,
      machinesSettled,
      badgesSettled,
      employeesSettled,
      unresolvedLogsSettled,
      departmentsSettled,
    ] = await Promise.allSettled([
      // 1. Control Room Hourly Loads for today
      queryTable<HourlyLoadsRow>('hourly_loads')
        .select(
          'hour_01, hour_02, hour_03, hour_04, hour_05, hour_06, hour_07, hour_08, hour_09, hour_10, hour_11, hour_12, total_loads'
        )
        .eq('load_date', today)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),

      // 2. Production & Processing Extraction Tonnage
      queryTable<DailyLogWithProductionRow>('daily_logs')
        .select('id, shift, production_logs(coal_tonnes, waste_tonnes)')
        .eq('log_date', today)
        .limit(1)
        .maybeSingle(),

      // 3. Equipment breakdowns (active)
      queryTable('breakdowns')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active')
        .is('deleted_at', null),

      // 4. Engineering Machines
      queryTable<MachineActiveRow>('machines').select('active').is('deleted_at', null),

      // 5. Access Control active badges on-site
      queryTable('badges').select('id', { count: 'exact', head: true }).eq('is_active', true),

      // 6. Administration active employees
      queryTable('employees').select('id', { count: 'exact', head: true }).is('deleted_at', null),

      // 7. Administration unresolved system logs
      queryTable('system_logs').select('id', { count: 'exact', head: true }).eq('resolved', false),

      // 8. Administration active departments
      queryTable('departments').select('id', { count: 'exact', head: true }).is('deleted_at', null),
    ]);

    const hourlyLoadsRes = unwrapSettled(hourlyLoadsSettled);
    const productionRes = unwrapSettled(productionSettled);
    const breakdownsRes = unwrapSettled(breakdownsSettled);
    const machinesRes = unwrapSettled(machinesSettled);
    const badgesRes = unwrapSettled(badgesSettled);
    const employeesRes = unwrapSettled(employeesSettled);
    const unresolvedLogsRes = unwrapSettled(unresolvedLogsSettled);
    const departmentsRes = unwrapSettled(departmentsSettled);

    // --- Control Room Overlay ---
    if (hourlyLoadsRes?.data) {
      const row = hourlyLoadsRes.data;
      const hours = [
        row.hour_01 ?? 0,
        row.hour_02 ?? 0,
        row.hour_03 ?? 0,
        row.hour_04 ?? 0,
        row.hour_05 ?? 0,
        row.hour_06 ?? 0,
        row.hour_07 ?? 0,
        row.hour_08 ?? 0,
        row.hour_09 ?? 0,
        row.hour_10 ?? 0,
        row.hour_11 ?? 0,
        row.hour_12 ?? 0,
      ];
      const total = row.total_loads ?? hours.reduce((acc: number, count: number) => acc + count, 0);

      result['control-room'] = {
        stats: {
          label: 'Loads',
          value: total > 0 ? `${total.toLocaleString('en-US')}` : 'Active',
        },
        trend: hours,
        status: 'active',
      };
    }

    // --- Production & Processing Overlay ---
    if (productionRes?.data) {
      const prodLogs = Array.isArray(productionRes.data.production_logs)
        ? productionRes.data.production_logs
        : productionRes.data.production_logs
          ? [productionRes.data.production_logs]
          : [];

      const totalCoal = prodLogs.reduce(
        (sum: number, entry: ProductionLogEntry) => sum + (Number(entry.coal_tonnes) || 0),
        0
      );
      const totalWaste = prodLogs.reduce(
        (sum: number, entry: ProductionLogEntry) => sum + (Number(entry.waste_tonnes) || 0),
        0
      );
      const totalMined = totalCoal + totalWaste;
      const yieldPct = totalMined > 0 ? Math.round((totalCoal / totalMined) * PERCENT_SCALE) : 0;
      const coalSeries = prodLogs.map(
        (entry: ProductionLogEntry) => Number(entry.coal_tonnes) || 0
      );

      result.production = {
        stats: {
          label: 'Yield',
          value:
            totalCoal > 0
              ? `${totalCoal.toLocaleString('en-US', { maximumFractionDigits: 0 })}t`
              : `${yieldPct}%`,
        },
        trend: coalSeries.length > 0 ? coalSeries : [totalCoal, totalWaste, totalMined],
        status: 'active',
      };

      result['plant-processing'] = {
        stats: {
          label: 'Plant Yield',
          value:
            totalMined > 0
              ? `${yieldPct}%`
              : `${totalCoal.toLocaleString('en-US', { maximumFractionDigits: 0 })}t`,
        },
        trend: coalSeries.length > 0 ? coalSeries : [totalCoal, totalMined],
        status: 'active',
      };

      result['plant-inventory'] = {
        stats: {
          label: 'Stockpile',
          value: `${Math.round(totalCoal).toLocaleString('en-US', { maximumFractionDigits: 0 })}t`,
        },
        trend: coalSeries.length > 0 ? coalSeries : [Math.round(totalCoal)],
        status: 'active',
      };
    }

    // --- Engineering Overlay ---
    const activeBreakdowns = breakdownsRes?.count ?? 0;
    const machinesList = machinesRes?.data ?? [];
    const totalMachines = machinesList.length;
    const activeMachines = machinesList.filter(
      (machine: MachineActiveRow) => machine.active !== false
    ).length;
    const availabilityRate =
      totalMachines > 0 ? Math.round((activeMachines / totalMachines) * PERCENT_SCALE) : 0;

    result.engineering = {
      stats: {
        label: 'Availability',
        value: `${availabilityRate}%`,
      },
      status: activeBreakdowns > 0 ? 'maintenance' : 'active',
      trend: [activeMachines, totalMachines, availabilityRate],
    };

    // --- Access Control Overlay ---
    if (badgesRes?.count !== undefined && badgesRes?.count !== null) {
      result['access-control'] = {
        stats: {
          label: 'On-site',
          value: `${badgesRes.count}`,
        },
        status: 'active',
      };
    }

    // --- Administration Overlay ---
    const hasAdminTelemetry =
      typeof employeesRes?.count === 'number' ||
      typeof unresolvedLogsRes?.count === 'number' ||
      typeof departmentsRes?.count === 'number';

    if (hasAdminTelemetry) {
      const activeEmployees = employeesRes?.count ?? 0;
      const unresolvedLogs = unresolvedLogsRes?.count ?? 0;
      const activeDepartments = departmentsRes?.count ?? 0;

      result.admin = {
        stats: {
          label: unresolvedLogs > 0 ? 'Staff · Open Logs' : 'Active Users',
          value:
            unresolvedLogs > 0
              ? `${activeEmployees.toLocaleString('en-US')} · ${unresolvedLogs} open`
              : `${activeEmployees.toLocaleString('en-US')} (${activeDepartments} depts)`,
        },
        trend: [activeEmployees, activeDepartments, activeMachines, unresolvedLogs],
        status: unresolvedLogs > 0 ? 'alert' : 'active',
      };
    }

    // --- Database Overlay ---
    result.database = {
      stats: {
        label: 'Schema',
        value: '52 Tables',
      },
      trend: [activeMachines, totalMachines, badgesRes?.count ?? 0, activeBreakdowns],
      status: 'active',
    };
  } catch (err) {
    console.warn('fetchLiveDepartmentMetrics warning (using default overlays):', err);
  }

  return result;
}
