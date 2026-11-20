/* cspell:ignore Tyre */

import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'sonner';
import { logTireActivity } from './actions';
import TireManagementPage from './page';
import { TireActivityManagerClient } from './TireActivityManagerClient';

const mockRefresh = jest.fn();

jest.mock('next/server', () => ({
  connection: jest.fn(async () => undefined),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: mockRefresh,
    push: jest.fn(),
  }),
}));

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('./actions', () => ({
  logTireActivity: jest.fn(async () => ({
    success: true,
    mode: 'replace',
    removedTireId: 't1',
    installedTireId: 't-new-1',
    inspectedTireId: null,
    machineName: 'DT-01',
  })),
}));

jest.mock('~/lib/dept-context', () => ({
  requireDepartment: jest.fn(),
  getDepartmentContext: jest.fn().mockResolvedValue({
    today: '2026-11-20',
    supabase: {
      from: jest.fn((table: string) => {
        if (table === 'tires') {
          return {
            select: jest.fn().mockReturnThis(),
            order: jest.fn().mockResolvedValue({
              data: [
                {
                  id: 't1',
                  serial_number: 'TIRE-001',
                  brand: 'Michelin',
                  size: '59/80R63',
                  position: 'Front Left',
                  status: 'installed',
                  machine_id: 'm1',
                  installed_at: '2026-01-01',
                  installed_hours: 1200,
                  machines: { id: 'm1', name: 'DT-01', serial_number: 'SN-01' },
                },
                {
                  id: 't2',
                  serial_number: 'TIRE-002',
                  brand: 'Bridgestone',
                  size: '59/80R63',
                  position: 'Front Right',
                  status: 'installed',
                  machine_id: 'm1',
                  installed_at: '2026-01-01',
                  installed_hours: 1500,
                  machines: { id: 'm1', name: 'DT-01', serial_number: 'SN-01' },
                },
                {
                  id: 't3',
                  serial_number: 'TIRE-003',
                  brand: 'Goodyear',
                  size: '59/80R63',
                  position: 'Spare',
                  status: 'inventory',
                  machine_id: null,
                  installed_at: null,
                  installed_hours: 0,
                  machines: null,
                },
              ],
            }),
          };
        }
        if (table === 'tire_inspections') {
          return {
            select: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            limit: jest.fn().mockResolvedValue({
              data: [
                {
                  id: 'i1',
                  tire_id: 't1',
                  inspection_date: '2026-03-01',
                  tread_depth_mm: 12,
                  pressure_psi: 105,
                  condition_status: 'critical',
                  current_smu: 1200,
                  notes: '[REMOVAL] Machine: DT-01 | Position: Front Left | Low tread depth',
                },
                {
                  id: 'i2',
                  tire_id: 't2',
                  inspection_date: '2026-03-01',
                  tread_depth_mm: 35,
                  pressure_psi: 110,
                  condition_status: 'good',
                  current_smu: 1500,
                  notes: '[REPLACEMENT] Machine: DT-01 | Position: Front Right | Fresh mount',
                },
              ],
            }),
          };
        }
        if (table === 'machines') {
          return {
            select: jest.fn().mockReturnThis(),
            order: jest.fn().mockResolvedValue({
              data: [
                {
                  id: 'm1',
                  name: 'DT-01',
                  machine_type: 'Dump Truck',
                  serial_number: 'SN-01',
                  active: true,
                },
              ],
            }),
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({ data: [] }),
        };
      }),
    },
  }),
}));

describe('TireManagementPage & TireActivityManagerClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders tire management page with single-pass metric aggregations and activity ledger', async () => {
    const jsx = await TireManagementPage({
      params: Promise.resolve({ department: 'engineering' }),
    });
    render(jsx);

    expect(screen.getByText('Tire Management')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument(); // Total tires
    expect(screen.getByText('2')).toBeInTheDocument(); // Installed active
    expect(screen.getAllByText('1').length).toBeGreaterThan(0); // Inventory / Spares and Critical alerts

    expect(screen.getAllByText('TIRE-001').length).toBeGreaterThan(0);
    expect(screen.getAllByText('TIRE-002').length).toBeGreaterThan(0);
    expect(screen.getAllByText('TIRE-003').length).toBeGreaterThan(0);
    expect(
      screen.getByText('Recent Tyre Activity & Removal/Replacement Ledger')
    ).toBeInTheDocument();
    expect(screen.getByTestId('open-tire-activity-btn')).toBeInTheDocument();
  });

  it('opens activity logger, switches modes, and submits a tire replacement per machine', async () => {
    render(
      <TireActivityManagerClient
        todayStr="2026-11-20"
        machines={[
          { id: 'm1', name: 'DT-01', machine_type: 'Dump Truck', serial_number: 'SN-01' },
          { id: 'm2', name: 'DT-02', machine_type: 'Dump Truck', serial_number: 'SN-02' },
        ]}
        tires={[
          {
            id: 't1',
            serial_number: 'TIRE-001',
            brand: 'Michelin',
            size: '59/80R63',
            position: 'Front Left',
            status: 'installed',
            machine_id: 'm1',
            machineName: 'DT-01',
            installed_at: '2026-01-01',
            installed_hours: 1200,
          },
          {
            id: 't3',
            serial_number: 'TIRE-003',
            brand: 'Goodyear',
            size: '59/80R63',
            position: 'Spare',
            status: 'inventory',
            machine_id: null,
            machineName: 'Unassigned',
            installed_at: null,
            installed_hours: 0,
          },
        ]}
        recentActivities={[
          {
            id: 'a1',
            tire_id: 't1',
            serial_number: 'TIRE-001',
            brand: 'Michelin',
            size: '59/80R63',
            machineName: 'DT-01',
            position: 'Front Left',
            inspection_date: '2026-11-19',
            tread_depth_mm: 11,
            pressure_psi: 104,
            condition_status: 'critical',
            current_smu: 1200,
            notes: '[REMOVAL] Machine: DT-01 | Sidewall wear',
            activityType: 'removal',
          },
        ]}
      />
    );

    fireEvent.click(screen.getByTestId('open-tire-activity-btn'));
    expect(screen.getByTestId('tire-activity-panel')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Machine'), { target: { value: 'm1' } });
    fireEvent.change(screen.getByLabelText('Wheel Position'), { target: { value: 'Front Left' } });
    fireEvent.change(screen.getByLabelText('Installed Tyre'), { target: { value: 't1' } });
    fireEvent.change(screen.getByLabelText('New Tyre Serial Number'), {
      target: { value: 'TIRE-900' },
    });
    fireEvent.change(screen.getByLabelText('Brand'), { target: { value: 'Bridgestone' } });
    fireEvent.change(screen.getByLabelText('Tyre Size'), { target: { value: '59/80R63' } });
    fireEvent.change(screen.getByLabelText('Tread Depth (mm)'), { target: { value: '12' } });

    expect(screen.getByLabelText('Condition Status')).toHaveValue('critical');

    fireEvent.click(screen.getByTestId('submit-tire-activity-btn'));

    await waitFor(() => {
      expect(logTireActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'replace',
          machineId: 'm1',
          position: 'Front Left',
          removedTireId: 't1',
          replacementSerial: 'TIRE-900',
          replacementBrand: 'Bridgestone',
          replacementSize: '59/80R63',
          conditionStatus: 'critical',
        })
      );
    });

    expect(toast.success).toHaveBeenCalled();
    expect(mockRefresh).toHaveBeenCalled();
  });

  it('filters ledger entries by activity type and search text and handles error feedback', async () => {
    (logTireActivity as jest.Mock).mockRejectedValueOnce(new Error('Database failure'));

    render(
      <TireActivityManagerClient
        todayStr="2026-11-20"
        machines={[{ id: 'm1', name: 'DT-01', machine_type: 'Dump Truck', serial_number: 'SN-01' }]}
        tires={[
          {
            id: 't1',
            serial_number: 'TIRE-001',
            brand: 'Michelin',
            size: '59/80R63',
            position: 'Front Left',
            status: 'installed',
            machine_id: 'm1',
            machineName: 'DT-01',
            installed_at: '2026-01-01',
            installed_hours: 1200,
          },
          {
            id: 't3',
            serial_number: 'TIRE-003',
            brand: 'Goodyear',
            size: '59/80R63',
            position: 'Spare',
            status: 'inventory',
            machine_id: null,
            machineName: 'Unassigned',
            installed_at: null,
            installed_hours: 0,
          },
        ]}
        recentActivities={[
          {
            id: 'a1',
            tire_id: 't1',
            serial_number: 'TIRE-001',
            brand: 'Michelin',
            size: '59/80R63',
            machineName: 'DT-01',
            position: 'Front Left',
            inspection_date: '2026-11-19',
            tread_depth_mm: 18,
            pressure_psi: 108,
            condition_status: 'warning',
            current_smu: 1200,
            notes: '[REMOVAL] Machine: DT-01',
            activityType: 'removal',
          },
          {
            id: 'a2',
            tire_id: 't3',
            serial_number: 'TIRE-003',
            brand: 'Goodyear',
            size: '59/80R63',
            machineName: 'DT-01',
            position: 'Front Right',
            inspection_date: '2026-11-20',
            tread_depth_mm: 40,
            pressure_psi: 112,
            condition_status: 'good',
            current_smu: 1210,
            notes: '[INSTALLATION] Machine: DT-01',
            activityType: 'installation',
          },
        ]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Removals' }));
    expect(screen.getByText('TIRE-001')).toBeInTheDocument();
    expect(screen.queryByText('TIRE-003')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    fireEvent.change(screen.getByLabelText('Search tyre ledger'), {
      target: { value: 'TIRE-003' },
    });
    expect(screen.getByText('TIRE-003')).toBeInTheDocument();

    // Open and switch to Install Spare / New mode, verify spare option and error alert
    fireEvent.click(screen.getByTestId('open-tire-activity-btn'));
    fireEvent.click(screen.getByRole('tab', { name: /Install Spare \/ New/i }));
    fireEvent.click(screen.getByRole('button', { name: /Use Inventory Spare/i }));
    expect(screen.getByLabelText('Inventory Spare Tyre')).toHaveValue('t3');

    fireEvent.click(screen.getByTestId('submit-tire-activity-btn'));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Database failure');
    });
    expect(toast.error).toHaveBeenCalledWith('Database failure');
  });
});
