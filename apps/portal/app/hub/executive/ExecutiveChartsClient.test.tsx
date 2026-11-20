import '@testing-library/jest-dom';
import { render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { GaugeSpec } from './executive-gauges';
import type {
  BreakdownStats,
  DailyProductionPoint,
  FleetSnapshot,
  PeriodSummary,
} from './executive-metrics';

jest.mock('@repo/ui/GlassCard', () => ({
  GlassCard: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div data-testid="glass-card" className={className}>
      {children}
    </div>
  ),
}));

jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  LineChart: ({ children }: { children: ReactNode }) => (
    <div data-testid="line-chart">{children}</div>
  ),
  BarChart: ({ children }: { children: ReactNode }) => (
    <div data-testid="bar-chart">{children}</div>
  ),
  PieChart: ({ children }: { children: ReactNode }) => (
    <div data-testid="pie-chart">{children}</div>
  ),
  Line: ({ name }: { name?: string }) => <div data-testid="chart-line" data-name={name} />,
  Bar: ({ name }: { name?: string }) => <div data-testid="chart-bar" data-name={name} />,
  Pie: ({ children }: { children: ReactNode }) => <div data-testid="chart-pie">{children}</div>,
  Cell: ({ fill }: { fill?: string }) => <div data-testid="chart-cell" data-fill={fill} />,
  ReferenceLine: ({ y }: { y?: number }) => <div data-testid="reference-line" data-y={y} />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  XAxis: ({ tickFormatter }: { tickFormatter?: (val: string) => string }) => (
    <div data-testid="x-axis">{tickFormatter ? tickFormatter('2026-11-20') : null}</div>
  ),
  YAxis: ({ tickFormatter }: { tickFormatter?: (val: number) => string }) => (
    <div data-testid="y-axis">{tickFormatter ? tickFormatter(1500) : null}</div>
  ),
  Tooltip: ({ labelFormatter }: { labelFormatter?: (label?: unknown) => string }) => (
    <div data-testid="chart-tooltip">
      {labelFormatter ? `${labelFormatter('2026-11-20')}|${labelFormatter(undefined)}` : null}
    </div>
  ),
}));

import { ExecutiveChartsClient } from './ExecutiveChartsClient';
import { ExecutiveGaugePanel } from './ExecutiveGauge';

const SAMPLE_DAILY: DailyProductionPoint[] = [
  {
    date: '2026-11-19',
    coal: 400,
    waste: 800,
    total: 1200,
    fuelLitres: 600,
    hours: 20,
    drift: 1.5,
    absDrift: 1.5,
    fuelPerTonne: 0.5,
  },
  {
    date: '2026-11-20',
    coal: 600,
    waste: 1200,
    total: 1800,
    fuelLitres: 900,
    hours: 30,
    drift: -2.0,
    absDrift: 2.0,
    fuelPerTonne: 0.5,
  },
];

const SAMPLE_MTD: PeriodSummary = {
  days: 2,
  coal: 1000,
  waste: 2000,
  total: 3000,
  fuelLitres: 1500,
  hours: 50,
  avgAbsDriftPct: 1.75,
  fuelPerTonne: 0.5,
  stripRatio: 2.0,
  tonnesPerHour: 60,
};

const EMPTY_MTD: PeriodSummary = {
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
};

const SAMPLE_FLEET: FleetSnapshot = {
  active: 8,
  total: 10,
  availabilityPct: 80,
  mix: [
    { label: 'Excavator', active: 5, inactive: 1 },
    { label: 'Haul Truck', active: 3, inactive: 1 },
  ],
  status: [
    { label: 'Active', count: 8 },
    { label: 'Inactive / standby', count: 2 },
  ],
};

const EMPTY_FLEET: FleetSnapshot = {
  active: 0,
  total: 0,
  availabilityPct: null,
  mix: [],
  status: [],
};

const SAMPLE_BREAKDOWNS: BreakdownStats = {
  total: 4,
  open: 2,
  downtimeHours: 12.5,
  byStatus: [
    { label: 'Open', count: 2 },
    { label: 'Completed', count: 1 },
    { label: 'Pending', count: 1 },
  ],
  byMachineType: [
    { label: 'Excavator', count: 3 },
    { label: 'Haul Truck', count: 1 },
  ],
};

const EMPTY_BREAKDOWNS: BreakdownStats = {
  total: 0,
  open: 0,
  downtimeHours: 0,
  byStatus: [],
  byMachineType: [],
};

describe('ExecutiveChartsClient', () => {
  it('renders all 8 production and operations charts with legends and donut center figures', () => {
    render(
      <ExecutiveChartsClient
        summaryAvailable
        daily={SAMPLE_DAILY}
        mtd={SAMPLE_MTD}
        avgDailyTonnes={1500}
        fleet={SAMPLE_FLEET}
        breakdowns={SAMPLE_BREAKDOWNS}
        personnelByDepartment={[
          { label: 'Mining', count: 18 },
          { label: 'Plant', count: 12 },
        ]}
      />
    );

    expect(screen.getByText('30-Day Tonnage Trend')).toBeInTheDocument();
    expect(screen.getByText('Coal vs Waste (MTD)')).toBeInTheDocument();
    expect(screen.getByText('Daily Diesel & Machine Hours')).toBeInTheDocument();
    expect(screen.getByText('Reconciliation Drift & Fuel Efficiency')).toBeInTheDocument();
    expect(screen.getByText('Fleet Mix by Machine Type')).toBeInTheDocument();
    expect(screen.getByText('Fleet Status')).toBeInTheDocument();
    expect(screen.getByText('Breakdowns by Machine Type (MTD)')).toBeInTheDocument();
    expect(screen.getByText('Personnel by Department')).toBeInTheDocument();

    expect(screen.getByText('2.00 : 1')).toBeInTheDocument();
    expect(screen.getByText('Strip ratio')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('Machines')).toBeInTheDocument();
    expect(screen.getByText('80%')).toBeInTheDocument();
    expect(screen.getByText('Available')).toBeInTheDocument();

    expect(screen.getAllByTestId('line-chart')).toHaveLength(2);
    expect(screen.getAllByTestId('bar-chart')).toHaveLength(3);
    expect(screen.getAllByTestId('pie-chart')).toHaveLength(3);
    expect(screen.getAllByTestId('reference-line')).toHaveLength(3);
  });

  it('renders unavailable state for production charts and empty states for operations charts', () => {
    render(
      <ExecutiveChartsClient
        summaryAvailable={false}
        daily={[]}
        mtd={EMPTY_MTD}
        avgDailyTonnes={null}
        fleet={EMPTY_FLEET}
        breakdowns={EMPTY_BREAKDOWNS}
        personnelByDepartment={[]}
      />
    );

    expect(
      screen.getAllByText(
        'Unavailable while the production summary query is failing — figures are hidden, not zeroed.'
      )
    ).toHaveLength(4);
    expect(screen.getAllByText('No machines registered.')).toHaveLength(2);
    expect(screen.getByText('No breakdowns logged this month.')).toBeInTheDocument();
    expect(screen.getByText('No employee records found.')).toBeInTheDocument();

    expect(screen.queryByTestId('line-chart')).not.toBeInTheDocument();
    expect(screen.queryByTestId('bar-chart')).not.toBeInTheDocument();
    expect(screen.queryByTestId('pie-chart')).not.toBeInTheDocument();
  });

  it('renders empty state for production charts when summaryAvailable=true but daily is empty', () => {
    render(
      <ExecutiveChartsClient
        summaryAvailable
        daily={[]}
        mtd={EMPTY_MTD}
        avgDailyTonnes={null}
        fleet={EMPTY_FLEET}
        breakdowns={EMPTY_BREAKDOWNS}
        personnelByDepartment={[]}
      />
    );

    expect(screen.getAllByText('No records for this period yet.')).toHaveLength(4);
  });
});

describe('ExecutiveGaugePanel', () => {
  it('renders active meter gauges (role="meter") and null gauges (role="img")', () => {
    const specs: GaugeSpec[] = [
      {
        id: 'fleet-availability',
        label: 'Availability',
        value: 85,
        min: 0,
        max: 100,
        unit: '%',
        decimals: 0,
        tone: 'good',
        caption: '17 of 20 machines active',
      },
      {
        id: 'coal-target-pace',
        label: 'Coal Target Pace',
        value: null,
        min: 0,
        max: 150,
        unit: '%',
        decimals: 0,
        tone: 'neutral',
        caption: 'No monthly coal target set',
      },
      {
        id: 'reconciliation-drift',
        label: 'Drift Control',
        value: 25,
        min: 0,
        max: 20,
        unit: '%',
        decimals: 1,
        tone: 'bad',
        caption: 'Critical Variance',
      },
      {
        id: 'zero-span-gauge',
        label: 'Zero Span',
        value: 5,
        min: 5,
        max: 5,
        unit: ' L/t',
        decimals: 2,
        tone: 'warn',
        caption: 'Collapsed span',
      },
    ];

    render(<ExecutiveGaugePanel specs={specs} />);

    expect(screen.getByText('Operational Health Gauges')).toBeInTheDocument();

    const meters = screen.getAllByRole('meter');
    expect(meters).toHaveLength(3);

    const availabilityMeter = screen.getByRole('meter', {
      name: 'Availability: 85%. 17 of 20 machines active',
    });
    expect(availabilityMeter).toHaveAttribute('aria-valuenow', '85');
    expect(availabilityMeter).toHaveAttribute('aria-valuemin', '0');
    expect(availabilityMeter).toHaveAttribute('aria-valuemax', '100');
    expect(availabilityMeter).toHaveAttribute('aria-valuetext', '85%');
    expect(availabilityMeter).toHaveAttribute('data-tone', 'good');
    expect(within(availabilityMeter).getByText('85%')).toBeInTheDocument();

    const nullGauge = screen.getByRole('img', {
      name: 'Coal Target Pace: —. No monthly coal target set',
    });
    expect(nullGauge).toHaveAttribute('data-tone', 'neutral');
    expect(nullGauge).not.toHaveAttribute('aria-valuenow');
    expect(within(nullGauge).getByText('—')).toBeInTheDocument();
  });
});
