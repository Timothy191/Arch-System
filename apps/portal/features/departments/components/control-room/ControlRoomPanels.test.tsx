import { trace } from '@opentelemetry/api';
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
      shiftType: 'day',
      shiftHoursLabels: [
        '06:00',
        '07:00',
        '08:00',
        '09:00',
        '10:00',
        '11:00',
        '12:00',
        '13:00',
        '14:00',
        '15:00',
        '16:00',
        '17:00',
      ],
      hoursSeries: [2.5, 4.0, 4.2, 4.5, 4.1, 4.0, 3.8, 4.2, 4.5, 4.3, 4.2, 4.2],
      loadsSeries: [8, 12, 15, 16, 14, 13, 11, 14, 16, 17, 15, 13],
      delayHoursSeries: [0, 0.2, 0.5, 0.1, 0.4, 0.8, 0.2, 0.3, 0.1, 0.2, 0.2, 0.2],
      machinesSeries: [8, 8, 9, 9, 9, 9, 8, 9, 9, 9, 9, 9],
      delayEntriesSeries: [0, 1, 1, 0, 1, 1, 0, 1, 0, 0, 0, 0],
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

describe('Control Room Redesigned Panels & Summary KPIs', () => {
  it('renders real summary KPIs in ControlRoomSummaryGridClient without synthetic sparklines', () => {
    render(<ControlRoomSummaryGridClient deptId="dept-cr" today="2026-10-23" />);

    expect(screen.getByText('Hours Today')).toBeInTheDocument();
    expect(screen.getByText('Total Loads')).toBeInTheDocument();
    expect(screen.getByText('Delay Hours')).toBeInTheDocument();
    expect(screen.getByText('Machines')).toBeInTheDocument();
    expect(screen.getByText('Delay Entries')).toBeInTheDocument();

    expect(screen.queryByTestId('summary-golden-graph-hours-today')).not.toBeInTheDocument();
    expect(screen.queryByTestId('summary-golden-graph-total-loads')).not.toBeInTheDocument();
    expect(screen.queryByTestId('summary-golden-graph-delay-hours')).not.toBeInTheDocument();
    expect(screen.queryByTestId('summary-golden-graph-machines')).not.toBeInTheDocument();
    expect(screen.queryByTestId('summary-golden-graph-delay-entries')).not.toBeInTheDocument();
    expect(screen.getByTestId('summary-kpi-separator-hours-today')).toBeInTheDocument();
    expect(screen.getByTestId('summary-kpi-separator-total-loads')).toBeInTheDocument();
    expect(screen.getByTestId('summary-kpi-separator-delay-hours')).toBeInTheDocument();
    expect(screen.getByTestId('summary-kpi-separator-machines')).toBeInTheDocument();
    expect(screen.getByTestId('summary-kpi-separator-delay-entries')).toBeInTheDocument();

    // Verify 5 animated 12-hour shift graphs
    expect(screen.getByTestId('summary-shift-graph-hours-today')).toBeInTheDocument();
    expect(screen.getByTestId('summary-shift-graph-total-loads')).toBeInTheDocument();
    expect(screen.getByTestId('summary-shift-graph-delay-hours')).toBeInTheDocument();
    expect(screen.getByTestId('summary-shift-graph-machines')).toBeInTheDocument();
    expect(screen.getByTestId('summary-shift-graph-delay-entries')).toBeInTheDocument();

    // Verify Day/Night shift time format indicators
    const timeIndicators = screen.getAllByText('06:00 – 17:00');
    expect(timeIndicators).toHaveLength(5);
    const dayShiftLabels = screen.getAllByText('Day Shift');
    expect(dayShiftLabels).toHaveLength(5);

    expect(screen.queryByTestId('summary-graph-arch-node')).not.toBeInTheDocument();
  });

  it('renders Excavator Activity and Registered Machines with Loaded Loads in ScadaPanel', () => {
    render(<ScadaPanel departmentId="dept-cr" />);

    expect(screen.getByTestId('scada-excavator-machines-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('scada-connection-status-badge')).not.toBeInTheDocument();
    expect(screen.queryByTestId('scada-server-timing-badge')).not.toBeInTheDocument();
    expect(screen.queryByTestId('scada-sla-uptime-badge')).not.toBeInTheDocument();
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

    // Verify KPI strip totals render properly
    expect(screen.getByText(/Active Excavators/i)).toBeInTheDocument();
    expect(screen.getByText(/0 Units/i)).toBeInTheDocument();
    expect(screen.getByText(/0 Loads/i)).toBeInTheDocument();
    expect(screen.getByText(/Loaded Volume/i)).toBeInTheDocument();
  });

  it('renders Shift, Daily, and Monthly Operational Target Graphs in AlertPanel', async () => {
    render(<AlertPanel departmentId="dept-cr" />);

    expect(screen.getByTestId('control-room-targets-visual-panel')).toBeInTheDocument();
    expect(screen.getByTestId('trajectory-header-separator')).toBeInTheDocument();
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

  it('emits scada_machine_fetch and scada_realtime_subscription OpenTelemetry spans in ScadaPanel', async () => {
    const setAttributes = jest.fn();
    const addEvent = jest.fn();
    const setStatus = jest.fn();
    const end = jest.fn();
    const startSpan = jest.fn(() => ({
      setAttributes,
      addEvent,
      setStatus,
      end,
    }));
    const getTracerSpy = jest.spyOn(trace, 'getTracer').mockReturnValue({
      startSpan,
    } as never);

    try {
      render(<ScadaPanel departmentId="dept-cr" />);

      await waitFor(() => {
        expect(startSpan).toHaveBeenCalledWith('scada_realtime_subscription', {
          attributes: { department_id: 'dept-cr' },
        });
        expect(startSpan).toHaveBeenCalledWith('scada_machine_fetch', {
          attributes: { department_id: 'dept-cr' },
        });
      });

      expect(setAttributes).toHaveBeenCalledWith(
        expect.objectContaining({ department_id: 'dept-cr' })
      );
      expect(end).toHaveBeenCalled();
    } finally {
      getTracerSpy.mockRestore();
    }
  });

  it('emits alert_status_check and alert_generation OpenTelemetry spans with department_id and alert_count in AlertPanel', async () => {
    const setAttributes = jest.fn();
    const addEvent = jest.fn();
    const setStatus = jest.fn();
    const end = jest.fn();
    const startSpan = jest.fn(() => ({
      setAttributes,
      addEvent,
      setStatus,
      end,
    }));
    const getTracerSpy = jest.spyOn(trace, 'getTracer').mockReturnValue({
      startSpan,
    } as never);

    try {
      render(<AlertPanel departmentId="dept-cr" />);

      await waitFor(() => {
        expect(startSpan).toHaveBeenCalledWith(
          'alert_status_check',
          expect.objectContaining({
            attributes: expect.objectContaining({ department_id: 'dept-cr' }),
          })
        );
        expect(startSpan).toHaveBeenCalledWith(
          'alert_generation',
          expect.objectContaining({
            attributes: expect.objectContaining({
              department_id: 'dept-cr',
              alert_count: expect.any(Number),
            }),
          })
        );
      });

      expect(setAttributes).toHaveBeenCalledWith(
        expect.objectContaining({
          department_id: 'dept-cr',
          alert_count: expect.any(Number),
        })
      );
      expect(end).toHaveBeenCalled();
    } finally {
      getTracerSpy.mockRestore();
    }
  });
});
