import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import BreakdownsPage from './page';

// Mock child component BreakdownsDashboard
jest.mock('@/features/departments', () => ({
  BreakdownsDashboard: jest.fn(({ metrics, breakdowns, machines }) => (
    <div data-testid="breakdowns-dashboard">
      <div data-testid="total-breakdowns">{metrics.total}</div>
      <div data-testid="active-breakdowns">{metrics.active}</div>
      <div data-testid="completed-today">{metrics.completedToday}</div>
      <div data-testid="avg-repair-hours">{metrics.avgRepairHours}</div>
      <div data-testid="breakdowns-count">{breakdowns.length}</div>
      <div data-testid="machines-count">{machines.length}</div>
    </div>
  )),
}));

// Mock vector search action
jest.mock('@/app/actions/vector-search', () => ({
  searchBreakdownDiagnosticsAction: jest.fn(),
}));

const mockBreakdowns = [
  {
    id: 'bd-1',
    department_id: 'dept-eng',
    fleet_id: 'DT-01',
    machine_name: 'Dump Truck 01',
    machine_type: 'Haul Truck',
    status: 'active',
    date_in: '2026-03-30',
    time_in: '08:00',
    date_out: null,
    time_out: null,
    created_at: '2026-03-30T08:00:00Z',
  },
  {
    id: 'bd-2',
    department_id: 'dept-eng',
    fleet_id: 'EX-01',
    machine_name: 'Excavator 01',
    machine_type: 'Excavator',
    status: 'completed',
    date_in: '2026-03-30',
    time_in: '06:00',
    date_out: '2026-03-30', // matches today
    time_out: '10:00', // 4 hours diff
    created_at: '2026-03-30T06:00:00Z',
  },
  {
    id: 'bd-3',
    department_id: 'dept-eng',
    fleet_id: 'DZ-01',
    machine_name: 'Dozer 01',
    machine_type: 'Dozer',
    status: 'completed',
    date_in: '2026-03-29',
    time_in: '12:00',
    date_out: '2026-03-29', // not today
    time_out: '14:00', // 2 hours diff
    created_at: '2026-03-29T12:00:00Z',
  },
];

const mockMachines = [
  {
    id: 'm-1',
    name: 'Dump Truck 01',
    machine_type: 'Haul Truck',
    serial_number: 'SN-01',
    active: true,
  },
  {
    id: 'm-2',
    name: 'Excavator 01',
    machine_type: 'Excavator',
    serial_number: 'SN-02',
    active: true,
  },
];

let breakdownsQueryData: typeof mockBreakdowns | null = mockBreakdowns;
let machinesQueryData: typeof mockMachines | null = mockMachines;

// Mock dept-context
jest.mock('~/lib/dept-context', () => ({
  requireDepartment: jest.fn(),
  getDepartmentContext: jest.fn().mockImplementation(() =>
    Promise.resolve({
      deptId: 'dept-eng',
      today: '2026-03-30',
      supabase: {
        from: jest.fn((table: string) => {
          if (table === 'breakdowns') {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              is: jest.fn().mockReturnThis(),
              order: jest.fn().mockReturnThis(),
              limit: jest.fn().mockResolvedValue({ data: breakdownsQueryData }),
            };
          }
          if (table === 'machines') {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              order: jest.fn().mockResolvedValue({ data: machinesQueryData }),
            };
          }
          return {
            select: jest.fn().mockReturnThis(),
            order: jest.fn().mockResolvedValue({ data: [] }),
          };
        }),
      },
    })
  ),
}));

describe('BreakdownsPage', () => {
  beforeEach(() => {
    breakdownsQueryData = mockBreakdowns;
    machinesQueryData = mockMachines;
  });

  it('computes breakdown metrics in a single pass accurately', async () => {
    const jsx = await BreakdownsPage({
      params: Promise.resolve({ department: 'engineering' }),
    });
    render(jsx);

    expect(screen.getByTestId('breakdowns-dashboard')).toBeInTheDocument();
    expect(screen.getByTestId('total-breakdowns')).toHaveTextContent('3');
    expect(screen.getByTestId('active-breakdowns')).toHaveTextContent('1');
    expect(screen.getByTestId('completed-today')).toHaveTextContent('1');
    // Avg repair hours = (4 + 2) / 2 = 3
    expect(screen.getByTestId('avg-repair-hours')).toHaveTextContent('3');
    expect(screen.getByTestId('breakdowns-count')).toHaveTextContent('3');
    expect(screen.getByTestId('machines-count')).toHaveTextContent('2');
  });

  it('handles empty breakdown datasets without division by zero', async () => {
    breakdownsQueryData = [];
    machinesQueryData = [];

    const jsx = await BreakdownsPage({
      params: Promise.resolve({ department: 'engineering' }),
    });
    render(jsx);

    expect(screen.getByTestId('breakdowns-dashboard')).toBeInTheDocument();
    expect(screen.getByTestId('total-breakdowns')).toHaveTextContent('0');
    expect(screen.getByTestId('active-breakdowns')).toHaveTextContent('0');
    expect(screen.getByTestId('completed-today')).toHaveTextContent('0');
    expect(screen.getByTestId('avg-repair-hours')).toHaveTextContent('0');
    expect(screen.getByTestId('breakdowns-count')).toHaveTextContent('0');
    expect(screen.getByTestId('machines-count')).toHaveTextContent('0');
  });

  it('handles null query responses gracefully', async () => {
    breakdownsQueryData = null;
    machinesQueryData = null;

    const jsx = await BreakdownsPage({
      params: Promise.resolve({ department: 'engineering' }),
    });
    render(jsx);

    expect(screen.getByTestId('breakdowns-dashboard')).toBeInTheDocument();
    expect(screen.getByTestId('total-breakdowns')).toHaveTextContent('0');
    expect(screen.getByTestId('avg-repair-hours')).toHaveTextContent('0');
  });
});
