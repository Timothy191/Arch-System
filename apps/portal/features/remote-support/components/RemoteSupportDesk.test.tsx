import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RemoteSupportDesk } from './RemoteSupportDesk';

const mockClaimRemoteSupportSession = jest.fn();
const mockInitiateTier2ConsentSession = jest.fn();

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('../actions', () => ({
  claimRemoteSupportSession: (...args: unknown[]) => mockClaimRemoteSupportSession(...args),
  initiateTier2ConsentSession: (...args: unknown[]) => mockInitiateTier2ConsentSession(...args),
  endRemoteSupportSession: jest.fn().mockResolvedValue({ success: true }),
  upsertRemoteSupportDevice: jest.fn().mockResolvedValue({ success: true, device: {} }),
  deactivateRemoteSupportDevice: jest.fn().mockResolvedValue({ success: true }),
}));

jest.mock('../hooks/useWebRtcPeer', () => ({
  useWebRtcPeer: () => ({
    peerState: { phase: 'idle' },
    signalingStatus: 'IDLE',
    remoteStream: null,
    localStream: null,
    telemetry: {
      rttMs: null,
      fps: null,
      width: null,
      height: null,
      candidateType: null,
      relayAvailable: false,
    },
    startScreenShare: jest.fn(),
    sendDataMessage: jest.fn().mockReturnValue(true),
    disconnect: jest.fn().mockResolvedValue(undefined),
  }),
}));

jest.mock('@repo/supabase/client', () => ({
  createBrowserSupabaseClient: () => ({
    channel: jest.fn().mockReturnValue({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn().mockReturnThis(),
    }),
    removeChannel: jest.fn().mockResolvedValue(undefined),
  }),
}));

describe('RemoteSupportDesk', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('claims a 6-digit support code and switches between Live Desk, Managed Workstations, and Audit History', async () => {
    mockClaimRemoteSupportSession.mockResolvedValue({
      success: true,
      session: {
        id: 'sess-1',
        session_code: '482917',
        tier: 'tier1_browser',
        status: 'consent_requested',
        requester_employee_id: 'emp-1',
        agent_employee_id: 'emp-sup',
        device_id: null,
        department_slug: 'control-room',
        issue_summary: 'Shift chart blank',
        cobrowse_enabled: false,
        consent_granted_at: null,
        started_at: null,
        ended_at: null,
        end_reason: null,
        resolution_notes: null,
        client_diagnostics: {},
        expires_at: new Date(Date.now() + 600_000).toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    });

    render(
      <RemoteSupportDesk
        agentEmployeeId="emp-sup"
        agentName="Jane Supervisor"
        userRole="admin"
        initialSessions={[]}
        initialDevices={[
          {
            id: 'dev-1',
            hostname: 'CR-OP-01',
            display_name: 'Control Room Desk 1',
            site_id: null,
            department_id: null,
            assigned_employee_id: 'emp-1',
            device_class: 'workstation',
            protocol: 'rdp',
            network_host: '10.20.4.18',
            network_port: 3389,
            protocol_options: {},
            require_user_consent: true,
            is_active: true,
            last_connected_at: null,
            created_by: 'emp-sup',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ]}
        initialAuditEvents={[]}
        schemaReady
      />
    );

    const codeInput = screen.getByLabelText('Enter 6-digit support code');
    fireEvent.change(codeInput, { target: { value: '482917' } });
    fireEvent.click(screen.getByRole('button', { name: /Claim Session/i }));

    await waitFor(() => {
      expect(mockClaimRemoteSupportSession).toHaveBeenCalledWith({ sessionCode: '482917' });
    });

    fireEvent.click(screen.getByRole('button', { name: /Managed Workstations/i }));
    expect(screen.getByText(/Control Room Desk 1/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Audit History/i }));
    expect(screen.getByText(/Immutable Remote Support Audit Trail/i)).toBeInTheDocument();
  });
});
