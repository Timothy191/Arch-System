import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { toast } from 'sonner';
import {
  type DrillingDailyLogPageData,
  loadDrillingDailyLogData,
  saveDrillDailyEntry,
} from './actions';
import { DrillingDailyLogClient } from './DrillingDailyLogClient';

jest.mock('next/image', () => ({
  __esModule: true,
  default: function MockImage({
    src,
    alt,
    width,
    height,
    className,
  }: {
    src: string;
    alt: string;
    width?: number;
    height?: number;
    className?: string;
  }) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} width={width} height={height} className={className} />;
  },
}));

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('./actions', () => ({
  loadDrillingDailyLogData: jest.fn(),
  saveDrillDailyEntry: jest.fn(),
}));

const DEPT_ID = '11111111-1111-4111-8111-111111111111';
const RIG_1_ID = '22222222-2222-4222-8222-222222222222';
const RIG_2_ID = '33333333-3333-4333-8333-333333333333';

const MOCK_INITIAL_DATA: DrillingDailyLogPageData = {
  departmentId: DEPT_ID,
  logDate: '2026-11-24',
  summary: {
    activeRigs: 2,
    loggedRigs: 1,
    totalDailyMeters: 180.5,
    totalDailyHoles: 34,
    activeSitesCount: 1,
    activeSites: ['Pit North'],
  },
  rigs: [
    {
      machineId: RIG_1_ID,
      name: 'DR-01 Atlas',
      machineType: 'Drill Rig',
      serialNumber: 'AC-9001',
      imageUrl: '/images/fleet/atlas-copco-drill.webp',
      homeSiteName: 'Pit North',
      homeSiteCode: 'PN',
      dayShift: {
        id: 'op-1',
        shiftType: 'day',
        metersDrilled: 120.5,
        holes: 22,
        site: 'Pit North',
        blockDrilled: 'Bench B4',
        operatorName: 'T. Moyo',
        comments: 'Normal drilling',
        status: 'active',
      },
      nightShift: {
        id: 'op-2',
        shiftType: 'night',
        metersDrilled: 60,
        holes: 12,
        site: 'Pit North',
        blockDrilled: 'Bench B4',
        operatorName: 'K. Nkosi',
        comments: null,
        status: 'completed',
      },
      dailyMetersDrilled: 180.5,
      dailyHolesDrilled: 34,
      whereSite: 'Pit North',
      whereBlock: 'Bench B4',
      whereDisplay: 'Pit North · Bench B4',
      isLogged: true,
    },
    {
      machineId: RIG_2_ID,
      name: 'DR-02 Sandvik',
      machineType: 'Drill Rig',
      serialNumber: null,
      imageUrl: '/images/fleet/atlas-copco-drill.webp',
      homeSiteName: 'Pit South',
      homeSiteCode: 'PS',
      dayShift: null,
      nightShift: null,
      dailyMetersDrilled: 0,
      dailyHolesDrilled: 0,
      whereSite: 'Pit South',
      whereBlock: null,
      whereDisplay: 'Pit South',
      isLogged: false,
    },
  ],
};

describe('DrillingDailyLogClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders department KPI summary, link to drilling-operations, and dedicated cards per drill rig', () => {
    render(
      <DrillingDailyLogClient
        departmentId={DEPT_ID}
        today="2026-11-24"
        initialData={MOCK_INITIAL_DATA}
      />
    );

    expect(screen.getByText('Drilling Daily Log')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Drilling Operations/i })).toHaveAttribute(
      'href',
      '/drilling/drilling-operations'
    );
    expect(screen.getByText('Total Daily Meters Drilled (m)')).toBeInTheDocument();
    expect(screen.getAllByText('180.5 m').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Total Daily Holes')).toBeInTheDocument();
    expect(screen.getByText('34')).toBeInTheDocument();

    const rigOneCard = screen.getByTestId(`drill-rig-card-${RIG_1_ID}`);
    expect(within(rigOneCard).getByText('DR-01 Atlas')).toBeInTheDocument();
    expect(within(rigOneCard).getByText('SN AC-9001')).toBeInTheDocument();
    expect(within(rigOneCard).getByText('Active Logged')).toBeInTheDocument();
    expect(within(rigOneCard).getByText('Pit North · Bench B4')).toBeInTheDocument();
    expect(within(rigOneCard).getByText('Day: 120.5 m · Night: 60.0 m')).toBeInTheDocument();
    expect(within(rigOneCard).getByText('Day: 22 · Night: 12')).toBeInTheDocument();
    expect(within(rigOneCard).getByAltText('DR-01 Atlas drill rig')).toHaveAttribute(
      'src',
      '/images/fleet/atlas-copco-drill.webp'
    );

    const rigTwoCard = screen.getByTestId(`drill-rig-card-${RIG_2_ID}`);
    expect(within(rigTwoCard).getByText('DR-02 Sandvik')).toBeInTheDocument();
    expect(within(rigTwoCard).getByText('Awaiting Shift Entry')).toBeInTheDocument();
    expect(within(rigTwoCard).getByText('Pit South')).toBeInTheDocument();
  });

  it('saves inline shift meters for a specific rig and updates card and KPI totals', async () => {
    (saveDrillDailyEntry as jest.Mock).mockResolvedValue({
      success: true,
      record: {
        id: 'op-rig2-day',
        machineId: RIG_2_ID,
        departmentId: DEPT_ID,
        operationDate: '2026-11-24',
        shiftType: 'day',
        metersDrilled: 95.5,
        holes: 16,
        site: 'Pit South',
        blockDrilled: 'Bench S2',
        operatorName: null,
        comments: 'Good ground',
        status: 'active',
      },
    });

    render(
      <DrillingDailyLogClient
        departmentId={DEPT_ID}
        today="2026-11-24"
        initialData={MOCK_INITIAL_DATA}
      />
    );

    const rigTwoCard = screen.getByTestId(`drill-rig-card-${RIG_2_ID}`);
    fireEvent.click(
      within(rigTwoCard).getByRole('button', { name: /Log \/ Update Shift Meters/i })
    );

    fireEvent.change(within(rigTwoCard).getByLabelText('Meters Drilled (m)'), {
      target: { value: '95.5' },
    });
    fireEvent.change(within(rigTwoCard).getByLabelText('Holes Drilled'), {
      target: { value: '16' },
    });
    fireEvent.change(within(rigTwoCard).getByLabelText('Where — Site / Pit'), {
      target: { value: 'Pit South' },
    });
    fireEvent.change(within(rigTwoCard).getByLabelText('Where — Bench / Pattern Block ID'), {
      target: { value: 'Bench S2' },
    });
    fireEvent.change(within(rigTwoCard).getByLabelText('Shift Notes (optional)'), {
      target: { value: 'Good ground' },
    });

    fireEvent.click(within(rigTwoCard).getByRole('button', { name: /Save Shift Entry/i }));

    await waitFor(() => {
      expect(saveDrillDailyEntry).toHaveBeenCalledWith({
        departmentId: DEPT_ID,
        machineId: RIG_2_ID,
        operationDate: '2026-11-24',
        shiftType: 'day',
        metersDrilled: 95.5,
        holes: 16,
        site: 'Pit South',
        blockDrilled: 'Bench S2',
        comments: 'Good ground',
      });
    });

    await waitFor(() => {
      expect(within(rigTwoCard).getByText('Active Logged')).toBeInTheDocument();
      expect(within(rigTwoCard).getByText('Pit South · Bench S2')).toBeInTheDocument();
      expect(screen.getByText('276.0 m')).toBeInTheDocument();
      expect(screen.getByText('50')).toBeInTheDocument();
      expect(toast.success).toHaveBeenCalled();
    });
  });

  it('reloads data when the date picker changes', async () => {
    const nextDateData: DrillingDailyLogPageData = {
      departmentId: DEPT_ID,
      logDate: '2026-11-23',
      summary: {
        activeRigs: 0,
        loggedRigs: 0,
        totalDailyMeters: 0,
        totalDailyHoles: 0,
        activeSitesCount: 0,
        activeSites: [],
      },
      rigs: [],
    };
    (loadDrillingDailyLogData as jest.Mock).mockResolvedValue(nextDateData);

    render(
      <DrillingDailyLogClient
        departmentId={DEPT_ID}
        today="2026-11-24"
        initialData={MOCK_INITIAL_DATA}
      />
    );

    fireEvent.change(screen.getByLabelText('Log date'), { target: { value: '2026-11-23' } });

    await waitFor(() => {
      expect(loadDrillingDailyLogData).toHaveBeenCalledWith({
        deptId: DEPT_ID,
        logDate: '2026-11-23',
      });
      expect(screen.getByText('No active drill rigs found.')).toBeInTheDocument();
    });
  });
});
