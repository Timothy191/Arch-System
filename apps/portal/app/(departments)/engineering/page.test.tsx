import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  ComposedChart: ({ children }: { children: ReactNode }) => (
    <div data-testid="composed-chart">{children}</div>
  ),
  BarChart: ({ children }: { children: ReactNode }) => (
    <div data-testid="bar-chart">{children}</div>
  ),
  PieChart: ({ children }: { children: ReactNode }) => (
    <div data-testid="pie-chart">{children}</div>
  ),
  Bar: ({ name }: { name?: string }) => <div data-testid="chart-bar" data-name={name} />,
  Line: ({ name }: { name?: string }) => <div data-testid="chart-line" data-name={name} />,
  Pie: ({ children }: { children: ReactNode }) => <div data-testid="chart-pie">{children}</div>,
  Cell: ({ fill }: { fill?: string }) => <div data-testid="chart-cell" data-fill={fill} />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  Tooltip: () => <div data-testid="chart-tooltip" />,
}));

import { EngineeringHubDashboardClient } from './EngineeringHubDashboardClient';
import { buildEngineeringHubMetrics, escapeEngineeringCsvCell } from './engineering-hub-metrics';
import EngineeringError from './error';
import EngineeringLayout from './layout';
import EngineeringLoading from './loading';
import EngineeringDashboardPage from './page';

const mockFrom = jest.fn();

jest.mock('@repo/supabase/read-replica', () => ({
  createReadReplicaClient: jest.fn(async () => ({
    from: (...args: unknown[]) => mockFrom(...args),
  })),
}));

jest.mock('~/lib/dept-context', () => ({
  getDepartmentContext: jest.fn(async () => ({
    deptId: 'dept-engineering-001',
    department: 'engineering',
  })),
}));

jest.mock('next/navigation', () => ({
  notFound: jest.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
  usePathname: jest.fn(() => '/engineering'),
}));

jest.mock('@/components/nav/ActiveDepartmentSetter', () => ({
  ActiveDepartmentSetter: ({ department }: { department: string | null }) => (
    <div data-testid="active-dept-setter" data-dept={department ?? ''} />
  ),
}));

jest.mock('@/lib/errors/error-logger', () => ({
  logError: jest.fn(),
}));

jest.mock('@/lib/cache-utils', () => ({
  withCache: jest.fn((fn: () => Promise<unknown>) => fn()),
}));

function buildEmptyQueryMock() {
  const chain: Record<string, jest.Mock> = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    is: jest.fn(() => chain),
    gte: jest.fn(() => chain),
    order: jest.fn(() => chain),
    limit: jest.fn(async () => ({ data: [], count: 0, error: null })),
    then: jest.fn((resolve: (v: unknown) => unknown) =>
      Promise.resolve({ data: [], count: 0, error: null }).then(resolve)
    ),
  };
  return chain;
}

describe('Engineering Department Route Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('EngineeringDashboardPage (page.tsx)', () => {
    it('renders active and resolved breakdown counts along with recent breakdowns list', async () => {
      let callIndex = 0;
      mockFrom.mockImplementation(() => {
        callIndex += 1;
        if (callIndex === 1) {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            is: jest.fn(async () => ({ count: 4, error: null })),
          };
        }
        if (callIndex === 2) {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            gte: jest.fn(async () => ({ count: 7, error: null })),
          };
        }
        if (callIndex === 3) {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            is: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            limit: jest.fn(async () => ({
              data: [
                {
                  id: 'bd-1',
                  machine_name: 'CAT 797F #12',
                  reason: 'Hydraulic pump pressure fault',
                  priority: 'critical',
                  created_at: '2026-10-22T04:00:00Z',
                },
                {
                  id: 'bd-2',
                  machine_name: 'Komatsu PC8000 #03',
                  reason: 'Track tension sensor warning',
                  priority: 'high',
                  created_at: '2026-10-22T03:00:00Z',
                },
                {
                  id: 'bd-3',
                  machine_name: '',
                  reason: 'Scheduled inspection',
                  priority: '',
                  created_at: '2026-10-22T02:00:00Z',
                },
              ],
              error: null,
            })),
          };
        }
        return buildEmptyQueryMock();
      });

      const jsx = await EngineeringDashboardPage();
      render(jsx);

      expect(screen.getByText('Engineering Hub')).toBeInTheDocument();
      expect(screen.getByText('FLEET HEALTH & TELEMETRY')).toBeInTheDocument();
      expect(screen.getByText('4')).toBeInTheDocument();
      expect(screen.getByText('7')).toBeInTheDocument();
      expect(screen.getByText('CAT 797F #12')).toBeInTheDocument();
      expect(screen.getByText('Komatsu PC8000 #03')).toBeInTheDocument();
      expect(screen.getByText('Unknown Machine')).toBeInTheDocument();
      expect(screen.getByText('critical')).toBeInTheDocument();
      expect(screen.getByText('high')).toBeInTheDocument();
      expect(screen.getByText('normal')).toBeInTheDocument();
    });

    it('gracefully falls back to zero counts and hides recent active list when queries return null', async () => {
      let callIndex = 0;
      mockFrom.mockImplementation(() => {
        callIndex += 1;
        if (callIndex === 1) {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            is: jest.fn(async () => ({ count: null, error: null })),
          };
        }
        if (callIndex === 2) {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            gte: jest.fn(async () => ({ count: null, error: null })),
          };
        }
        if (callIndex === 3) {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            is: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            limit: jest.fn(async () => ({ data: null, error: null })),
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          is: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn(async () => ({ data: null, error: null })),
        };
      });

      const jsx = await EngineeringDashboardPage();
      render(jsx);

      expect(screen.getAllByText('0').length).toBeGreaterThanOrEqual(2);
      expect(screen.queryByText('Recent Active')).not.toBeInTheDocument();
    });

    it('renders full Recharts graphs and detailed reporting tables when full fleet telemetry is present', async () => {
      const todayIso = new Date().toISOString().slice(0, 10);
      let breakdownsCall = 0;
      mockFrom.mockImplementation((table: string) => {
        if (table === 'breakdowns') {
          breakdownsCall += 1;
          if (breakdownsCall === 1) {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              is: jest.fn(async () => ({ count: 2, error: null })),
            };
          }
          if (breakdownsCall === 2) {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              gte: jest.fn(async () => ({ count: 3, error: null })),
            };
          }
          if (breakdownsCall === 3) {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              is: jest.fn().mockReturnThis(),
              order: jest.fn().mockReturnThis(),
              limit: jest.fn(async () => ({
                data: [
                  {
                    id: 'rec-1',
                    machine_name: 'CAT 797F #12',
                    reason: 'Hydraulic line leak',
                    status: 'active',
                    created_at: `${todayIso}T06:00:00Z`,
                  },
                ],
                error: null,
              })),
            };
          }
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            is: jest.fn().mockReturnThis(),
            gte: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            limit: jest.fn(async () => ({
              data: [
                {
                  id: 'hist-1',
                  fleet_id: 'BD-43',
                  machine_id: 'm-1',
                  machine_name: 'BD-43',
                  machine_type: 'Dozer',
                  reason: 'Coolant radiator leak',
                  status: 'completed',
                  date_in: todayIso,
                  time_in: '07:00',
                  date_out: todayIso,
                  time_out: '10:30',
                  duration_hours: 3.5,
                  shift_type: 'day',
                  site_code: 'SITE-A',
                  created_at: `${todayIso}T07:00:00Z`,
                  updated_at: `${todayIso}T10:30:00Z`,
                },
                {
                  id: 'hist-2',
                  fleet_id: 'EX-08',
                  machine_id: 'm-2',
                  machine_name: 'EX-08',
                  machine_type: 'Excavator',
                  reason: 'Bucket cylinder seal failure',
                  status: 'active',
                  date_in: todayIso,
                  time_in: '19:15',
                  duration_minutes: 90,
                  shift_type: 'night',
                  site_code: 'SITE-B',
                  created_at: `${todayIso}T19:15:00Z`,
                },
              ],
              error: null,
            })),
          };
        }
        if (table === 'machines') {
          return {
            select: jest.fn().mockReturnThis(),
            is: jest.fn().mockReturnThis(),
            order: jest.fn(async () => ({
              data: [
                {
                  id: 'm-1',
                  name: 'BD-43',
                  machine_type: 'Dozer',
                  serial_number: 'CAT-D9R-43',
                  active: true,
                },
                {
                  id: 'm-2',
                  name: 'EX-08',
                  machine_type: 'Excavator',
                  serial_number: 'CAT-390F-08',
                  active: false,
                },
              ],
              error: null,
            })),
          };
        }
        if (table === 'tires') {
          return {
            select: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            limit: jest.fn(async () => ({
              data: [
                {
                  id: 't-1',
                  serial_number: 'TIRE-CRIT-01',
                  brand: 'Michelin',
                  size: '59/80R63',
                  position: 'Front Left',
                  status: 'installed',
                  installed_at: todayIso,
                  installed_hours: 1400,
                  removed_at: null,
                  machine_id: 'm-1',
                },
                {
                  id: 't-2',
                  serial_number: 'TIRE-SPARE-02',
                  brand: 'Bridgestone',
                  size: '59/80R63',
                  position: null,
                  status: 'inventory',
                  installed_at: null,
                  installed_hours: 0,
                  removed_at: null,
                  machine_id: null,
                },
              ],
              error: null,
            })),
          };
        }
        if (table === 'tire_inspections') {
          return {
            select: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            limit: jest.fn(async () => ({
              data: [
                {
                  id: 'ti-1',
                  tire_id: 't-1',
                  inspection_date: todayIso,
                  tread_depth_mm: 11,
                  pressure_psi: 102,
                  condition_status: 'critical',
                  notes: 'Below 15mm minimum tread',
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
                {
                  id: 'mh-1',
                  machine_id: 'm-1',
                  daily_log_date: todayIso,
                  hours_worked: 10.5,
                  created_at: `${todayIso}T18:00:00Z`,
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
                  id: 'mo-1',
                  machine_id: 'm-2',
                  shift_date: todayIso,
                  daily_log_date: todayIso,
                  hours_worked: null,
                  start_smu: 1000,
                  end_smu: 1008,
                  created_at: `${todayIso}T18:00:00Z`,
                },
              ],
              error: null,
            })),
          };
        }
        return buildEmptyQueryMock();
      });

      const jsx = await EngineeringDashboardPage();
      render(jsx);

      expect(screen.getByText('50%')).toBeInTheDocument();
      expect(screen.getByText('18.5 hrs')).toBeInTheDocument();
      expect(screen.getByText('3.5 hrs')).toBeInTheDocument();
      expect(screen.getByTestId('composed-chart')).toBeInTheDocument();
      expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
      expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
      expect(screen.getByText('TIRE-CRIT-01')).toBeInTheDocument();
      expect(screen.getByText('Coolant radiator leak')).toBeInTheDocument();
      expect(screen.getByText('Bucket cylinder seal failure')).toBeInTheDocument();
    });
  });

  describe('EngineeringHubDashboardClient interactions & CSV escaping', () => {
    it('filters breakdown ledger and tire alerts, and exports CSV safely', () => {
      const createObjectUrlMock = jest.fn(() => 'blob:mock-csv');
      const revokeObjectUrlMock = jest.fn();
      Object.defineProperty(URL, 'createObjectURL', {
        value: createObjectUrlMock,
        writable: true,
      });
      Object.defineProperty(URL, 'revokeObjectURL', {
        value: revokeObjectUrlMock,
        writable: true,
      });
      const clickSpy = jest
        .spyOn(HTMLAnchorElement.prototype, 'click')
        .mockImplementation(() => {});

      const metrics = buildEngineeringHubMetrics({
        activeBreakdownsCount: 1,
        resolvedTodayCount: 1,
        recentActiveRows: [],
        breakdownHistoryRows: [
          {
            id: 'b1',
            fleet_id: 'HD-10',
            machine_id: 'm1',
            machine_name: 'HD-10',
            machine_type: 'Haul Truck',
            reason: 'Transmission sensor error',
            status: 'active',
            date_in: '2026-11-20',
            time_in: '08:00',
            site_code: 'PIT-1',
            shift_type: 'day',
            created_at: '2026-11-20T08:00:00Z',
          },
          {
            id: 'b2',
            fleet_id: 'DZ-02',
            machine_id: 'm2',
            machine_name: 'DZ-02',
            machine_type: 'Dozer',
            reason: 'Alternator belt snapped',
            status: 'completed',
            date_in: '2026-11-19',
            time_in: '09:00',
            date_out: '2026-11-19',
            time_out: '11:30',
            site_code: 'PIT-2',
            shift_type: 'day',
            created_at: '2026-11-19T09:00:00Z',
            updated_at: '2026-11-19T11:30:00Z',
          },
        ],
        machineRows: [
          {
            id: 'm1',
            name: 'HD-10',
            machine_type: 'Haul Truck',
            serial_number: 'SN-10',
            active: true,
          },
          {
            id: 'm2',
            name: 'DZ-02',
            machine_type: 'Dozer',
            serial_number: 'SN-02',
            active: true,
          },
        ],
        tireRows: [
          {
            id: 't1',
            serial_number: 'TR-900',
            brand: 'Michelin',
            size: '40.00R57',
            position: 'Rear Left',
            status: 'installed',
            installed_at: '2026-11-01',
            installed_hours: 800,
            removed_at: null,
            machine_id: 'm1',
          },
          {
            id: 't2',
            serial_number: 'TR-901',
            brand: 'Goodyear',
            size: '40.00R57',
            position: 'Front Right',
            status: 'installed',
            installed_at: '2026-11-01',
            installed_hours: 500,
            removed_at: null,
            machine_id: 'm1',
          },
          {
            id: 't3',
            serial_number: 'TR-902',
            brand: 'Bridgestone',
            size: '40.00R57',
            position: 'Front Left',
            status: 'installed',
            installed_at: '2026-11-01',
            installed_hours: 200,
            removed_at: null,
            machine_id: 'm2',
          },
        ],
        tireInspectionRows: [
          {
            id: 'ti1',
            tire_id: 't1',
            inspection_date: '2026-11-19',
            tread_depth_mm: 20,
            pressure_psi: 95,
            condition_status: 'warning',
            notes: 'Monitor',
          },
          {
            id: 'ti2',
            tire_id: 't2',
            inspection_date: '2026-11-19',
            tread_depth_mm: 36,
            pressure_psi: 105,
            condition_status: 'good',
            notes: 'Healthy',
          },
        ],
        machineHoursRows: [
          {
            machine_id: 'm1',
            daily_log_date: '2026-11-20',
            hours_worked: 12,
            created_at: '2026-11-20T18:00:00Z',
          },
        ],
        machineOperationRows: [],
        referenceDateIso: '2026-11-20',
      });

      render(<EngineeringHubDashboardClient metrics={metrics} />);

      expect(screen.getByText('Transmission sensor error')).toBeInTheDocument();
      expect(screen.getByText('Alternator belt snapped')).toBeInTheDocument();

      fireEvent.change(screen.getByLabelText('Filter breakdown status'), {
        target: { value: 'active' },
      });
      expect(screen.getByText('Transmission sensor error')).toBeInTheDocument();
      expect(screen.queryByText('Alternator belt snapped')).not.toBeInTheDocument();

      fireEvent.change(screen.getByLabelText('Filter breakdowns ledger'), {
        target: { value: 'nonexistent' },
      });
      expect(
        screen.getByText('No breakdown records match the current filters.')
      ).toBeInTheDocument();

      fireEvent.change(screen.getByLabelText('Filter tire alerts'), {
        target: { value: 'TR-900' },
      });
      expect(screen.getByText('TR-900')).toBeInTheDocument();
      expect(screen.queryByText('TR-901')).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /Export CSV/i }));
      expect(createObjectUrlMock).toHaveBeenCalledTimes(1);
      expect(clickSpy).toHaveBeenCalledTimes(1);

      expect(escapeEngineeringCsvCell('=CMD()')).toBe('"\'=CMD()"');
      expect(escapeEngineeringCsvCell('Safe "Text"')).toBe('"Safe ""Text"""');

      clickSpy.mockRestore();
    });
  });

  describe('EngineeringLayout (layout.tsx)', () => {
    it('renders the ActiveDepartmentSetter and DepartmentLayout with engineering tabs', async () => {
      const jsx = await EngineeringLayout({
        children: <div data-testid="eng-child">Engineering Child Content</div>,
      });
      render(jsx);

      expect(screen.getByTestId('active-dept-setter')).toHaveAttribute('data-dept', 'engineering');
      expect(screen.getByTestId('eng-child')).toBeInTheDocument();
      expect(screen.getAllByText(/Engineering/i).length).toBeGreaterThan(0);
    });
  });

  describe('EngineeringLoading (loading.tsx)', () => {
    it('renders an accessible skeleton loader with aria-busy and light-mode tokens', () => {
      const { container } = render(<EngineeringLoading />);

      const root = container.firstElementChild as HTMLElement;
      expect(root).toHaveAttribute('aria-busy', 'true');
      expect(root).toHaveAttribute('aria-label', 'Loading engineering');
      expect(container.querySelectorAll('.animate-pulse').length).toBe(4);
    });
  });

  describe('EngineeringError (error.tsx)', () => {
    it('renders the error fallback alert and invokes reset when Try again is clicked', () => {
      const resetMock = jest.fn();
      const testError = new Error('Simulated engineering telemetry failure');

      render(<EngineeringError error={testError} reset={resetMock} />);

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Engineering Error')).toBeInTheDocument();
      expect(screen.getByText('Simulated engineering telemetry failure')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /Try again/i }));
      expect(resetMock).toHaveBeenCalledTimes(1);
    });
  });
});
