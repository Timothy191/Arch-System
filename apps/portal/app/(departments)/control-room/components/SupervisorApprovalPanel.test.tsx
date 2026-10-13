import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'sonner';
import { ShiftReportSummary, SupervisorApprovalPanel } from './SupervisorApprovalPanel';

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('SupervisorApprovalPanel', () => {
  const supervisorId = '00000000-0000-0000-0000-000000000001';
  const submitterId = '00000000-0000-0000-0000-000000000002';
  const otherSupervisorId = '00000000-0000-0000-0000-000000000003';

  const sampleReports: ShiftReportSummary[] = [
    {
      id: 'report-1',
      reportDate: '2026-10-13',
      shiftType: 'day',
      operatorName: 'John Doe',
      status: 'submitted',
      submitterId,
      createdAt: '2026-10-13T06:00:00Z',
    },
    {
      id: 'report-2',
      reportDate: '2026-10-12',
      shiftType: 'night',
      operatorName: 'Jane Smith',
      status: 'submitted',
      submitterId: supervisorId, // current user is submitter
      createdAt: '2026-10-12T18:00:00Z',
    },
    {
      id: 'report-3',
      reportDate: '2026-10-11',
      shiftType: 'day',
      operatorName: 'Alice Brown',
      status: 'approved',
      submitterId: submitterId,
      approverId: otherSupervisorId,
      approvedAt: '2026-10-11T19:00:00Z',
      createdAt: '2026-10-11T06:00:00Z',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders pending reports and separation of duties status', () => {
    render(
      <SupervisorApprovalPanel
        reports={sampleReports}
        currentEmployeeId={supervisorId}
        currentRole="supervisor"
      />
    );

    expect(screen.getByText('Supervisor Shift Closeout Governance')).toBeInTheDocument();
    expect(screen.getByText(/Separation of Duties Active/i)).toBeInTheDocument();
    expect(screen.getByText(/Pending Approvals \(2\)/i)).toBeInTheDocument();
    expect(screen.getByText('2026-10-13 — DAY Shift')).toBeInTheDocument();
    expect(screen.getByText('2026-10-12 — NIGHT Shift')).toBeInTheDocument();
  });

  it('disables approve button and shows warning when current employee is the submitter', () => {
    render(
      <SupervisorApprovalPanel
        reports={sampleReports}
        currentEmployeeId={supervisorId}
        currentRole="supervisor"
      />
    );

    // Report 2 was submitted by supervisorId (current user)
    expect(screen.getByText(/Submitter lock: You submitted this report/i)).toBeInTheDocument();

    const buttons = screen.getAllByRole('button', { name: /Approve Closeout/i });
    // First button (report-1, submitterId !== supervisorId) should be enabled
    expect(buttons[0]).not.toBeDisabled();
    // Second button (report-2, submitterId === supervisorId) should be disabled
    expect(buttons[1]).toBeDisabled();
  });

  it('allows approval when current employee is not the submitter', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, result: { status: 'approved' } }),
    });

    render(
      <SupervisorApprovalPanel
        reports={sampleReports}
        currentEmployeeId={supervisorId}
        currentRole="supervisor"
      />
    );

    const approveButtons = screen.getAllByRole('button', { name: /Approve Closeout/i });
    fireEvent.click(approveButtons[0]);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/control-room/shift-closeout/approve',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ reportId: 'report-1' }),
        })
      );
      expect(toast.success).toHaveBeenCalledWith(
        'Shift closeout report successfully approved and locked.'
      );
    });
  });

  it('displays error toast when server returns separation of duties violation', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        success: false,
        code: 'SEPARATION_OF_DUTIES_VIOLATION',
        error: 'Separation of duties violation: Submitter cannot approve their own shift closeout',
      }),
    });

    render(
      <SupervisorApprovalPanel
        reports={sampleReports}
        currentEmployeeId={supervisorId}
        currentRole="supervisor"
      />
    );

    const approveButtons = screen.getAllByRole('button', { name: /Approve Closeout/i });
    fireEvent.click(approveButtons[0]);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'Separation of duties violation: Submitter cannot approve their own shift closeout'
      );
    });
  });
});
