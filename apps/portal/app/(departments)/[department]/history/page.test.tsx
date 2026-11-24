import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import type React from 'react';
import { getDepartmentContext } from '~/lib/dept-context';
import HistoryPage from './page';

const mockFrom = jest.fn();

jest.mock('next/form', () => ({
  __esModule: true,
  default: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <form className={className}>{children}</form>
  ),
}));

jest.mock('@/lib/server-cache', () => ({
  cacheLife: jest.fn(),
  cacheTag: jest.fn(),
  tagDepartment: jest.fn((slug: string, section: string) => `dept:${slug}:${section}`),
}));

jest.mock('@/lib/cache-utils', () => ({
  withCache: jest.fn((fn: () => Promise<unknown>) => fn()),
}));

jest.mock('@repo/supabase/read-replica', () => ({
  createReadReplicaClient: jest.fn(async () => ({
    from: (...args: unknown[]) => mockFrom(...args),
  })),
}));

jest.mock('~/lib/dept-context', () => ({
  getDepartmentContext: jest.fn(),
}));

jest.mock(
  '~/features/departments/components/plant-inventory/PlantInventoryWorkspaceClient',
  () => ({
    PlantInventoryWorkspaceClient: ({ mode, today }: { mode: string; today: string }) => (
      <div data-testid="plant-inventory-history">
        {mode}:{today}
      </div>
    ),
  })
);

jest.mock('~/features/departments/components/plant-processing/actions', () => ({
  getPlantProcessingWorkspaceData: jest.fn(async (today: string) => ({
    currentDate: today,
    initialSheets: [],
    initialDelays: [],
  })),
}));

jest.mock('~/features/departments/components/plant-processing/PlantHistoryDatabaseClient', () => ({
  PlantHistoryDatabaseClient: ({ initialDate }: { initialDate: string }) => (
    <div data-testid="plant-processing-history">{initialDate}</div>
  ),
}));

jest.mock('~/features/departments/components/production/actions', () => ({
  getProductionPerformanceData: jest.fn(async () => ({
    selectedMonth: '2026-10',
    monthLabel: 'October 2026',
    availableMonths: [],
    targets: {},
    shiftRows: [],
    dailyRows: [],
    weeklyRows: [],
    monthlyRows: [],
    delayGroups: [],
    foremanSummary: {},
  })),
}));

jest.mock('~/features/departments/components/production/ProductionPerformanceClient', () => ({
  ProductionPerformanceClient: ({
    deptId,
    initialData,
  }: {
    deptId: string;
    initialData: { monthLabel: string };
  }) => (
    <div data-testid="production-performance-history">
      {deptId}:{initialData.monthLabel}
    </div>
  ),
}));

describe('HistoryPage ([department]/history/page.tsx)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders PlantInventoryWorkspaceClient for plant-inventory', async () => {
    (getDepartmentContext as jest.Mock).mockResolvedValueOnce({
      dept: { name: 'plant-inventory', type: 'standard' },
      deptId: 'dept-inv',
      today: '2026-10-22',
    });

    const jsx = await HistoryPage({
      params: Promise.resolve({ department: 'plant-inventory' }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    expect(screen.getByTestId('plant-inventory-history')).toHaveTextContent(
      'stock-required:2026-10-22'
    );
  });

  it('renders PlantHistoryDatabaseClient for plant-processing', async () => {
    (getDepartmentContext as jest.Mock).mockResolvedValueOnce({
      dept: { name: 'plant-processing', type: 'standard' },
      deptId: 'dept-pp',
      today: '2026-10-22',
    });

    const jsx = await HistoryPage({
      params: Promise.resolve({ department: 'plant-processing' }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    expect(screen.getByTestId('plant-processing-history')).toHaveTextContent('2026-10-22');
  });

  it('renders ProductionPerformanceClient for production', async () => {
    (getDepartmentContext as jest.Mock).mockResolvedValueOnce({
      dept: { name: 'production', type: 'standard' },
      deptId: 'dept-prod',
      today: '2026-10-22',
    });

    const jsx = await HistoryPage({
      params: Promise.resolve({ department: 'production' }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    expect(screen.getByTestId('production-performance-history')).toHaveTextContent(
      'dept-prod:October 2026'
    );
  });

  it('renders control room shift history with explicit en-US load totals and en-ZA timestamps', async () => {
    (getDepartmentContext as jest.Mock).mockResolvedValueOnce({
      dept: { name: 'control-room', type: 'control_room' },
      deptId: 'dept-cr',
      today: '2026-10-22',
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'shift_status') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          lte: jest.fn().mockReturnThis(),
          order: jest.fn(async () => ({
            data: [
              {
                shift_date: '2026-10-22',
                shift_type: 'day',
                status: 'closed',
                closed_at: '2026-10-22T18:00:00Z',
                closer: { full_name: 'S. Mokoena' },
              },
            ],
          })),
        };
      }
      if (table === 'machine_operations') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          lte: jest.fn(async () => ({
            data: [
              {
                shift_date: '2026-10-22',
                shift_type: 'day',
                hours_worked: 9.5,
                delay_entries: [{ duration_hours: 0.5, deleted_at: null }],
              },
            ],
          })),
        };
      }
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn(async () => ({
          data: [{ load_date: '2026-10-22', shift_type: 'day', total_loads: 1250 }],
        })),
      };
    });

    const jsx = await HistoryPage({
      params: Promise.resolve({ department: 'control-room' }),
      searchParams: Promise.resolve({ from: '2026-10-01', to: '2026-10-22' }),
    });
    render(jsx);

    expect(screen.getByText('Shift History')).toBeInTheDocument();
    expect(screen.getByText('1,250')).toBeInTheDocument();
    expect(screen.getByText('9.5')).toBeInTheDocument();
    expect(screen.getByText('30')).toBeInTheDocument();
    expect(screen.getByText('S. Mokoena')).toBeInTheDocument();
  });

  it('renders standard department daily log history with explicit en-ZA creation date', async () => {
    (getDepartmentContext as jest.Mock).mockResolvedValueOnce({
      dept: { name: 'drilling', type: 'standard' },
      deptId: 'dept-dr',
      today: '2026-10-22',
    });

    mockFrom.mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      returns: jest.fn(async () => ({
        data: [
          {
            id: 'log-1',
            log_date: '2026-10-22',
            shift: 'day',
            notes: 'Normal bench progress',
            created_at: '2026-10-22T08:00:00Z',
          },
        ],
      })),
    }));

    const jsx = await HistoryPage({
      params: Promise.resolve({ department: 'drilling' }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    expect(screen.getByText('History')).toBeInTheDocument();
    expect(screen.getByText('Normal bench progress')).toBeInTheDocument();
    expect(
      screen.getByText(new Date('2026-10-22T08:00:00Z').toLocaleDateString('en-ZA'))
    ).toBeInTheDocument();
  });
});
