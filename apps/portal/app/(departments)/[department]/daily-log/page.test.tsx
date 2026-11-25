import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { loadDrillingDailyLogData } from '~/features/departments/components/drilling';
import { getProductionPlatformTargets } from '~/features/departments/components/production/actions';
import { getDepartmentContext } from '~/lib/dept-context';
import DailyLogPage from './page';

const mockFrom = jest.fn();

jest.mock('next/server', () => ({
  connection: jest.fn(async () => undefined),
}));

jest.mock('~/lib/dept-context', () => ({
  getDepartmentContext: jest.fn(),
}));

jest.mock('~/features/departments/components/production/actions', () => ({
  getProductionPlatformTargets: jest.fn(async () => ({
    shift: {
      pitBcmTarget: 2900,
      coalTonnesTarget: 2250,
      wasteTonnesTarget: 6300,
      loadsTarget: 120,
      rolloverTargetBcm: 950,
      smrHoursTarget: 100,
    },
    daily: {
      pitBcmTarget: 5800,
      coalTonnesTarget: 4500,
      wasteTonnesTarget: 12600,
      loadsTarget: 240,
      rolloverTargetBcm: 1900,
      smrHoursTarget: 200,
    },
    weekly: {
      pitBcmTarget: 40600,
      coalTonnesTarget: 31500,
      wasteTonnesTarget: 88200,
      loadsTarget: 1680,
      rolloverTargetBcm: 13300,
      smrHoursTarget: 1400,
    },
    monthly: {
      pitBcmTarget: 175000,
      coalTonnesTarget: 135000,
      wasteTonnesTarget: 378000,
      loadsTarget: 7200,
      rolloverTargetBcm: 57000,
      smrHoursTarget: 6000,
    },
    notes: null,
    updatedAt: null,
  })),
}));

jest.mock('~/features/departments/components/production/ProductionTargetsPanel', () => ({
  ProductionTargetsPanel: ({
    deptId,
    initialTargets,
  }: {
    deptId?: string;
    initialTargets?: { shift: { pitBcmTarget: number } };
  }) => (
    <div
      data-testid="production-targets-panel"
      data-dept={deptId}
      data-shift-bcm={initialTargets?.shift.pitBcmTarget}
    />
  ),
}));

jest.mock('~/features/departments/components/drilling', () => ({
  loadDrillingDailyLogData: jest.fn(
    async ({ deptId, logDate }: { deptId: string; logDate: string }) => ({
      departmentId: deptId,
      logDate,
      rigs: [],
      summary: {
        totalRigs: 0,
        loggedRigs: 0,
        totalDailyMeters: 0,
        totalDailyHoles: 0,
        activeSites: [],
      },
    })
  ),
  DrillingDailyLogClient: ({ departmentId, today }: { departmentId: string; today?: string }) => (
    <div data-testid="drilling-daily-log-client" data-dept={departmentId} data-date={today} />
  ),
}));

jest.mock(
  '~/features/departments/components/plant-inventory/PlantInventoryWorkspaceClient',
  () => ({
    PlantInventoryWorkspaceClient: ({ mode, today }: { mode: string; today: string }) => (
      <div data-testid="plant-inventory-daily-log" data-mode={mode} data-date={today} />
    ),
  })
);

jest.mock('./DailyLogForm', () => ({
  DailyLogForm: ({ departmentSlug }: { departmentSlug: string }) => (
    <div data-testid="standard-daily-log-form">{departmentSlug}</div>
  ),
}));

describe('/[department]/daily-log Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFrom.mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn(async () => ({ data: [], error: null })),
      then: (resolve: (value: unknown) => void) =>
        Promise.resolve({ data: [], error: null }).then(resolve),
    }));
  });

  it('routes production to ProductionTargetsPanel with loaded targets', async () => {
    (getDepartmentContext as jest.Mock).mockResolvedValueOnce({
      deptId: 'dept-prod-1',
      today: '2026-11-24',
      supabase: { from: (...args: unknown[]) => mockFrom(...args) },
    });

    const jsx = await DailyLogPage({ params: Promise.resolve({ department: 'production' }) });
    render(jsx);

    expect(getProductionPlatformTargets).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('production-targets-panel')).toHaveAttribute(
      'data-dept',
      'dept-prod-1'
    );
  });

  it('routes drilling to DrillingDailyLogClient with per-rig data', async () => {
    (getDepartmentContext as jest.Mock).mockResolvedValueOnce({
      deptId: 'dept-drill-1',
      today: '2026-11-24',
      supabase: { from: (...args: unknown[]) => mockFrom(...args) },
    });

    const jsx = await DailyLogPage({ params: Promise.resolve({ department: 'drilling' }) });
    render(jsx);

    expect(loadDrillingDailyLogData).toHaveBeenCalledWith({
      deptId: 'dept-drill-1',
      logDate: '2026-11-24',
    });
    expect(screen.getByTestId('drilling-daily-log-client')).toHaveAttribute(
      'data-dept',
      'dept-drill-1'
    );
  });

  it('routes plant-inventory to inventory-list mode and falls back to DailyLogForm for other departments', async () => {
    (getDepartmentContext as jest.Mock).mockResolvedValueOnce({
      deptId: 'dept-inv-1',
      today: '2026-11-24',
      supabase: { from: (...args: unknown[]) => mockFrom(...args) },
    });

    const invJsx = await DailyLogPage({
      params: Promise.resolve({ department: 'plant-inventory' }),
    });
    render(invJsx);
    expect(screen.getByTestId('plant-inventory-daily-log')).toHaveAttribute(
      'data-mode',
      'inventory-list'
    );

    (getDepartmentContext as jest.Mock).mockResolvedValueOnce({
      deptId: 'dept-ctrl-1',
      today: '2026-11-24',
      supabase: { from: (...args: unknown[]) => mockFrom(...args) },
    });

    const stdJsx = await DailyLogPage({
      params: Promise.resolve({ department: 'control-room' }),
    });
    render(stdJsx);
    expect(screen.getByTestId('standard-daily-log-form')).toHaveTextContent('control-room');
  });
});
