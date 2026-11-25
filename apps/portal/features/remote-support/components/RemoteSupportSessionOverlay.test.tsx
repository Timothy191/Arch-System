import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useRemoteSupportStore } from '../hooks/useRemoteSupportStore';
import { RemoteSupportSessionOverlay } from './RemoteSupportSessionOverlay';

const mockRespondToRemoteSupportConsent = jest.fn().mockResolvedValue({ success: true });
const mockEndRemoteSupportSession = jest.fn().mockResolvedValue({ success: true });
const mockUpdateCobrowseConsent = jest.fn().mockResolvedValue({ success: true });
const mockStartScreenShare = jest.fn().mockResolvedValue(undefined);
const mockDisconnect = jest.fn().mockResolvedValue(undefined);
const mockSendDataMessage = jest.fn().mockReturnValue(true);

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    info: jest.fn(),
    warning: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('../actions', () => ({
  respondToRemoteSupportConsent: (...args: unknown[]) => mockRespondToRemoteSupportConsent(...args),
  endRemoteSupportSession: (...args: unknown[]) => mockEndRemoteSupportSession(...args),
  updateCobrowseConsent: (...args: unknown[]) => mockUpdateCobrowseConsent(...args),
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
    startScreenShare: mockStartScreenShare,
    sendDataMessage: mockSendDataMessage,
    disconnect: mockDisconnect,
  }),
}));

jest.mock('@repo/supabase/client', () => ({
  createBrowserSupabaseClient: () => ({
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: null } }),
    },
    channel: jest.fn(),
    removeChannel: jest.fn().mockResolvedValue(undefined),
  }),
}));

describe('RemoteSupportSessionOverlay', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useRemoteSupportStore.getState().clearActiveSession();
  });

  it('renders nothing when no session is active', () => {
    const { container } = render(<RemoteSupportSessionOverlay />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the 6-digit support code card when session is pending', () => {
    useRemoteSupportStore.getState().setActiveSession({
      sessionId: 'sess-1',
      sessionCode: '482917',
      tier: 'tier1_browser',
      status: 'pending',
      issueSummary: 'Need help',
      agentName: null,
      agentRole: null,
      deviceName: null,
      cobrowseEnabled: false,
      cobrowsePendingRequest: false,
      expiresAt: new Date(Date.now() + 600_000).toISOString(),
    });

    render(<RemoteSupportSessionOverlay />);
    expect(screen.getByText('482917')).toBeInTheDocument();
  });

  it('renders explicit Consent Modal and starts screen share upon approval', async () => {
    useRemoteSupportStore.getState().setActiveSession({
      sessionId: 'sess-1',
      sessionCode: '482917',
      tier: 'tier1_browser',
      status: 'consent_requested',
      issueSummary: 'Need help',
      agentName: 'Jane Supervisor',
      agentRole: 'supervisor',
      deviceName: null,
      cobrowseEnabled: false,
      cobrowsePendingRequest: false,
      expiresAt: new Date(Date.now() + 600_000).toISOString(),
    });

    render(<RemoteSupportSessionOverlay />);
    expect(screen.getByRole('dialog', { name: /Remote Support Consent/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Approve Screen Share/i }));

    await waitFor(() => {
      expect(mockStartScreenShare).toHaveBeenCalledTimes(1);
      expect(mockRespondToRemoteSupportConsent).toHaveBeenCalledWith({
        sessionId: 'sess-1',
        approved: true,
      });
    });
  });

  it('immediately terminates session on Shift+Esc kill switch', async () => {
    useRemoteSupportStore.getState().setActiveSession({
      sessionId: 'sess-1',
      sessionCode: '482917',
      tier: 'tier1_browser',
      status: 'active',
      issueSummary: 'Need help',
      agentName: 'Jane Supervisor',
      agentRole: 'supervisor',
      deviceName: null,
      cobrowseEnabled: false,
      cobrowsePendingRequest: false,
      expiresAt: new Date(Date.now() + 600_000).toISOString(),
    });

    render(<RemoteSupportSessionOverlay />);
    expect(screen.getByText('Screen Shared')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape', shiftKey: true });

    await waitFor(() => {
      expect(mockDisconnect).toHaveBeenCalledWith('Shift+Esc kill switch');
      expect(mockEndRemoteSupportSession).toHaveBeenCalledWith(
        expect.objectContaining({ sessionId: 'sess-1', isRevoked: true })
      );
      expect(useRemoteSupportStore.getState().activeSession).toBeNull();
    });
  });
});
