import { buildExportRows, buildPdfReport } from './executive-export';
import {
  EM_DASH,
  formatCompact,
  formatDelta,
  formatLongDate,
  formatNumber,
  formatPercent,
  formatRatio,
  formatShortDate,
  formatTonnes,
} from './executive-format';
import { buildGaugeSpecs, toneHigherIsBetter, toneLowerIsBetter } from './executive-gauges';
import type {
  BreakdownRow,
  EmployeeDepartmentRow,
  ExecutiveData,
  MachineRow,
  MonthlyTargetRow,
  ProductionSummaryRow,
} from './executive-metrics';
import {
  aggregateDailyProduction,
  buildBreakdownStats,
  buildFleetMix,
  buildFleetStatus,
  buildPersonnelByDepartment,
  computeAvailabilityPct,
  computeTargetAttainment,
  computeTrendStats,
  percentChange,
  pointsSince,
  safeRatio,
  shiftIsoDate,
  summarizePeriod,
  toNumber,
} from './executive-metrics';

jest.mock('@repo/supabase/read-replica', () => ({
  createReadReplicaClient: jest.fn(),
}));

jest.mock('@/lib/server-cache', () => ({
  cacheLife: jest.fn(),
  cacheTag: jest.fn(),
}));

jest.mock('@/lib/cache-utils', () => ({
  withCache: jest.fn((fn: () => Promise<unknown>) => fn()),
}));

jest.mock('@repo/redis', () => ({
  CacheCategory: {
    METRICS: 'metrics',
  },
}));

jest.mock('@/lib/errors/error-logger', () => ({
  logError: jest.fn(async () => {}),
}));

import { getExecutiveData } from './executive-data';

function makeExecutiveFixture(overrides: Partial<ExecutiveData> = {}): ExecutiveData {
  return {
    today: '2026-11-20',
    monthStart: '2026-11-01',
    summaryAvailable: true,
    daily: [
      {
        date: '2026-11-19',
        coal: 400,
        waste: 800,
        total: 1200,
        fuelLitres: 600,
        hours: 20,
        drift: 2.0,
        absDrift: 2.0,
        fuelPerTonne: 0.5,
      },
      {
        date: '2026-11-20',
        coal: 600,
        waste: 1200,
        total: 1800,
        fuelLitres: 900,
        hours: 30,
        drift: -3.0,
        absDrift: 3.0,
        fuelPerTonne: 0.5,
      },
    ],
    mtd: {
      days: 2,
      coal: 1000,
      waste: 2000,
      total: 3000,
      fuelLitres: 1500,
      hours: 50,
      avgAbsDriftPct: 2.5,
      fuelPerTonne: 0.5,
      stripRatio: 2.0,
      tonnesPerHour: 60,
    },
    window: {
      days: 2,
      coal: 1000,
      waste: 2000,
      total: 3000,
      fuelLitres: 1500,
      hours: 50,
      avgAbsDriftPct: 2.5,
      fuelPerTonne: 0.5,
      stripRatio: 2.0,
      tonnesPerHour: 60,
    },
    trend: {
      avgDailyTonnes: 1500,
      bestDay: { date: '2026-11-20', total: 1800 },
      latestDay: { date: '2026-11-20', total: 1800 },
      latestVsAvgPct: 20,
      weekTonnes: 3000,
      priorWeekTonnes: 2500,
      weekOverWeekPct: 20,
    },
    fleet: {
      active: 8,
      total: 10,
      availabilityPct: 80,
      mix: [{ label: 'Excavator', active: 8, inactive: 2 }],
      status: [
        { label: 'Active', count: 8 },
        { label: 'Inactive / standby', count: 2 },
      ],
    },
    breakdowns: {
      total: 2,
      open: 1,
      downtimeHours: 6.5,
      byStatus: [
        { label: 'Open', count: 1 },
        { label: 'Completed', count: 1 },
      ],
      byMachineType: [{ label: 'Excavator', count: 2 }],
    },
    personnel: {
      total: 25,
      byDepartment: [{ label: 'Mining', count: 25 }],
    },
    target: {
      coalTargetTonnes: 1500,
      wasteTargetTonnes: 3000,
      coalAttainmentPct: 66.6667,
      coalPacePct: 100,
      plannedStripRatio: 2.0,
    },
    ...overrides,
  };
}

describe('executive-format', () => {
  it('formats numbers, tonnes, percents, and ratios in en-US', () => {
    expect(formatNumber(12345)).toBe('12,345');
    expect(formatNumber(12.345, 2)).toBe('12.35');
    expect(formatTonnes(2500)).toBe('2,500 t');
    expect(formatPercent(null)).toBe(EM_DASH);
    expect(formatPercent(87.26)).toBe('87.3%');
    expect(formatPercent(80, 0)).toBe('80%');
    expect(formatRatio(null)).toBe(EM_DASH);
    expect(formatRatio(2.5)).toBe('2.50 : 1');
  });

  it('formats deltas, compact numbers, and UTC dates', () => {
    expect(formatDelta(null, 'prior 7d')).toBe('No prior 7d baseline');
    expect(formatDelta(12.34, 'prior 7d')).toBe('▲ 12.3% vs prior 7d');
    expect(formatDelta(0, 'avg')).toBe('▲ 0.0% vs avg');
    expect(formatDelta(-4.56, 'prior 7d')).toBe('▼ 4.6% vs prior 7d');

    expect(formatCompact(999)).toBe('999');
    expect(formatCompact(-500)).toBe('-500');
    expect(formatCompact(1500)).toBe('1.5K');
    expect(formatCompact(2_500_000)).toBe('2.5M');

    expect(formatShortDate('2026-11-20')).toBe('Nov 20');
    expect(formatLongDate('2026-11-20')).toBe('Fri, November 20, 2026');
  });
});

describe('executive-metrics', () => {
  it('handles primitive helpers: toNumber, shiftIsoDate, safeRatio, percentChange', () => {
    expect(toNumber(42)).toBe(42);
    expect(toNumber('18.5')).toBe(18.5);
    expect(toNumber(null)).toBe(0);
    expect(toNumber(undefined)).toBe(0);
    expect(toNumber('not-a-number')).toBe(0);
    expect(toNumber(Number.POSITIVE_INFINITY)).toBe(0);

    expect(shiftIsoDate('2026-11-20', -7)).toBe('2026-11-13');
    expect(shiftIsoDate('2026-03-01', -1)).toBe('2026-02-28');

    expect(safeRatio(10, 4)).toBe(2.5);
    expect(safeRatio(10, 0)).toBeNull();
    expect(safeRatio(10, -2)).toBeNull();

    expect(percentChange(120, 100)).toBeCloseTo(20);
    expect(percentChange(80, 100)).toBeCloseTo(-20);
    expect(percentChange(50, 0)).toBeNull();
  });

  it('aggregates daily production rows chronologically and handles missing drift or zero totals', () => {
    const rows: ProductionSummaryRow[] = [
      {
        log_date: null,
        actual_coal_tonnes: 999,
        actual_waste_tonnes: 999,
        total_fuel_litres: 100,
        total_hours_worked: 5,
        reconciliation_drift_pct: 1,
      },
      {
        log_date: '2026-11-20T08:00:00Z',
        actual_coal_tonnes: '100',
        actual_waste_tonnes: 200,
        total_fuel_litres: 150,
        total_hours_worked: 10,
        reconciliation_drift_pct: -4,
      },
      {
        log_date: '2026-11-20T20:00:00Z',
        actual_coal_tonnes: 50,
        actual_waste_tonnes: 150,
        total_fuel_litres: 100,
        total_hours_worked: 5,
        reconciliation_drift_pct: 2,
      },
      {
        log_date: '2026-11-18',
        actual_coal_tonnes: 0,
        actual_waste_tonnes: 0,
        total_fuel_litres: 0,
        total_hours_worked: 0,
        reconciliation_drift_pct: '',
      },
      {
        log_date: '2026-11-19',
        actual_coal_tonnes: 10,
        actual_waste_tonnes: 10,
        total_fuel_litres: 10,
        total_hours_worked: 2,
        reconciliation_drift_pct: null,
      },
    ];

    const points = aggregateDailyProduction(rows);
    expect(points.map((point) => point.date)).toEqual(['2026-11-18', '2026-11-19', '2026-11-20']);

    expect(points[0]).toEqual({
      date: '2026-11-18',
      coal: 0,
      waste: 0,
      total: 0,
      fuelLitres: 0,
      hours: 0,
      drift: 0,
      absDrift: 0,
      fuelPerTonne: null,
    });

    expect(points[1]?.drift).toBe(0);
    expect(points[1]?.fuelPerTonne).toBeCloseTo(0.5);

    expect(points[2]).toEqual({
      date: '2026-11-20',
      coal: 150,
      waste: 350,
      total: 500,
      fuelLitres: 250,
      hours: 15,
      drift: -1,
      absDrift: 3,
      fuelPerTonne: 0.5,
    });
  });

  it('filters pointsSince, summarizes periods, and computes trend stats', () => {
    const emptySummary = summarizePeriod([]);
    expect(emptySummary).toEqual({
      days: 0,
      coal: 0,
      waste: 0,
      total: 0,
      fuelLitres: 0,
      hours: 0,
      avgAbsDriftPct: 0,
      fuelPerTonne: null,
      stripRatio: null,
      tonnesPerHour: null,
    });

    expect(computeTrendStats([], '2026-11-20')).toEqual({
      avgDailyTonnes: null,
      bestDay: null,
      latestDay: null,
      latestVsAvgPct: null,
      weekTonnes: 0,
      priorWeekTonnes: 0,
      weekOverWeekPct: null,
    });

    const points = aggregateDailyProduction([
      {
        log_date: '2026-11-08',
        actual_coal_tonnes: 200,
        actual_waste_tonnes: 200,
        total_fuel_litres: 100,
        total_hours_worked: 10,
        reconciliation_drift_pct: 2,
      },
      {
        log_date: '2026-11-15',
        actual_coal_tonnes: 500,
        actual_waste_tonnes: 500,
        total_fuel_litres: 250,
        total_hours_worked: 20,
        reconciliation_drift_pct: -4,
      },
      {
        log_date: '2026-11-20',
        actual_coal_tonnes: 100,
        actual_waste_tonnes: 100,
        total_fuel_litres: 50,
        total_hours_worked: 5,
        reconciliation_drift_pct: 0,
      },
    ]);

    const mtdPoints = pointsSince(points, '2026-11-15');
    expect(mtdPoints).toHaveLength(2);

    const summary = summarizePeriod(mtdPoints);
    expect(summary.days).toBe(2);
    expect(summary.total).toBe(1200);
    expect(summary.stripRatio).toBeCloseTo(1);
    expect(summary.fuelPerTonne).toBeCloseTo(300 / 1200);
    expect(summary.tonnesPerHour).toBeCloseTo(1200 / 25);
    expect(summary.avgAbsDriftPct).toBeCloseTo(2);

    const trend = computeTrendStats(points, '2026-11-20');
    expect(trend.weekTonnes).toBe(1200);
    expect(trend.priorWeekTonnes).toBe(400);
    expect(trend.weekOverWeekPct).toBeCloseTo(200);
    expect(trend.bestDay).toEqual({ date: '2026-11-15', total: 1000 });
    expect(trend.latestDay).toEqual({ date: '2026-11-20', total: 200 });
    expect(trend.avgDailyTonnes).toBeCloseTo(1600 / 3);
    expect(trend.latestVsAvgPct).toBeCloseTo(((200 - 1600 / 3) / (1600 / 3)) * 100);
  });

  it('builds fleet mix, fleet status, and availability with tail collapse', () => {
    const machineRows: MachineRow[] = [
      { machine_type: 'Excavator', active: true },
      { machine_type: 'Excavator', active: false },
      { machine_type: 'Haul Truck', active: true },
      { machine_type: 'Haul Truck', active: true },
      { machine_type: 'Dozer', active: true },
      { machine_type: 'Grader', active: true },
      { machine_type: 'Drill', active: true },
      { machine_type: 'Loader', active: true },
      { machine_type: '  ', active: false },
      { machine_type: null, active: true },
    ];

    const mix = buildFleetMix(machineRows);
    expect(mix).toHaveLength(6);
    expect(mix[5]?.label).toBe('Other');
    expect(mix[5]?.active).toBe(2);
    expect(mix[5]?.inactive).toBe(0);
    expect(mix.some((entry) => entry.label === 'Unspecified')).toBe(true);

    expect(buildFleetStatus(7, 10)).toEqual([
      { label: 'Active', count: 7 },
      { label: 'Inactive / standby', count: 3 },
    ]);
    expect(buildFleetStatus(12, 10)).toEqual([
      { label: 'Active', count: 12 },
      { label: 'Inactive / standby', count: 0 },
    ]);

    expect(computeAvailabilityPct(0, 0)).toBeNull();
    expect(computeAvailabilityPct(7, 9)).toBe(78);
  });

  it('builds breakdown stats and personnel department groups with tail collapse', () => {
    const breakdownRows: BreakdownRow[] = [
      { status: 'active', machine_type: 'Excavator', duration_hours: 4.5 },
      { status: 'completed', machine_type: 'Excavator', duration_hours: '2.5' },
      { status: 'pending', machine_type: 'Dozer', duration_hours: null },
      { status: null, machine_type: null, duration_hours: 1 },
      { status: 'active', machine_type: 'Loader', duration_hours: 1 },
      { status: 'completed', machine_type: 'Drill', duration_hours: 1 },
      { status: 'completed', machine_type: 'Grader', duration_hours: 1 },
      { status: 'completed', machine_type: 'Truck', duration_hours: 1 },
      { status: 'completed', machine_type: 'Pump', duration_hours: 1 },
    ];

    const stats = buildBreakdownStats(breakdownRows);
    expect(stats.total).toBe(9);
    expect(stats.open).toBe(2);
    expect(stats.downtimeHours).toBe(13);
    expect(stats.byStatus).toEqual([
      { label: 'Completed', count: 5 },
      { label: 'Open', count: 2 },
      { label: 'pending', count: 1 },
      { label: 'Unspecified', count: 1 },
    ]);
    expect(stats.byMachineType).toHaveLength(6);
    expect(stats.byMachineType[5]?.label).toBe('Other');

    const staffRows: EmployeeDepartmentRow[] = [
      { departments: { display_name: 'Mining' } },
      { departments: [{ display_name: 'Plant' }] },
      { departments: [] },
      { departments: null },
      { departments: { display_name: '  ' } },
      { departments: { display_name: 'Engineering' } },
      { departments: { display_name: 'Safety' } },
      { departments: { display_name: 'Logistics' } },
      { departments: { display_name: 'Finance' } },
      { departments: { display_name: 'Security' } },
      { departments: { display_name: 'Maintenance' } },
    ];

    const byDept = buildPersonnelByDepartment(staffRows);
    expect(byDept).toHaveLength(8);
    expect(byDept[0]).toEqual({ label: 'Unassigned', count: 3 });
    expect(byDept[7]?.label).toBe('Other');
    expect(byDept[7]?.count).toBe(2);
  });

  it('computes monthly target attainment and pro-rata pace', () => {
    expect(
      computeTargetAttainment({ target: null, coalMtd: 500, todayIso: '2026-11-15' })
    ).toBeNull();

    const zeroTarget: MonthlyTargetRow = { coal_target_tonnes: 0, waste_target_tonnes: 100 };
    expect(
      computeTargetAttainment({ target: zeroTarget, coalMtd: 500, todayIso: '2026-11-15' })
    ).toBeNull();

    const validTarget: MonthlyTargetRow = { coal_target_tonnes: 3000, waste_target_tonnes: 6000 };
    const result = computeTargetAttainment({
      target: validTarget,
      coalMtd: 1500,
      todayIso: '2026-11-15',
    });
    expect(result).toEqual({
      coalTargetTonnes: 3000,
      wasteTargetTonnes: 6000,
      coalAttainmentPct: 50,
      coalPacePct: 100,
      plannedStripRatio: 2,
    });
  });
});

describe('executive-gauges', () => {
  it('computes higher-is-better and lower-is-better tones across all boundaries', () => {
    expect(toneHigherIsBetter(null, { good: 80, warn: 60 })).toBe('neutral');
    expect(toneHigherIsBetter(80, { good: 80, warn: 60 })).toBe('good');
    expect(toneHigherIsBetter(65, { good: 80, warn: 60 })).toBe('warn');
    expect(toneHigherIsBetter(59, { good: 80, warn: 60 })).toBe('bad');

    expect(toneLowerIsBetter(null, { good: 5, warn: 10 })).toBe('neutral');
    expect(toneLowerIsBetter(5, { good: 5, warn: 10 })).toBe('good');
    expect(toneLowerIsBetter(8, { good: 5, warn: 10 })).toBe('warn');
    expect(toneLowerIsBetter(11, { good: 5, warn: 10 })).toBe('bad');
  });

  it('builds 5 gauge specs for nominal data', () => {
    const specs = buildGaugeSpecs(makeExecutiveFixture());
    expect(specs.map((spec) => spec.id)).toEqual([
      'fleet-availability',
      'coal-target-pace',
      'reconciliation-drift',
      'fuel-efficiency',
      'strip-ratio',
    ]);
    expect(specs[0]).toMatchObject({ value: 80, tone: 'good', caption: '8 of 10 machines active' });
    expect(specs[1]).toMatchObject({
      value: 100,
      tone: 'good',
      caption: '66.7% of 1,500 t monthly target',
    });
    expect(specs[2]).toMatchObject({ value: 2.5, tone: 'good', caption: 'Optimal' });
    expect(specs[3]).toMatchObject({ value: 0.5, tone: 'good', caption: '30-day avg 0.50 L/t' });
    expect(specs[4]).toMatchObject({ value: 2.0, tone: 'good', caption: 'Plan 2.00 : 1' });
  });

  it('handles unavailable summary, missing targets/baselines, and critical drift', () => {
    const unavailable = makeExecutiveFixture({
      summaryAvailable: false,
      fleet: { active: 0, total: 0, availabilityPct: null, mix: [], status: [] },
      target: null,
      window: {
        days: 0,
        coal: 0,
        waste: 0,
        total: 0,
        fuelLitres: 0,
        hours: 0,
        avgAbsDriftPct: 0,
        fuelPerTonne: null,
        stripRatio: null,
        tonnesPerHour: null,
      },
    });
    const unavailableSpecs = buildGaugeSpecs(unavailable);
    for (const spec of unavailableSpecs) {
      expect(spec.value).toBeNull();
      expect(spec.tone).toBe('neutral');
    }
    expect(unavailableSpecs[1]?.caption).toBe('Production summary unavailable');
    expect(unavailableSpecs[2]?.caption).toBe('Production summary unavailable');
    expect(unavailableSpecs[3]?.caption).toBe('Production summary unavailable');
    expect(unavailableSpecs[4]?.caption).toBe('Production summary unavailable');

    const noTargetNoBaseline = makeExecutiveFixture({
      target: null,
      mtd: {
        days: 1,
        coal: 100,
        waste: 200,
        total: 300,
        fuelLitres: 150,
        hours: 10,
        avgAbsDriftPct: 16,
        fuelPerTonne: 0.5,
        stripRatio: 2,
        tonnesPerHour: 30,
      },
      window: {
        days: 0,
        coal: 0,
        waste: 0,
        total: 0,
        fuelLitres: 0,
        hours: 0,
        avgAbsDriftPct: 0,
        fuelPerTonne: null,
        stripRatio: null,
        tonnesPerHour: null,
      },
    });
    const noTargetSpecs = buildGaugeSpecs(noTargetNoBaseline);
    expect(noTargetSpecs[1]).toMatchObject({
      value: null,
      tone: 'neutral',
      caption: 'No monthly coal target set',
    });
    expect(noTargetSpecs[2]).toMatchObject({
      value: 16,
      tone: 'bad',
      caption: 'Critical Variance',
    });
    expect(noTargetSpecs[3]).toMatchObject({
      value: 0.5,
      tone: 'neutral',
      caption: 'No 30-day baseline',
      max: 1,
    });
    expect(noTargetSpecs[4]).toMatchObject({
      value: 2,
      tone: 'neutral',
      caption: 'No planned strip ratio',
      max: 4,
    });
  });
});

describe('executive-export', () => {
  it('builds CSV export rows including empty fuel efficiency when null', () => {
    const fixture = makeExecutiveFixture({
      daily: [
        {
          date: '2026-11-19',
          coal: 0,
          waste: 0,
          total: 0,
          fuelLitres: 0,
          hours: 0,
          drift: 0,
          absDrift: 0,
          fuelPerTonne: null,
        },
        {
          date: '2026-11-20',
          coal: 100.125,
          waste: 200.5,
          total: 300.625,
          fuelLitres: 150,
          hours: 12.25,
          drift: 1.45,
          absDrift: 1.45,
          fuelPerTonne: 0.499,
        },
      ],
    });

    const rows = buildExportRows(fixture);
    expect(rows).toEqual([
      {
        Date: '2026-11-19',
        'Coal (t)': '0.00',
        'Waste (t)': '0.00',
        'Total (t)': '0.00',
        'Fuel (L)': '0.00',
        'Machine Hours (h)': '0.00',
        'Fuel Efficiency (L/t)': '',
        'Reconciliation Drift (%)': '0.0',
      },
      {
        Date: '2026-11-20',
        'Coal (t)': '100.13',
        'Waste (t)': '200.50',
        'Total (t)': '300.63',
        'Fuel (L)': '150.00',
        'Machine Hours (h)': '12.25',
        'Fuel Efficiency (L/t)': '0.50',
        'Reconciliation Drift (%)': '1.4',
      },
    ]);
  });

  it('builds PDF report data with KPIs and handles null fuelPerTonne / null target', () => {
    const withTarget = buildPdfReport(makeExecutiveFixture());
    expect(withTarget.title).toBe('Executive Production & Fleet Report');
    expect(withTarget.subtitle).toBe('Generated on 2026-11-20 — Month-to-date analysis');
    expect(withTarget.tableHeaders).toEqual([
      'Date',
      'Coal (t)',
      'Waste (t)',
      'Total Tonnage (t)',
      'Fuel (L)',
      'Hours',
      'Drift %',
    ]);
    expect(withTarget.kpis).toContainEqual({ label: 'Fuel Efficiency', value: '0.50 L/t' });
    expect(withTarget.kpis).toContainEqual({ label: 'Coal Target Attainment', value: '66.7%' });
    expect(withTarget.tableRows[0]).toEqual([
      '2026-11-19',
      '400.00',
      '800.00',
      '1200.00',
      '600',
      '20.0',
      '2.0%',
    ]);

    const withoutFuelOrTarget = buildPdfReport(
      makeExecutiveFixture({
        target: null,
        mtd: {
          days: 0,
          coal: 0,
          waste: 0,
          total: 0,
          fuelLitres: 0,
          hours: 0,
          avgAbsDriftPct: 0,
          fuelPerTonne: null,
          stripRatio: null,
          tonnesPerHour: null,
        },
      })
    );
    expect(withoutFuelOrTarget.kpis).toContainEqual({
      label: 'Fuel Efficiency',
      value: `${EM_DASH} L/t`,
    });
    expect(withoutFuelOrTarget.kpis).toContainEqual({
      label: 'Coal Target Attainment',
      value: EM_DASH,
    });
  });
});

describe('executive-data (getExecutiveData)', () => {
  interface ReadReplicaOptions {
    rpcResponse: { data: unknown; error: unknown };
    targetRow: MonthlyTargetRow | null;
    activeCount?: number | null;
    totalCount?: number | null;
    employeeCount?: number | null;
  }

  function createReadReplicaStub({
    rpcResponse,
    targetRow,
    activeCount = 4,
    totalCount = 5,
    employeeCount = 10,
  }: ReadReplicaOptions) {
    return {
      rpc: jest.fn(async () => rpcResponse),
      from: jest.fn((table: string) => {
        let isEqCalled = false;
        const builder: Record<string, jest.Mock> = {};
        builder.select = jest.fn(() => builder);
        builder.eq = jest.fn(() => {
          isEqCalled = true;
          return builder;
        });
        builder.gte = jest.fn(() => builder);
        builder.is = jest.fn(async () => {
          if (table === 'machines') {
            return {
              data: [
                { machine_type: 'Excavator', active: true },
                { machine_type: 'Dozer', active: false },
              ],
              count: isEqCalled ? activeCount : totalCount,
              error: null,
            };
          }
          if (table === 'employees') {
            return {
              data: [{ departments: { display_name: 'Mining' } }],
              count: employeeCount,
              error: null,
            };
          }
          if (table === 'breakdowns') {
            return {
              data: [{ id: 'b-1', status: 'active', machine_type: 'Excavator', duration_hours: 3 }],
              count: null,
              error: null,
            };
          }
          return { data: [], count: null, error: null };
        });
        builder.maybeSingle = jest.fn(async () => ({
          data: targetRow,
          error: null,
        }));
        return builder;
      }),
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads and aggregates all executive sources on RPC success with monthly target', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const { createReadReplicaClient } = await import('@repo/supabase/read-replica');
    const { cacheLife, cacheTag } = await import('@/lib/server-cache');
    const { withCache } = await import('@/lib/cache-utils');
    const { logError } = await import('@/lib/errors/error-logger');

    (createReadReplicaClient as jest.Mock).mockResolvedValue(
      createReadReplicaStub({
        rpcResponse: {
          data: [
            {
              log_date: today,
              actual_coal_tonnes: 200,
              actual_waste_tonnes: 400,
              total_fuel_litres: 300,
              total_hours_worked: 10,
              reconciliation_drift_pct: 2,
            },
          ],
          error: null,
        },
        targetRow: { coal_target_tonnes: 1000, waste_target_tonnes: 2000 },
      })
    );

    const data = await getExecutiveData();

    expect(createReadReplicaClient).toHaveBeenCalledWith([]);
    expect(cacheLife).toHaveBeenCalledWith({ stale: 300, revalidate: 300, expire: 300 });
    expect(cacheTag).toHaveBeenCalledTimes(4);
    expect(withCache).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        category: 'metrics',
        keyParts: ['hub', 'executive-v3'],
      })
    );
    expect(logError).not.toHaveBeenCalled();

    expect(data.summaryAvailable).toBe(true);
    expect(data.today).toBe(today);
    expect(data.mtd.total).toBe(600);
    expect(data.fleet.availabilityPct).toBe(80);
    expect(data.breakdowns.open).toBe(1);
    expect(data.personnel.total).toBe(10);
    expect(data.target).not.toBeNull();
    expect(data.target?.coalAttainmentPct).toBe(20);
    expect(data.target?.plannedStripRatio).toBe(2);
  });

  it('logs RPC failure, sets summaryAvailable=false, and handles null targets and null counts', async () => {
    const { createReadReplicaClient } = await import('@repo/supabase/read-replica');
    const { logError } = await import('@/lib/errors/error-logger');
    const rpcError = { message: 'RPC timeout', code: '57014' };

    (createReadReplicaClient as jest.Mock).mockResolvedValue(
      createReadReplicaStub({
        rpcResponse: { data: null, error: rpcError },
        targetRow: null,
        activeCount: null,
        totalCount: null,
        employeeCount: null,
      })
    );

    const data = await getExecutiveData();

    expect(logError).toHaveBeenCalledWith(rpcError, {
      context: 'hub.executive.get_production_summary',
    });
    expect(data.summaryAvailable).toBe(false);
    expect(data.daily).toEqual([]);
    expect(data.mtd.total).toBe(0);
    expect(data.fleet.active).toBe(0);
    expect(data.fleet.total).toBe(0);
    expect(data.fleet.availabilityPct).toBeNull();
    expect(data.personnel.total).toBe(0);
    expect(data.target).toBeNull();
  });
});
