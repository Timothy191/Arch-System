import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { connection } from 'next/server';
import { getDepartmentContext } from '~/lib/dept-context';
import {
  getAccessControlMetrics,
  getBadgeStatusDistribution,
  getEntityBadgeStatus,
  getHourlyAccessStats,
  getLivePerimeterGates,
  getMusterRollCall,
  getRecentAccessActivity,
} from './actions';
import AccessControlDashboardPage from './page';

jest.mock('next/server', () => ({
  connection: jest.fn(async () => undefined),
}));

jest.mock('next/dynamic', () => () => {
  const DynamicStub = () => <div data-testid="dynamic-dashboard-widget" />;
  return DynamicStub;
});

jest.mock('~/lib/dept-context', () => ({
  getDepartmentContext: jest.fn(),
}));

jest.mock('./actions', () => ({
  getAccessControlMetrics: jest.fn(),
  getBadgeStatusDistribution: jest.fn(),
  getEntityBadgeStatus: jest.fn(),
  getHourlyAccessStats: jest.fn(),
  getLivePerimeterGates: jest.fn(),
  getMusterRollCall: jest.fn(),
  getRecentAccessActivity: jest.fn(),
  triggerGatePulse: jest.fn(),
}));

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

describe('AccessControlDashboardPage', () => {
  const mockConnection = connection as jest.Mock;
  const mockGetDepartmentContext = getDepartmentContext as jest.Mock;
  const mockGetMetrics = getAccessControlMetrics as jest.Mock;
  const mockGetActivity = getRecentAccessActivity as jest.Mock;
  const mockGetEntityStatus = getEntityBadgeStatus as jest.Mock;
  const mockGetHourlyStats = getHourlyAccessStats as jest.Mock;
  const mockGetDistribution = getBadgeStatusDistribution as jest.Mock;
  const mockGetPerimeterGates = getLivePerimeterGates as jest.Mock;
  const mockGetMusterRollCall = getMusterRollCall as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockGetDepartmentContext.mockResolvedValue({
      deptId: 'dept-access-001',
      today: '2026-11-16',
    });

    mockGetMetrics.mockResolvedValue({
      activeQrCodes: 120,
      expiringSoon: 4,
      deniedToday: 2,
      accessEventsToday: 450,
      expiredAssigned: 1,
      entityCoverage: 92,
    });

    mockGetActivity.mockResolvedValue([]);
    mockGetEntityStatus.mockResolvedValue([
      { type: 'Employees', total: 100, active: 88, expiring: 3, expired: 1 },
      { type: 'Vehicles', total: 35, active: 32, expiring: 1, expired: 0 },
    ]);
    mockGetHourlyStats.mockResolvedValue([]);
    mockGetDistribution.mockResolvedValue([]);
    mockGetPerimeterGates.mockResolvedValue([
      {
        id: 'GATE-01-NORTH',
        name: 'Main North Inbound Boom Barrier',
        type: 'boom_barrier',
        zone: 'Perimeter Access Road',
        status: 'ONLINE',
        mode: 'Auto-Pulse',
        cycleCountToday: 342,
        lastEventTime: '1 min ago',
        lastEntityPassed: 'CAT 777D Haul Truck #14',
        interlockActive: false,
      },
    ]);
    mockGetMusterRollCall.mockResolvedValue({
      totalSoulsOnSite: 142,
      accountedCount: 142,
      unaccountedCount: 0,
      evacuatedCount: 0,
      blastStatus: 'ALL_CLEAR',
      musterStations: [],
      records: [
        {
          id: 'rec-1',
          entityType: 'personnel',
          name: 'John Doe',
          company: 'Mine Operations',
          roleOrPurpose: 'Operator',
          assignedZone: 'Pit Alpha',
          lastSeenTime: '5m ago',
          lastSeenGate: 'Main Gate',
          status: 'accounted',
          station: 'Muster Point Alpha',
          checkedOffAt: '08:00',
          inductionValid: true,
          medicalValid: true,
        },
        {
          id: 'rec-2',
          entityType: 'visitor',
          name: 'Alex Guest',
          company: 'Contractors Ltd',
          roleOrPurpose: 'Audit',
          assignedZone: 'Admin',
          lastSeenTime: '10m ago',
          lastSeenGate: 'Main Gate',
          status: 'accounted',
          station: 'Muster Point Charlie',
          checkedOffAt: '08:02',
          inductionValid: true,
          medicalValid: true,
        },
      ],
    });
  });

  it('awaits connection(), queries all dashboard data in parallel, and renders core dashboard bands', async () => {
    const element = await AccessControlDashboardPage();
    render(element);

    expect(mockConnection).toHaveBeenCalledTimes(1);
    expect(mockGetDepartmentContext).toHaveBeenCalledWith({ department: 'access-control' });
    expect(mockGetMetrics).toHaveBeenCalledWith('dept-access-001');
    expect(mockGetActivity).toHaveBeenCalledWith('dept-access-001', 10);
    expect(mockGetEntityStatus).toHaveBeenCalledWith('dept-access-001');
    expect(mockGetHourlyStats).toHaveBeenCalledWith('dept-access-001', '2026-11-16');
    expect(mockGetDistribution).toHaveBeenCalledWith('dept-access-001');
    expect(mockGetPerimeterGates).toHaveBeenCalledTimes(1);
    expect(mockGetMusterRollCall).toHaveBeenCalledWith('dept-access-001');

    expect(screen.getByText(/Souls On-Site/i)).toBeInTheDocument();
    expect(screen.getByText('Security Operations Command')).toBeInTheDocument();
    expect(screen.getByText('Perimeter Barriers & Gate Telemetry HUD')).toBeInTheDocument();
    expect(screen.getByText('Main North Inbound Boom Barrier')).toBeInTheDocument();
    expect(screen.getAllByTestId('dynamic-dashboard-widget')).toHaveLength(4);
  });

  it('derives fallback breakdown counts from muster records when entity status omits rows', async () => {
    mockGetEntityStatus.mockResolvedValue([]);

    const element = await AccessControlDashboardPage();
    render(element);

    expect(screen.getByText('142')).toBeInTheDocument();
    expect(screen.getByText('Muster Roll Call')).toBeInTheDocument();
  });
});
