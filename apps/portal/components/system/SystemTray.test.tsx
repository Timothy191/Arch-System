import { fireEvent, render, screen } from '@testing-library/react';
import {
  BatteryStatusRow,
  formatTimeSeconds,
  mapHealthResponseToState,
  NetworkStatusRow,
  NotificationRow,
  ServerHealthRow,
  SystemTrayPill,
  VolumeControlRow,
} from './SystemTray';
import { WifiNetworkPopover } from './SystemTrayRows';

jest.mock('@repo/utils/client', () => ({
  analytics: { track: jest.fn() },
  fetchClient: { post: jest.fn().mockResolvedValue({ ok: true }) },
}));

jest.mock('@/hooks/useFetchOfflineQueue', () => ({
  useFetchOfflineQueue: () => ({ pendingCount: 0 }),
}));

jest.mock('./system-tray-hooks', () => {
  const actual = jest.requireActual('./system-tray-hooks');
  return {
    ...actual,
    useServerHealth: () => ({
      status: 'healthy',
      db: 'ok',
      redis: 'ok',
      fuxa: 'ok',
      responseTime: 42,
      loading: false,
    }),
  };
});

describe('formatTimeSeconds', () => {
  it("returns 'Calculating…' for non-finite or non-positive values", () => {
    expect(formatTimeSeconds(0)).toBe('Calculating…');
    expect(formatTimeSeconds(-1)).toBe('Calculating…');
    expect(formatTimeSeconds(NaN)).toBe('Calculating…');
    expect(formatTimeSeconds(Infinity)).toBe('Calculating…');
  });

  it('formats minutes only when under an hour', () => {
    expect(formatTimeSeconds(90)).toBe('1m');
    expect(formatTimeSeconds(3599)).toBe('59m');
  });

  it('formats hours and minutes when an hour or more', () => {
    expect(formatTimeSeconds(3661)).toBe('1h 1m');
    expect(formatTimeSeconds(7200)).toBe('2h 0m');
  });
});

describe('NetworkStatusRow', () => {
  it('renders online wifi state', () => {
    render(
      <NetworkStatusRow
        online={true}
        effectiveType="4g"
        connType="wifi"
        downlink={50}
        rtt={20}
        supported={true}
      />
    );
    expect(screen.getByText('Connected')).toBeInTheDocument();
    expect(screen.getByText('wifi')).toBeInTheDocument();
    expect(screen.getByText('50.0 Mbps')).toBeInTheDocument();
    expect(screen.getByText('20 ms')).toBeInTheDocument();
  });

  it('renders offline state', () => {
    render(
      <NetworkStatusRow
        online={false}
        effectiveType={undefined}
        connType={undefined}
        downlink={undefined}
        rtt={undefined}
        supported={true}
      />
    );
    expect(screen.getByText('Offline')).toBeInTheDocument();
  });

  it('shows unsupported message', () => {
    render(
      <NetworkStatusRow
        online={true}
        effectiveType={undefined}
        connType={undefined}
        downlink={undefined}
        rtt={undefined}
        supported={false}
      />
    );
    expect(screen.getByText('Network API unavailable')).toBeInTheDocument();
  });
});

describe('BatteryStatusRow', () => {
  it('renders battery percentage and bar', () => {
    render(
      <BatteryStatusRow
        level={0.85}
        charging={false}
        chargingTime={Infinity}
        dischargingTime={3600}
        supported={true}
      />
    );
    expect(screen.getByText('85%')).toBeInTheDocument();
    expect(screen.getByText('On Battery')).toBeInTheDocument();
  });

  it('shows charging state', () => {
    render(
      <BatteryStatusRow
        level={0.45}
        charging={true}
        chargingTime={1800}
        dischargingTime={Infinity}
        supported={true}
      />
    );
    expect(screen.getByText('Charging')).toBeInTheDocument();
    expect(screen.getByText('30m to full')).toBeInTheDocument();
  });

  it('shows unsupported state', () => {
    render(
      <BatteryStatusRow
        level={null}
        charging={false}
        chargingTime={Infinity}
        dischargingTime={Infinity}
        supported={false}
      />
    );
    expect(screen.getByText('Battery status unavailable')).toBeInTheDocument();
  });
});

describe('VolumeControlRow', () => {
  it('renders volume and calls adjust on change', () => {
    const adjust = jest.fn();
    render(<VolumeControlRow volume={75} muted={false} toggleMute={jest.fn()} adjust={adjust} />);
    expect(screen.getByText('75%')).toBeInTheDocument();

    const slider = screen.getByLabelText('Volume');
    fireEvent.change(slider, { target: { value: '50' } });
    expect(adjust).toHaveBeenCalledWith(50);
  });

  it('renders muted state', () => {
    const toggleMute = jest.fn();
    render(<VolumeControlRow volume={0} muted={true} toggleMute={toggleMute} adjust={jest.fn()} />);
    expect(screen.getByText('Muted')).toBeInTheDocument();

    const muteButton = screen.getByLabelText('Unmute');
    fireEvent.click(muteButton);
    expect(toggleMute).toHaveBeenCalled();
  });
});

describe('NotificationRow', () => {
  it('renders notification count and clear button', () => {
    const clear = jest.fn();
    render(<NotificationRow count={3} clear={clear} />);
    expect(screen.getByText('3 notifications')).toBeInTheDocument();

    const clearButton = screen.getByLabelText('Clear notifications');
    fireEvent.click(clearButton);
    expect(clear).toHaveBeenCalled();
  });

  it('renders empty state', () => {
    render(<NotificationRow count={0} clear={jest.fn()} />);
    expect(screen.getByText('No notifications')).toBeInTheDocument();
  });
});

describe('ServerHealthRow', () => {
  it('renders healthy state with all subsystems OK', () => {
    render(
      <ServerHealthRow
        status="healthy"
        db="ok"
        redis="ok"
        fuxa="ok"
        responseTime={42}
        loading={false}
      />
    );
    expect(screen.getByText('Server Health')).toBeInTheDocument();
    expect(screen.getByText('Healthy')).toBeInTheDocument();
    expect(screen.getByText('42ms')).toBeInTheDocument();
  });

  it('renders degraded state and highlights unavailable subsystem', () => {
    render(
      <ServerHealthRow
        status="degraded"
        db="ok"
        redis="unavailable"
        fuxa="disabled"
        responseTime={120}
        loading={false}
      />
    );
    expect(screen.getByText('Degraded')).toBeInTheDocument();
    expect(screen.getByText('Redis')).toBeInTheDocument();
    expect(screen.getAllByText('Unavailable').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Disabled').length).toBeGreaterThanOrEqual(1);
  });

  it('renders error state and shows checking when loading', () => {
    render(
      <ServerHealthRow
        status="error"
        db="unavailable"
        redis="unavailable"
        fuxa="unavailable"
        responseTime={0}
        loading={true}
      />
    );
    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.getByText('Checking…')).toBeInTheDocument();
  });

  it('maps canonical /api/health response payload to healthy db, redis, and fuxa state', () => {
    const mapped = mapHealthResponseToState({
      status: 'healthy',
      timestamp: '2026-10-19T11:27:52.548Z',
      latencyMs: 430,
      services: {
        supabase: { status: 'healthy', latencyMs: 418 },
        redis: { status: 'healthy', latencyMs: 12 },
      },
    });
    expect(mapped.status).toBe('healthy');
    expect(mapped.db).toBe('ok');
    expect(mapped.redis).toBe('ok');
    expect(mapped.fuxa).toBe('ok');
    expect(mapped.responseTime).toBe(430);
    expect(mapped.timestamp).toBe('2026-10-19T11:27:52.548Z');
  });
});

describe('SystemTrayPill (Unified Control Room Taskbar)', () => {
  it('renders unified pill merging Return to Hub, Notifications, System Tray, and Support with gold separators', () => {
    render(<SystemTrayPill />);

    // 1. Return to Hub
    const homeBtn = screen.getByTestId('taskbar-home-button');
    expect(homeBtn).toBeInTheDocument();
    expect(homeBtn).toHaveAttribute('href', '/hub');
    expect(homeBtn).toHaveAttribute('aria-label', 'Return to Hub');

    // 2. Notifications
    const notifBtn = screen.getByTestId('taskbar-notifications-bell');
    expect(notifBtn).toBeInTheDocument();
    expect(notifBtn).toHaveAttribute('aria-label', 'Notifications');

    // 3. System Tray Popover
    const trayBtn = screen.getByRole('button', { name: /^System tray/ });
    expect(trayBtn).toBeInTheDocument();

    // 4. Support Button
    const supportBtn = screen.getByTitle('Feedback & Support');
    expect(supportBtn).toBeInTheDocument();
    expect(supportBtn).toHaveTextContent('Support');

    // 5. Gold Separators & canonical Metallic Gold icon setup
    expect(homeBtn).toHaveClass('text-accent-gold');
    expect(notifBtn).toHaveClass('text-accent-gold');
    const separators = screen.getAllByTestId('system-tray-gold-separator');
    expect(separators.length).toBeGreaterThanOrEqual(4);
    for (const sep of separators) {
      expect(sep).toHaveClass('text-accent-gold');
    }

    // 6. Dedicated Wi-Fi Menu Trigger
    const wifiBtn = screen.getByTestId('taskbar-wifi-trigger');
    expect(wifiBtn).toBeInTheDocument();
    expect(wifiBtn).toHaveAttribute('aria-label', 'Wi-Fi and Network Menu');
  });

  it('resolves in-codebase SCADA tag server as ok when FUXA_URL is unset and Redis is healthy', () => {
    const mapped = mapHealthResponseToState({
      status: 'degraded',
      latencyMs: 55,
      services: {
        supabase: { status: 'healthy', latencyMs: 40 },
        redis: { status: 'healthy', latencyMs: 12 },
        fuxa: { status: 'degraded', latencyMs: 0, error: 'FUXA_URL is not configured' },
      },
    });
    expect(mapped.status).toBe('healthy');
    expect(mapped.fuxa).toBe('ok');
    expect(mapped.fuxaMode).toBe('in-codebase');
  });

  it('renders Golden Gold styling on VolumeControlRow and network action buttons on NetworkStatusRow', () => {
    const { container } = render(
      <>
        <VolumeControlRow volume={75} muted={false} toggleMute={jest.fn()} adjust={jest.fn()} />
        <NetworkStatusRow
          online={true}
          effectiveType="4g"
          connType="wifi"
          downlink={6.8}
          rtt={250}
          supported={true}
        />
      </>
    );

    expect(screen.getByTestId('volume-control-row')).toHaveClass('border-accent-gold/30');
    expect(container.querySelector('input[type="range"]')).toHaveClass(
      'accent-[var(--accent-gold)]'
    );

    const tunnelBtn = screen.getByTestId('network-cf-tunnel-toggle');
    expect(tunnelBtn).toHaveTextContent('CF Tunnel');
    fireEvent.click(tunnelBtn);
    expect(tunnelBtn).toHaveTextContent('CF Tunnel On');

    expect(screen.getByTestId('network-speed-test-button')).toBeInTheDocument();
    expect(screen.getByTestId('network-troubleshoot-button')).toBeInTheDocument();
  });

  it('opens dedicated Wi-Fi menu and synchronizes Cloudflare Tunnel state with NetworkStatusRow', () => {
    window.localStorage.removeItem('arch-cf-tunnel-enabled');
    window.localStorage.removeItem('arch-wifi-profile');

    render(
      <WifiNetworkPopover
        network={{
          online: true,
          effectiveType: '4g',
          connType: 'wifi',
          downlink: 12.4,
          rtt: 45,
          supported: true,
        }}
      />
    );

    fireEvent.click(screen.getByTestId('taskbar-wifi-trigger'));
    expect(screen.getByTestId('taskbar-wifi-menu')).toBeInTheDocument();
    expect(screen.getByText('Cloudflare-ZeroTrust-Tunnel')).toBeInTheDocument();

    const connectButtons = screen.getAllByRole('button', { name: 'Connect' });
    fireEvent.click(connectButtons[0]!);
    expect(screen.getByTestId('network-cf-tunnel-toggle')).toHaveTextContent('CF Tunnel On');

    const remainingConnectButtons = screen.getAllByRole('button', { name: 'Connect' });
    fireEvent.click(remainingConnectButtons[0]!);
    expect(screen.getByTestId('network-cf-tunnel-toggle')).toHaveTextContent('CF Tunnel');
  });
});
