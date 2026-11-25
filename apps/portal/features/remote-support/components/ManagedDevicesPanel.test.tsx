import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ManagedDevicesPanel } from './ManagedDevicesPanel';

const mockUpsertRemoteSupportDevice = jest.fn();
const mockDeactivateRemoteSupportDevice = jest.fn();

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), info: jest.fn(), error: jest.fn() },
}));

jest.mock('../actions', () => ({
  upsertRemoteSupportDevice: (...args: unknown[]) => mockUpsertRemoteSupportDevice(...args),
  deactivateRemoteSupportDevice: (...args: unknown[]) => mockDeactivateRemoteSupportDevice(...args),
}));

const INITIAL_DEVICES = [
  {
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
  },
];

describe('ManagedDevicesPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows admin to add, search, connect, and deactivate a managed workstation', async () => {
    const onDevicesChanged = jest.fn();
    const onConnectDevice = jest.fn();

    mockUpsertRemoteSupportDevice.mockResolvedValue({
      success: true,
      device: {
        ...INITIAL_DEVICES[0],
        id: 'dev-2',
        hostname: 'LAB-PC-02',
        display_name: 'Lab PC 2',
      },
    });
    mockDeactivateRemoteSupportDevice.mockResolvedValue({ success: true });

    render(
      <ManagedDevicesPanel
        devices={INITIAL_DEVICES}
        userRole="admin"
        onDevicesChanged={onDevicesChanged}
        onConnectDevice={onConnectDevice}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Connect/i }));
    expect(onConnectDevice).toHaveBeenCalledWith(INITIAL_DEVICES[0]);

    fireEvent.click(screen.getByRole('button', { name: /Add Workstation/i }));
    fireEvent.change(screen.getByPlaceholderText(/Hostname/i), {
      target: { value: 'LAB-PC-02' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Display Name/i), {
      target: { value: 'Lab PC 2' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Internal Host/i), {
      target: { value: '10.20.8.42' },
    });

    fireEvent.click(screen.getByRole('button', { name: /^Save$/i }));

    await waitFor(() => {
      expect(mockUpsertRemoteSupportDevice).toHaveBeenCalledWith(
        expect.objectContaining({
          hostname: 'LAB-PC-02',
          networkHost: '10.20.8.42',
          networkPort: 3389,
        })
      );
      expect(onDevicesChanged).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole('button', { name: /Deactivate CR-OP-01/i }));
    await waitFor(() => {
      expect(mockDeactivateRemoteSupportDevice).toHaveBeenCalledWith({ deviceId: 'dev-1' });
    });
  });
});
