import '@testing-library/jest-dom';
import { render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';

jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  ComposedChart: ({ children, data }: { children: ReactNode; data?: unknown[] }) => (
    <div data-testid="composed-chart" data-points={data?.length ?? 0}>
      {children}
    </div>
  ),
  Bar: ({ name }: { name?: string }) => <div data-testid="chart-bar" data-name={name} />,
  Line: ({ name }: { name?: string }) => <div data-testid="chart-line" data-name={name} />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  Tooltip: () => <div data-testid="chart-tooltip" />,
}));

const mockRedirect = jest.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});

jest.mock('next/navigation', () => ({
  redirect: (url: string) => mockRedirect(url),
}));

jest.mock('next/server', () => ({
  connection: jest.fn(async () => undefined),
}));

jest.mock('@/lib/cache-utils', () => ({
  withCache: jest.fn((fn: () => Promise<unknown>) => fn()),
}));

jest.mock(
  '~/features/departments/components/plant-inventory/PlantInventoryWorkspaceClient',
  () => ({
    PlantInventoryWorkspaceClient: ({ mode, today }: { mode: string; today: string }) => (
      <div data-testid="plant-inventory-workspace" data-mode={mode} data-today={today} />
    ),
  })
);

jest.mock('~/lib/dept-context', () => ({
  getDepartmentContext: jest.fn(async () => ({
    deptId: 'dept-engineering-001',
    today: '2026-11-20',
  })),
}));

const mockFrom = jest.fn();

jest.mock('@repo/supabase/read-replica', () => ({
  createReadReplicaClient: jest.fn(async () => ({
    from: (...args: unknown[]) => mockFrom(...args),
  })),
}));

import {
  buildMachineTelemetryMap,
  groupMachinesBySite,
  shiftIsoDay,
} from './machine-telemetry-helpers';
import MachinesPage from './page';

describe('/[department]/machines Page & Telemetry Panels', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('redirects plant-processing to delays and delegates plant-inventory to PlantInventoryWorkspaceClient', async () => {
    await expect(
      MachinesPage({ params: Promise.resolve({ department: 'plant-processing' }) })
    ).rejects.toThrow('NEXT_REDIRECT:/plant-processing/delays');

    const inventoryJsx = await MachinesPage({
      params: Promise.resolve({ department: 'plant-inventory' }),
    });
    render(inventoryJsx);
    expect(screen.getByTestId('plant-inventory-workspace')).toHaveAttribute(
      'data-mode',
      'item-list'
    );
  });

  it('renders empty state cleanly when no machines are registered', async () => {
    mockFrom.mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn(async () => ({ data: [], error: null })),
    }));

    const jsx = await MachinesPage({
      params: Promise.resolve({ department: 'drilling' }),
    });
    render(jsx);

    expect(screen.getByText('Machine Database')).toBeInTheDocument();
    expect(screen.getByText('No machines registered for this department.')).toBeInTheDocument();
  });

  it('renders machine panels with Tyre & Breakdown activity graphs, hours worked totals, and up/down % trends', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'machines') {
        return {
          select: jest.fn().mockReturnThis(),
          order: jest.fn(async () => ({
            data: [
              {
                id: 'm-bd43',
                name: 'BD-43',
                machine_type: 'Dozer',
                serial_number: 'Caterpillar D9R',
                bin_factor: null,
                active: true,
                created_at: '2026-01-01T00:00:00Z',
                site: { name: 'Main Pit', site_code: 'PIT-1' },
              },
              {
                id: 'm-ht12',
                name: 'HT-12',
                machine_type: 'Haul Truck',
                serial_number: 'CAT 777G',
                bin_factor: 45,
                active: false,
                created_at: '2026-01-02T00:00:00Z',
                site: null,
              },
            ],
            error: null,
          })),
        };
      }
      if (table === 'breakdowns') {
        return {
          select: jest.fn().mockReturnThis(),
          is: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn(async () => ({
            data: [
              {
                id: 'bd-1',
                machine_id: 'm-bd43',
                fleet_id: 'BD-43',
                machine_name: 'BD-43',
                status: 'active',
                date_in: '2026-11-20',
                created_at: '2026-11-20T06:00:00Z',
              },
              {
                id: 'bd-2',
                machine_id: null,
                fleet_id: 'HT-12',
                machine_name: 'HT-12',
                status: 'completed',
                date_in: '2026-11-18',
                created_at: '2026-11-18T09:00:00Z',
              },
            ],
            error: null,
          })),
        };
      }
      if (table === 'tires') {
        return {
          select: jest.fn().mockReturnThis(),
          limit: jest.fn(async () => ({
            data: [
              {
                id: 'tire-1',
                machine_id: 'm-ht12',
                status: 'installed',
                installed_at: '2026-11-19',
                removed_at: null,
                created_at: '2026-11-19T08:00:00Z',
              },
            ],
            error: null,
          })),
        };
      }
      if (table === 'tire_inspections') {
        return {
          select: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          limit: jest.fn(async () => ({
            data: [
              {
                id: 'insp-1',
                tire_id: 'tire-1',
                inspection_date: '2026-11-20',
                created_at: '2026-11-20T07:00:00Z',
              },
            ],
            error: null,
          })),
        };
      }
      if (table === 'machine_hours') {
        return {
          select: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          limit: jest.fn(async () => ({
            data: [
              // BD-43: 30h current 7d vs 20h prior 7d -> +50.0%
              {
                machine_id: 'm-bd43',
                daily_log_date: '2026-11-20',
                hours_worked: 30,
                created_at: '2026-11-20T18:00:00Z',
              },
              {
                machine_id: 'm-bd43',
                daily_log_date: '2026-11-10',
                hours_worked: 20,
                created_at: '2026-11-10T18:00:00Z',
              },
              // HT-12: 10h current 7d vs 20h prior 7d -> -50.0%
              {
                machine_id: 'm-ht12',
                daily_log_date: '2026-11-19',
                hours_worked: 10,
                created_at: '2026-11-19T18:00:00Z',
              },
              {
                machine_id: 'm-ht12',
                daily_log_date: '2026-11-11',
                hours_worked: 20,
                created_at: '2026-11-11T18:00:00Z',
              },
            ],
            error: null,
          })),
        };
      }
      if (table === 'machine_operations') {
        return {
          select: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          limit: jest.fn(async () => ({
            data: [
              {
                machine_id: 'm-bd43',
                shift_date: '2026-11-20',
                daily_log_date: '2026-11-20',
                hours_worked: null,
                start_smu: 100,
                end_smu: 110,
                created_at: '2026-11-20T18:00:00Z',
              },
            ],
            error: null,
          })),
        };
      }
      return {
        select: jest.fn().mockReturnThis(),
        limit: jest.fn(async () => ({ data: [], error: null })),
      };
    });

    const jsx = await MachinesPage({
      params: Promise.resolve({ department: 'engineering' }),
    });
    render(jsx);

    expect(screen.getByText('BD-43')).toBeInTheDocument();
    expect(screen.getByText('Caterpillar D9R')).toBeInTheDocument();
    expect(screen.getByText('HT-12')).toBeInTheDocument();
    expect(screen.getByText('Bin: 45 BCM')).toBeInTheDocument();

    // Upward & downward % indicators and totals
    expect(screen.getByText('50 h')).toBeInTheDocument();
    expect(screen.getByText('+50.0%')).toBeInTheDocument();
    expect(screen.getByText('30 h')).toBeInTheDocument();
    expect(screen.getByText('-50.0%')).toBeInTheDocument();

    expect(screen.getByLabelText('Hours worked change +50.0% vs prior 7 days')).toBeInTheDocument();
    expect(screen.getByLabelText('Hours worked change -50.0% vs prior 7 days')).toBeInTheDocument();

    // Every machine panel has a 7-day Tyre & Breakdown activity chart
    const charts = screen.getAllByTestId('composed-chart');
    expect(charts).toHaveLength(2);
    for (const chart of charts) {
      expect(chart).toHaveAttribute('data-points', '7');
      expect(within(chart).getAllByTestId('chart-bar')).toHaveLength(2);
      expect(within(chart).getByTestId('chart-line')).toBeInTheDocument();
    }
    expect(screen.getAllByText('Tyre & Breakdown Activity (7d)')).toHaveLength(2);
  });

  it('computes telemetry helpers cleanly for empty inputs, removals, and site grouping', () => {
    expect(shiftIsoDay('2026-11-20', -6)).toBe('2026-11-14');

    const machines = [
      {
        id: 'm-unassigned',
        name: 'GR-01',
        machine_type: 'Grader',
        serial_number: null,
        bin_factor: null,
        active: true,
        created_at: '2026-01-01',
        site: null,
      },
      {
        id: 'm-site',
        name: 'DZ-01',
        machine_type: 'Dozer',
        serial_number: 'D10',
        bin_factor: 0,
        active: true,
        created_at: '2026-01-01',
        site: [{ name: 'Alpha Site', site_code: 'ALP' }],
      },
    ];

    const telemetry = buildMachineTelemetryMap({
      machines,
      breakdowns: [],
      tires: [
        {
          id: 't-rem',
          machine_id: 'm-site',
          status: 'removed',
          installed_at: '2026-11-15',
          removed_at: '2026-11-19',
          created_at: '2026-11-15T00:00:00Z',
        },
      ],
      tireInspections: [],
      machineHours: [],
      machineOperations: [
        {
          machine_id: 'm-site',
          shift_date: '2026-11-20',
          daily_log_date: null,
          hours_worked: 8,
          start_smu: null,
          end_smu: null,
          created_at: '2026-11-20T00:00:00Z',
        },
      ],
      today: '2026-11-20',
    });

    expect(telemetry['m-unassigned']?.hoursDeltaPct).toBe(0);
    expect(telemetry['m-site']?.hoursDeltaPct).toBe(100);
    expect(telemetry['m-site']?.tireEventsCount).toBe(2);

    const groups = groupMachinesBySite({
      machines,
      telemetryByMachineId: telemetry,
      today: '2026-11-20',
    });
    expect(groups[0]?.siteCode).toBe('ALP');
    expect(groups[1]?.siteName).toBe('Unassigned');
  });
});
