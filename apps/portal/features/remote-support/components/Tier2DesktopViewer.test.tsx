import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Tier2DesktopViewer } from './Tier2DesktopViewer';

const mockEndRemoteSupportSession = jest.fn().mockResolvedValue({ success: true });
const mockConnect = jest.fn();
const mockDisconnect = jest.fn();
const mockSendKeyEvent = jest.fn();

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), info: jest.fn(), error: jest.fn() },
}));

jest.mock('../actions', () => ({
  endRemoteSupportSession: (...args: unknown[]) => mockEndRemoteSupportSession(...args),
}));

jest.mock('guacamole-common-js', () => ({
  __esModule: true,
  default: {
    WebSocketTunnel: jest.fn(),
    Client: jest.fn(() => ({
      connect: mockConnect,
      disconnect: mockDisconnect,
      sendKeyEvent: mockSendKeyEvent,
      sendMouseState: jest.fn(),
      createClipboardStream: jest.fn(() => ({ sendBlob: jest.fn(), sendEnd: jest.fn() })),
      getDisplay: () => ({
        getElement: () => document.createElement('div'),
        getWidth: () => 1280,
        getHeight: () => 720,
        scale: jest.fn(),
      }),
      set onstatechange(cb: (state: number) => void) {
        setTimeout(() => cb(3), 0);
      },
    })),
    Mouse: jest.fn(() => ({ onmousedown: null, onmouseup: null, onmousemove: null })),
    Keyboard: jest.fn(() => ({ onkeydown: null, onkeyup: null })),
    StringWriter: jest.fn(() => ({ sendText: jest.fn(), sendEnd: jest.fn() })),
  },
}));

const SESSION = {
  id: 'sess-t2',
  session_code: '998877',
  tier: 'tier2_os_desktop' as const,
  status: 'active' as const,
  requester_employee_id: 'emp-1',
  agent_employee_id: 'emp-admin',
  device_id: 'dev-1',
  department_slug: null,
  issue_summary: 'OS printer issue',
  cobrowse_enabled: false,
  consent_granted_at: '2026-11-25T08:00:00Z',
  started_at: '2026-11-25T08:00:00Z',
  ended_at: null,
  end_reason: null,
  resolution_notes: null,
  client_diagnostics: {},
  expires_at: '2026-11-25T08:10:00Z',
  created_at: '2026-11-25T07:59:00Z',
  updated_at: '2026-11-25T08:00:00Z',
};

const DEVICE = {
  id: 'dev-1',
  hostname: 'CR-OP-01',
  display_name: 'Control Room Desk 1',
  site_id: null,
  department_id: null,
  assigned_employee_id: 'emp-1',
  device_class: 'workstation' as const,
  protocol: 'rdp' as const,
  network_host: '10.20.4.18',
  network_port: 3389,
  protocol_options: {},
  require_user_consent: true,
  is_active: true,
  last_connected_at: null,
  created_by: 'emp-admin',
  created_at: '2026-11-25T07:00:00Z',
  updated_at: '2026-11-25T07:00:00Z',
};

describe('Tier2DesktopViewer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        gatewayWsUrl: 'wss://remote-gw.plantcor.local',
        token: 'iv.tag.cipher',
        expiresAt: '2026-11-25T08:01:00Z',
        protocol: 'rdp',
        hostname: 'CR-OP-01',
      }),
    }) as unknown as typeof fetch;
  });

  it('launches encrypted Guacamole tunnel, sends Ctrl+Alt+Del, and disconnects cleanly', async () => {
    const onSessionClosed = jest.fn();
    render(
      <Tier2DesktopViewer session={SESSION} device={DEVICE} onSessionClosed={onSessionClosed} />
    );

    fireEvent.click(screen.getByRole('button', { name: /Launch Tier 2 OS Desktop/i }));

    await waitFor(() => {
      expect(mockConnect).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Ctrl\+Alt\+Del/i })).not.toBeDisabled();
    });

    fireEvent.click(screen.getByRole('button', { name: /Ctrl\+Alt\+Del/i }));
    expect(mockSendKeyEvent).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Disconnect/i }));
    await waitFor(() => {
      expect(mockDisconnect).toHaveBeenCalled();
      expect(mockEndRemoteSupportSession).toHaveBeenCalled();
      expect(onSessionClosed).toHaveBeenCalled();
    });
  });
});
