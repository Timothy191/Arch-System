/* cspell:ignore Nomsa Pieter Thandi */
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { registerVisitor } from '../actions';
import { autoExitOverdueVisitors, manualCheckOutVisitor } from './actions';
import { type VisitorRegistryRow, VisitorsRegistryClient } from './VisitorsRegistryClient';
import {
  formatRemainingOrElapsed,
  isVisitorOverdueForAutoExit,
  VISITOR_AUTO_EXIT_HOURS,
  VISITOR_AUTO_EXIT_MS,
} from './visitor-auto-exit';

const mockRefresh = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

jest.mock('../actions', () => ({
  registerVisitor: jest.fn(),
}));

jest.mock('./actions', () => ({
  autoExitOverdueVisitors: jest.fn(),
  manualCheckOutVisitor: jest.fn(),
}));

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    warning: jest.fn(),
    error: jest.fn(),
  },
}));

describe('visitor-auto-exit helpers', () => {
  const baseNowMs = new Date('2026-11-20T18:00:00.000Z').getTime();

  it('exports 12-hour constants', () => {
    expect(VISITOR_AUTO_EXIT_HOURS).toBe(12);
    expect(VISITOR_AUTO_EXIT_MS).toBe(12 * 60 * 60 * 1000);
  });

  it('enforces exact 11h59m vs 12h00m boundary in isVisitorOverdueForAutoExit', () => {
    const checkIn11h59m = new Date(baseNowMs - (11 * 60 + 59) * 60 * 1000).toISOString();
    const checkIn12h00m = new Date(baseNowMs - 12 * 60 * 60 * 1000).toISOString();

    expect(
      isVisitorOverdueForAutoExit(
        { status: 'Checked In', check_out_time: null, check_in_time: checkIn11h59m },
        baseNowMs
      )
    ).toBe(false);

    expect(
      isVisitorOverdueForAutoExit(
        { status: 'Checked In', check_out_time: null, check_in_time: checkIn12h00m },
        baseNowMs
      )
    ).toBe(true);
  });

  it('uses created_at fallback and ignores non-active or already checked-out visitors', () => {
    const overdueCreatedAt = new Date(baseNowMs - 13 * 60 * 60 * 1000).toISOString();

    expect(
      isVisitorOverdueForAutoExit(
        {
          status: 'Checked In',
          check_out_time: null,
          check_in_time: null,
          created_at: overdueCreatedAt,
        },
        baseNowMs
      )
    ).toBe(true);

    expect(
      isVisitorOverdueForAutoExit(
        { status: 'Checked Out', check_out_time: null, check_in_time: overdueCreatedAt },
        baseNowMs
      )
    ).toBe(false);

    expect(
      isVisitorOverdueForAutoExit(
        {
          status: 'Checked In',
          check_out_time: '2026-11-20T12:00:00.000Z',
          check_in_time: overdueCreatedAt,
        },
        baseNowMs
      )
    ).toBe(false);

    expect(
      isVisitorOverdueForAutoExit(
        { status: 'Checked In', check_out_time: null, check_in_time: 'invalid-date' },
        baseNowMs
      )
    ).toBe(false);
  });

  it('formats elapsed and remaining duration accurately', () => {
    const checkIn11h59m = new Date(baseNowMs - (11 * 60 + 59) * 60 * 1000).toISOString();
    const checkIn12h05m = new Date(baseNowMs - (12 * 60 + 5) * 60 * 1000).toISOString();

    expect(formatRemainingOrElapsed(checkIn11h59m, baseNowMs)).toMatchObject({
      isOverdue: false,
      elapsedLabel: '11h 59m',
      remainingLabel: '0h 01m left',
      summaryLabel: '11h 59m elapsed • 0h 01m left',
    });

    expect(formatRemainingOrElapsed(checkIn12h05m, baseNowMs)).toMatchObject({
      isOverdue: true,
      elapsedLabel: '12h 05m',
      remainingLabel: 'Overdue (12h+)',
      summaryLabel: '12h 05m elapsed • Auto-exit due',
    });

    expect(formatRemainingOrElapsed(null, baseNowMs).summaryLabel).toBe('No check-in timestamp');
    expect(formatRemainingOrElapsed('not-a-date', baseNowMs).summaryLabel).toBe(
      'Invalid check-in timestamp'
    );
  });
});

describe('VisitorsRegistryClient', () => {
  const mockUseRouter = useRouter as jest.Mock;
  const mockRegisterVisitor = registerVisitor as jest.Mock;
  const mockAutoExit = autoExitOverdueVisitors as jest.Mock;
  const mockManualCheckOut = manualCheckOutVisitor as jest.Mock;
  const mockToastWarning = toast.warning as jest.Mock;
  const mockToastSuccess = toast.success as jest.Mock;
  const mockToastError = toast.error as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseRouter.mockReturnValue({ refresh: mockRefresh });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders prominent role=alert banner and fires toast.warning when initialAutoExited has records', () => {
    const visitors: VisitorRegistryRow[] = [
      {
        id: 'v-1',
        first_name: 'Alex',
        surname: 'Smith',
        company: 'GeoTech',
        reason_for_entry: 'Audit',
        check_in_time: '2026-11-20T04:00:00.000Z',
        check_out_time: '2026-11-20T16:15:00.000Z',
        status: 'Auto-Exited (12h)',
      },
    ];

    render(
      <VisitorsRegistryClient
        visitors={visitors}
        initialAutoExited={[
          {
            id: 'v-1',
            name: 'Alex Smith',
            company: 'GeoTech',
            checkInTime: '2026-11-20T04:00:00.000Z',
            exitedAt: '2026-11-20T16:15:00.000Z',
          },
        ]}
        page={1}
        totalPages={1}
        totalCount={1}
        pageSize={50}
        deptId="dept-ac-1"
      />
    );

    const alertBanner = screen.getByRole('alert');
    expect(alertBanner).toBeInTheDocument();
    expect(alertBanner).toHaveTextContent('12-Hour Limit Reached — 1 Visitor(s) Auto-Exited');
    expect(alertBanner).toHaveTextContent('Alex Smith');
    expect(alertBanner).toHaveTextContent('GeoTech');
    expect(mockToastWarning).toHaveBeenCalledWith('12-Hour Auto-Exit Triggered', {
      description: '1 visitor(s) exceeded the 12-hour limit and were auto-exited: Alex Smith',
    });

    fireEvent.click(screen.getByRole('button', { name: /Dismiss auto-exit notification/i }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('checks out active visitor manually and refreshes router', async () => {
    const recentCheckIn = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    mockManualCheckOut.mockResolvedValue({
      success: true,
      visitorId: 'v-active',
      exitedAt: '2026-11-20T12:00:00.000Z',
    });

    render(
      <VisitorsRegistryClient
        visitors={[
          {
            id: 'v-active',
            first_name: 'Nomsa',
            surname: 'Khumalo',
            company: 'Mine Safety',
            reason_for_entry: 'Inspection',
            check_in_time: recentCheckIn,
            check_out_time: null,
            status: 'Checked In',
          },
        ]}
        initialAutoExited={[]}
        page={1}
        totalPages={1}
        totalCount={1}
        pageSize={50}
        deptId="dept-ac-1"
      />
    );

    expect(screen.getByText(/elapsed/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Check Out/i }));

    await waitFor(() => {
      expect(mockManualCheckOut).toHaveBeenCalledWith('v-active');
    });
    expect(mockToastSuccess).toHaveBeenCalledWith('Nomsa Khumalo checked out', {
      description: 'Visitor status updated and temporary badge deactivated.',
    });
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it('shows error toast if manualCheckOutVisitor fails', async () => {
    const recentCheckIn = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    mockManualCheckOut.mockRejectedValue(new Error('Role forbidden'));

    render(
      <VisitorsRegistryClient
        visitors={[
          {
            id: 'v-active',
            first_name: 'Sam',
            surname: 'Zulu',
            company: 'Contractors',
            reason_for_entry: 'Delivery',
            check_in_time: recentCheckIn,
            check_out_time: null,
            status: 'Checked In',
          },
        ]}
        initialAutoExited={[]}
        page={1}
        totalPages={1}
        totalCount={1}
        pageSize={50}
        deptId="dept-ac-1"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Check Out/i }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Check-out failed', {
        description: 'Role forbidden',
      });
    });
  });

  it('triggers autoExitOverdueVisitors and shows alert + toast when 60s timer detects a visitor crossing 12 hours', async () => {
    jest.useFakeTimers();
    const startNow = new Date('2026-11-20T18:00:00.000Z');
    jest.setSystemTime(startNow);

    // Checked in 11h 59m 30s ago -> crosses 12h after 60s tick!
    const almostOverdueCheckIn = new Date(
      startNow.getTime() - (11 * 60 * 60 * 1000 + 59 * 60 * 1000 + 30 * 1000)
    ).toISOString();

    mockAutoExit.mockResolvedValue({
      autoExited: [
        {
          id: 'v-crossing',
          name: 'Pieter Botha',
          company: 'PumpCorp',
          checkInTime: almostOverdueCheckIn,
          exitedAt: '2026-11-20T18:01:00.000Z',
        },
      ],
    });

    render(
      <VisitorsRegistryClient
        visitors={[
          {
            id: 'v-crossing',
            first_name: 'Pieter',
            surname: 'Botha',
            company: 'PumpCorp',
            reason_for_entry: 'Pump Repair',
            check_in_time: almostOverdueCheckIn,
            check_out_time: null,
            status: 'Checked In',
          },
        ]}
        initialAutoExited={[]}
        page={1}
        totalPages={1}
        totalCount={1}
        pageSize={50}
        deptId="dept-ac-1"
      />
    );

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Enforce 12h Auto-Exit/i }));

    await waitFor(() => {
      expect(mockAutoExit).toHaveBeenCalledWith('dept-ac-1');
    });
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Pieter Botha');
    });
    expect(mockToastWarning).toHaveBeenCalledWith('12-Hour Auto-Exit Triggered', {
      description: '1 visitor(s) exceeded the 12-hour limit and were auto-exited: Pieter Botha',
    });
    expect(mockRefresh).toHaveBeenCalled();
  });

  it('renders empty state when visitors list is empty', () => {
    render(
      <VisitorsRegistryClient
        visitors={[]}
        initialAutoExited={[]}
        page={1}
        totalPages={0}
        totalCount={0}
        pageSize={50}
        deptId="dept-ac-1"
      />
    );

    expect(screen.getByText('No visitors registered')).toBeInTheDocument();
    expect(screen.getByText(/automatically checked out after 12 hours/i)).toBeInTheDocument();
  });

  it('submits VisitorForm registration and calls router.refresh on success and toast.error on failure', async () => {
    mockRegisterVisitor.mockResolvedValueOnce({ success: true, qrCode: 'TEMP-ABC123' });

    render(
      <VisitorsRegistryClient
        visitors={[]}
        initialAutoExited={[]}
        page={1}
        totalPages={0}
        totalCount={0}
        pageSize={50}
        deptId="dept-ac-1"
      />
    );

    fireEvent.change(screen.getByLabelText(/First Name/i), { target: { value: 'Thandi' } });
    fireEvent.change(screen.getByLabelText(/Surname/i), { target: { value: 'Moyo' } });
    const form = screen.getByRole('button', { name: /Register & Issue Badge/i }).closest('form');
    expect(form).not.toBeNull();
    await act(async () => {
      fireEvent.submit(form as HTMLFormElement);
    });

    await waitFor(() => {
      expect(mockRegisterVisitor).toHaveBeenCalledTimes(1);
      expect(mockToastSuccess).toHaveBeenCalledWith('Visitor registered successfully', {
        description: 'Thandi Moyo has been checked in. Badge: TEMP-ABC123',
      });
      expect(mockRefresh).toHaveBeenCalled();
    });

    mockRegisterVisitor.mockRejectedValueOnce(new Error('Validation failed'));
    await act(async () => {
      fireEvent.submit(form as HTMLFormElement);
    });

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('An error occurred', {
        description: 'Validation failed',
      });
    });
  });
});
