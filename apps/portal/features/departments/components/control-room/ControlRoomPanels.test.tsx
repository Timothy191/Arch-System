import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ControlRoomSummaryGridClient } from '~/app/(departments)/[department]/ControlRoomSummaryGridClient';
import { TargetsTab } from '~/features/admin/tabs/TargetsTab';
import { AlertPanel } from './AlertPanel';
import { ScadaPanel } from './ScadaPanel';

jest.mock('@/hooks/useDashboardQueries', () => ({
  useControlRoomSummary: () => ({
    data: {
      totalHours: 48.5,
      activeOperations: 4,
      totalDelayHours: 3.2,
      committedDelayHours: 2.0,
      draftDelayHours: 1.2,
      totalLoads: 164,
      machineCount: 9,
      delayEntriesCount: 5,
    },
  }),
}));

jest.mock('~/features/admin/actions/targets', () => ({
  getOperationalTargets: jest.fn().mockResolvedValue({
    shift: {
      loadsTarget: 180,
      coalTonnesTarget: 4500,
      wasteTonnesTarget: 8200,
      volumeBcmTarget: 5400,
      smrHoursTarget: 96,
    },
    daily: {
      loadsTarget: 360,
      coalTonnesTarget: 9000,
      wasteTonnesTarget: 16400,
      volumeBcmTarget: 10800,
      smrHoursTarget: 192,
    },
    monthly: {
      loadsTarget: 10800,
      coalTonnesTarget: 270000,
      wasteTonnesTarget: 492000,
      volumeBcmTarget: 324000,
      smrHoursTarget: 5760,
    },
  }),
  adminSaveOperationalTargets: jest.fn().mockResolvedValue({ success: true }),
}));

describe('Control Room Redesigned Panels & Summary Golden Graphs', () => {
  it('renders Golden Graphs in ControlRoomSummaryGridClient using HeroCard layout', () => {
    render(<ControlRoomSummaryGridClient deptId="dept-cr" today="2026-10-23" />);

    expect(screen.getByText('Hours Today')).toBeInTheDocument();
    expect(screen.getByText('Total Loads')).toBeInTheDocument();
    expect(screen.getByText('Delay Hours')).toBeInTheDocument();
    expect(screen.getByText('Machines')).toBeInTheDocument();
    expect(screen.getByText('Delay Entries')).toBeInTheDocument();

    expect(screen.getByTestId('summary-golden-graph-hours-today')).toBeInTheDocument();
    expect(screen.getByTestId('summary-golden-graph-total-loads')).toBeInTheDocument();
    expect(screen.getByTestId('summary-golden-graph-delay-hours')).toBeInTheDocument();
    expect(screen.getByTestId('summary-golden-graph-machines')).toBeInTheDocument();
    expect(screen.getByTestId('summary-golden-graph-delay-entries')).toBeInTheDocument();
    expect(screen.getAllByTestId('summary-graph-arch-node').length).toBeGreaterThan(10);
  });

  it('renders Excavator Activity and Registered Machines with Loaded Loads in ScadaPanel', () => {
    render(<ScadaPanel departmentId="dept-cr" />);

    expect(screen.getByTestId('scada-excavator-machines-panel')).toBeInTheDocument();
    expect(screen.getByText(/Excavator Activity & Registered Fleet Loads/i)).toBeInTheDocument();
    expect(screen.getByText(/Excavator Activity \(Active Dig Faces\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Registered Machines with Loaded Loads/i)).toBeInTheDocument();

    // Switch between Excavators and Machines tabs
    const excavatorsTab = screen.getByRole('tab', { name: /Excavators/i });
    fireEvent.click(excavatorsTab);
    expect(screen.getByText(/Excavator Activity \(Active Dig Faces\)/i)).toBeInTheDocument();

    const machinesTab = screen.getByRole('tab', { name: /Machines/i });
    fireEvent.click(machinesTab);
    expect(screen.getByText(/Registered Machines with Loaded Loads/i)).toBeInTheDocument();
  });

  it('renders Shift, Daily, and Monthly Operational Target Graphs in AlertPanel', async () => {
    render(<AlertPanel departmentId="dept-cr" />);

    expect(screen.getByTestId('control-room-targets-visual-panel')).toBeInTheDocument();
    expect(screen.getByText(/Operational Target Graphs & KPI Attainment/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Admin Targets/i })).toHaveAttribute(
      'href',
      '/admin?tab=targets'
    );

    const dailyTab = screen.getByRole('tab', { name: /Daily/i });
    fireEvent.click(dailyTab);
    await waitFor(() => {
      expect(screen.getByText(/DAILY PLAN INDEX/i)).toBeInTheDocument();
    });

    const monthlyTab = screen.getByRole('tab', { name: /Monthly/i });
    fireEvent.click(monthlyTab);
    await waitFor(() => {
      expect(screen.getByText(/MONTHLY PLAN INDEX/i)).toBeInTheDocument();
    });
  });

  it('renders Administration TargetsTab with Shift, Daily, and Monthly target configurations', async () => {
    render(<TargetsTab />);

    await waitFor(() => {
      expect(screen.getByText('Shift Targets')).toBeInTheDocument();
      expect(screen.getByText('Daily Targets')).toBeInTheDocument();
      expect(screen.getByText('Monthly Targets')).toBeInTheDocument();
    });
  });
});
