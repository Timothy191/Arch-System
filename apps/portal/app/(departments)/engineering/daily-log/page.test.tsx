import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  BarChart: ({ children }: { children: ReactNode }) => (
    <div data-testid="bar-chart">{children}</div>
  ),
  Bar: ({ name }: { name?: string }) => <div data-testid="chart-bar" data-name={name} />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  Tooltip: () => <div data-testid="chart-tooltip" />,
}));

jest.mock('next/server', () => ({
  connection: jest.fn(async () => undefined),
}));

const mockBreakdownRecentOrder = jest.fn();
const mockBreakdownTodayOrder = jest.fn();
const mockMachinesOrder = jest.fn();

const mockSupabaseFrom = jest.fn((table: string) => {
  if (table === 'machines') {
    return {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      order: mockMachinesOrder,
    };
  }
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn((col: string) => {
      if (col === 'date_in') {
        return { order: mockBreakdownTodayOrder };
      }
      return {
        eq: jest.fn((col2: string) => {
          if (col2 === 'date_in') {
            return { order: mockBreakdownTodayOrder };
          }
          return {
            is: jest.fn().mockReturnThis(),
            gte: jest.fn().mockReturnThis(),
            order: mockBreakdownRecentOrder,
          };
        }),
        is: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        order: mockBreakdownRecentOrder,
      };
    }),
  };
});

jest.mock('~/lib/dept-context', () => ({
  getDepartmentContext: jest.fn(async () => ({
    deptId: 'dept-engineering-001',
    today: '2026-11-20',
    supabase: {
      from: (...args: unknown[]) => mockSupabaseFrom(...(args as [string])),
    },
  })),
}));

import { EngineeringDailyLogClient } from './EngineeringDailyLogClient';
import {
  buildEngineeringDailyLogReport,
  escapeEngineeringCsvCell,
} from './engineering-daily-log-helpers';
import EngineeringDailyLogLoading from './loading';
import EngineeringDailyLogPage from './page';

describe('/engineering/daily-log Page & Report Client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches 24h & today breakdowns, deduplicates overlapping IDs, and renders KPIs + charts + table', async () => {
    const sharedBreakdown = {
      id: 'bd-overlap',
      fleet_id: 'BD-43',
      machine_id: 'm-1',
      machine_name: null,
      machine_type: 'Dozer',
      site_code: null,
      shift_type: 'day',
      date_in: '2026-11-20',
      time_in: '07:30',
      date_out: '2026-11-20',
      time_out: '10:00',
      duration_hours: null,
      duration_minutes: null,
      delay_hours: null,
      reason: 'Hydraulic hose burst',
      repair_notes: 'Replaced high-pressure hose and tested',
      status: 'completed',
      created_at: '2026-11-20T07:30:00Z',
      updated_at: '2026-11-20T10:00:00Z',
    };

    const nightActiveBreakdown = {
      id: 'bd-night',
      fleet_id: 'HT-19',
      machine_id: 'm-2',
      machine_name: 'CAT 777G #19',
      machine_type: 'Haul Truck',
      site_code: 'PIT-B',
      shift_type: 'night',
      date_in: '2026-11-19',
      time_in: '22:00',
      date_out: null,
      time_out: null,
      duration_hours: 4.5,
      duration_minutes: null,
      delay_hours: null,
      reason: 'Turbocharger boost pressure fault',
      repair_notes: null,
      status: 'active',
      created_at: '2026-11-19T22:00:00Z',
      updated_at: '2026-11-19T22:30:00Z',
    };

    mockBreakdownRecentOrder.mockResolvedValueOnce({
      data: [sharedBreakdown, nightActiveBreakdown],
      error: null,
    });
    mockBreakdownTodayOrder.mockResolvedValueOnce({
      data: [sharedBreakdown],
      error: null,
    });
    mockMachinesOrder.mockResolvedValueOnce({
      data: [
        {
          id: 'm-1',
          name: 'Caterpillar D9R #43',
          machine_type: 'Dozer',
          serial_number: 'D9R-043',
          active: true,
          site: { name: 'Main Pit', site_code: 'PIT-A' },
        },
        {
          id: 'm-2',
          name: 'CAT 777G #19',
          machine_type: 'Haul Truck',
          serial_number: '777G-019',
          active: true,
          site: { name: 'South Pit', site_code: 'PIT-B' },
        },
      ],
      error: null,
    });

    const jsx = await EngineeringDailyLogPage();
    render(jsx);

    expect(screen.getByText('24-Hour Machine Breakdowns Daily Log')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument(); // Deduplicated 24h count (not 3!)
    expect(screen.getByText('Caterpillar D9R #43')).toBeInTheDocument();
    expect(screen.getByText('CAT 777G #19')).toBeInTheDocument();
    expect(screen.getByText('Hydraulic hose burst')).toBeInTheDocument();
    expect(screen.getByText('Turbocharger boost pressure fault')).toBeInTheDocument();
    expect(screen.getByText('7.0 hrs')).toBeInTheDocument(); // 2.5h + 4.5h
    expect(screen.getByText('2.5 hrs')).toBeInTheDocument(); // MTTR avg
    expect(screen.getAllByTestId('bar-chart')).toHaveLength(2);
  });

  it('renders clean empty state when no breakdowns occurred in the last 24 hours', async () => {
    mockBreakdownRecentOrder.mockResolvedValueOnce({ data: null, error: null });
    mockBreakdownTodayOrder.mockResolvedValueOnce({ data: null, error: null });
    mockMachinesOrder.mockResolvedValueOnce({ data: [], error: null });

    const jsx = await EngineeringDailyLogPage();
    render(jsx);

    expect(screen.getByText('No breakdowns logged in the last 24 hours.')).toBeInTheDocument();
    expect(screen.getByText('No breakdowns found for the last 24 hours')).toBeInTheDocument();
  });

  it('supports filtering by status, shift, machine type, search text, CSV export, and print', () => {
    const createObjectUrlMock = jest.fn(() => 'blob:daily-log');
    const revokeObjectUrlMock = jest.fn();
    Object.defineProperty(URL, 'createObjectURL', {
      value: createObjectUrlMock,
      writable: true,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      value: revokeObjectUrlMock,
      writable: true,
    });
    const clickSpy = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const printSpy = jest.spyOn(window, 'print').mockImplementation(() => {});

    const report = buildEngineeringDailyLogReport({
      today: '2026-11-20',
      nowMs: new Date('2026-11-20T12:00:00Z').getTime(),
      machines: [
        {
          id: 'm-1',
          name: 'BD-43',
          machine_type: 'Dozer',
          serial_number: 'D9R',
          active: true,
        },
      ],
      breakdowns: [
        {
          id: 'bd-1',
          fleet_id: 'BD-43',
          machine_id: 'm-1',
          machine_name: 'BD-43',
          machine_type: 'Dozer',
          site_code: 'PIT-1',
          shift_type: null,
          date_in: '2026-11-20',
          time_in: '08:00',
          date_out: null,
          time_out: null,
          duration_hours: null,
          duration_minutes: null,
          delay_hours: null,
          reason: 'Track roller bearing seizure',
          repair_notes: 'Awaiting spares',
          status: 'active',
          created_at: '2026-11-20T08:00:00Z',
          updated_at: '2026-11-20T08:00:00Z',
        },
        {
          id: 'bd-2',
          fleet_id: 'EX-04',
          machine_id: null,
          machine_name: 'EX-04',
          machine_type: 'Excavator',
          site_code: 'PIT-2',
          shift_type: 'night',
          date_in: '2026-11-20',
          time_in: '01:00',
          date_out: '2026-11-20',
          time_out: '03:00',
          duration_hours: null,
          duration_minutes: 120,
          delay_hours: null,
          reason: 'Alternator replacement',
          repair_notes: 'Completed in workshop',
          status: 'completed',
          created_at: '2026-11-20T01:00:00Z',
          updated_at: '2026-11-20T03:00:00Z',
        },
      ],
    });

    render(<EngineeringDailyLogClient report={report} />);

    expect(screen.getByText('Track roller bearing seizure')).toBeInTheDocument();
    expect(screen.getByText('Alternator replacement')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Filter by breakdown status'), {
      target: { value: 'active' },
    });
    expect(screen.getByText('Track roller bearing seizure')).toBeInTheDocument();
    expect(screen.queryByText('Alternator replacement')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Filter by breakdown status'), {
      target: { value: 'all' },
    });
    fireEvent.change(screen.getByLabelText('Filter by shift'), {
      target: { value: 'night' },
    });
    expect(screen.queryByText('Track roller bearing seizure')).not.toBeInTheDocument();
    expect(screen.getByText('Alternator replacement')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Filter by shift'), {
      target: { value: 'all' },
    });
    fireEvent.change(screen.getByLabelText('Filter by machine type'), {
      target: { value: 'Dozer' },
    });
    expect(screen.getByText('Track roller bearing seizure')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Search 24h breakdowns'), {
      target: { value: 'Track roller' },
    });
    expect(screen.getByText('Track roller bearing seizure')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Export CSV/i }));
    expect(createObjectUrlMock).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /Print Report/i }));
    expect(printSpy).toHaveBeenCalledTimes(1);

    expect(escapeEngineeringCsvCell('+SUM(A1)')).toBe('"\'+SUM(A1)"');

    clickSpy.mockRestore();
    printSpy.mockRestore();
  });

  it('renders the daily log loading skeleton cleanly', () => {
    const { container } = render(<EngineeringDailyLogLoading />);
    const root = container.firstElementChild as HTMLElement;
    expect(root).toHaveAttribute('aria-busy', 'true');
    expect(root).toHaveAttribute('aria-label', 'Loading engineering daily log');
  });
});
