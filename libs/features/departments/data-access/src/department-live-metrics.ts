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

/**
 * Query and aggregate real-time shift telemetry across core operational tables.
 * AGENT-TRACE: Consolidates multi-table queries into parallel roundtrips with safe fallbacks.
 */
export async function fetchLiveDepartmentMetrics(
  db: GenericDbClient,
  today: string
): Promise<DepartmentLiveMetricsMap> {
  const result: DepartmentLiveMetricsMap = {};
  const queryTable = <T = Record<string, unknown>>(table: string): InternalQueryBuilder<T> =>
    (db.from as (tableName: string) => InternalQueryBuilder<T>)(table);

  try {
    const [hourlyLoadsRes, productionRes, breakdownsRes, machinesRes, badgesRes] =
      await Promise.all([
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
      ]);

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
      const total = row.total_loads ?? hours.reduce((a: number, b: number) => a + b, 0);

      result['control-room'] = {
        stats: {
          label: 'Loads',
          value: total > 0 ? `${total.toLocaleString()}` : 'Active',
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
        (sum: number, l: ProductionLogEntry) => sum + (Number(l.coal_tonnes) || 0),
        0
      );
      const totalWaste = prodLogs.reduce(
        (sum: number, l: ProductionLogEntry) => sum + (Number(l.waste_tonnes) || 0),
        0
      );
      const totalMined = totalCoal + totalWaste;
      const yieldPct = totalMined > 0 ? Math.round((totalCoal / totalMined) * 100) : 0;
      const coalSeries = prodLogs.map((l: ProductionLogEntry) => Number(l.coal_tonnes) || 0);

      result.production = {
        stats: {
          label: 'Yield',
          value:
            totalCoal > 0
              ? `${totalCoal.toLocaleString(undefined, { maximumFractionDigits: 0 })}t`
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
              : `${totalCoal.toLocaleString(undefined, { maximumFractionDigits: 0 })}t`,
        },
        trend: coalSeries.length > 0 ? coalSeries : [totalCoal, totalMined],
        status: 'active',
      };

      result['plant-inventory'] = {
        stats: {
          label: 'Stockpile',
          value: `${Math.round(totalCoal).toLocaleString(undefined, { maximumFractionDigits: 0 })}t`,
        },
        trend: coalSeries.length > 0 ? coalSeries : [Math.round(totalCoal)],
        status: 'active',
      };
    }

    // --- Engineering Overlay ---

    const activeBreakdowns = breakdownsRes?.count ?? 0;
    const machinesList = machinesRes?.data ?? [];
    const totalMachines = machinesList.length;
    const activeMachines = machinesList.filter((m: MachineActiveRow) => m.active !== false).length;
    const availabilityRate =
      totalMachines > 0 ? Math.round((activeMachines / totalMachines) * 100) : 0;

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
  } catch (err) {
    console.warn('fetchLiveDepartmentMetrics warning (using default overlays):', err);
  }

  return result;
}
