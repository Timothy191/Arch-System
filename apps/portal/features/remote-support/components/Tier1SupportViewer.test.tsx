import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Tier1SupportViewer } from './Tier1SupportViewer';

const mockEndRemoteSupportSession = jest.fn().mockResolvedValue({ success: true });
const mockSendDataMessage = jest.fn().mockReturnValue(true);
const mockDisconnect = jest.fn().mockResolvedValue(undefined);

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), info: jest.fn(), error: jest.fn() },
}));

jest.mock('../actions', () => ({
  endRemoteSupportSession: (...args: unknown[]) => mockEndRemoteSupportSession(...args),
}));

jest.mock('../hooks/useWebRtcPeer', () => ({
  useWebRtcPeer: () => ({
    peerState: { phase: 'connected' },
    signalingStatus: 'SUBSCRIBED',
    remoteStream: null,
    localStream: null,
    telemetry: {
      rttMs: 18,
      fps: 15,
      width: 1920,
      height: 1080,
      candidateType: 'host',
      relayAvailable: true,
    },
    startScreenShare: jest.fn(),
    sendDataMessage: mockSendDataMessage,
    disconnect: mockDisconnect,
  }),
}));

const SESSION = {
  id: 'sess-1',
  session_code: '482917',
  tier: 'tier1_browser' as const,
  status: 'active' as const,
  requester_employee_id: 'emp-1',
  agent_employee_id: 'emp-sup',
  device_id: null,
  department_slug: 'control-room',
  issue_summary: 'Shift chart freeze',
  cobrowse_enabled: false,
  consent_granted_at: '2026-11-25T08:00:00Z',
  started_at: '2026-11-25T08:00:00Z',
  ended_at: null,
  end_reason: null,
  resolution_notes: null,
  client_diagnostics: { route: '/control-room' },
  expires_at: '2026-11-25T08:10:00Z',
  created_at: '2026-11-25T07:59:00Z',
  updated_at: '2026-11-25T08:00:00Z',
};

describe('Tier1SupportViewer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('supports annotations, co-browse request, diagnostics/chat drawer, and closing with resolution notes', async () => {
    const onSessionClosed = jest.fn();
    const onEscalateTier2 = jest.fn();

    render(
      <Tier1SupportViewer
        session={SESSION}
        agentEmployeeId="emp-sup"
        agentName="Jane Supervisor"
        managedDevices={[]}
        onSessionClosed={onSessionClosed}
        onEscalateTier2={onEscalateTier2}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Request Co-Browse/i }));
    expect(mockSendDataMessage).toHaveBeenCalledWith({
      type: 'cobrowse_request',
      agentName: 'Jane Supervisor',
    });

    fireEvent.click(screen.getByRole('button', { name: /Clear/i }));
    expect(mockSendDataMessage).toHaveBeenCalledWith({ type: 'annotation_clear' });

    fireEvent.click(screen.getByRole('button', { name: /Diagnostics/i }));
    expect(screen.getByText(/Client Diagnostics/i)).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/Send message to user/i), {
      target: { value: 'Checking your shift tab now' },
    });
    fireEvent.submit(screen.getByPlaceholderText(/Send message to user/i).closest('form')!);
    expect(mockSendDataMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'chat_message', text: 'Checking your shift tab now' })
    );

    fireEvent.click(screen.getByRole('button', { name: /^End$/i }));
    fireEvent.change(screen.getByLabelText(/Resolution Notes/i), {
      target: { value: 'Cleared stale cache' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Confirm Close Session/i }));

    await waitFor(() => {
      expect(mockDisconnect).toHaveBeenCalled();
      expect(mockEndRemoteSupportSession).toHaveBeenCalledWith(
        expect.objectContaining({ sessionId: 'sess-1', resolutionNotes: 'Cleared stale cache' })
      );
      expect(onSessionClosed).toHaveBeenCalled();
    });
  });
});
