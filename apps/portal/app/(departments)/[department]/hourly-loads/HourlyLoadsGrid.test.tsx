import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type React from 'react';
import { saveHourlyLoad, splitMachineHourlyLoad } from './actions';
import { HourlyLoadsGrid } from './HourlyLoadsGrid';
import {
  buildActiveBreakdownByMachineMap,
  formatBreakdownReasonSubtitle,
} from './hourly-loads-utils';

type RealtimeCallback = (payload: {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: Record<string, unknown>;
  old: Record<string, unknown>;
}) => void;

const realtimeCallbacks: Record<string, RealtimeCallback> = {};

jest.mock('@repo/shared/hooks', () => ({
  useSupabaseRealtime: jest.fn((opts: { table: string; onChange?: RealtimeCallback }) => {
    if (opts.onChange) {
      realtimeCallbacks[opts.table] = opts.onChange;
    }
  }),
}));

jest.mock('@repo/supabase/client', () => ({
  getBrowserSupabaseClient: jest.fn(() => null),
}));

jest.mock('@/lib/observability/client-telemetry', () => ({
  trackClientMetric: jest.fn((_name: string, fn: () => Promise<unknown>) => fn()),
}));

jest.mock('@/lib/errors/error-logger', () => ({
  logError: jest.fn(),
}));

jest.mock('@repo/ui', () => ({
  AnimatedDialog: ({
    open,
    title,
    children,
  }: {
    open: boolean;
    title: string;
    children: React.ReactNode;
  }) =>
    open ? (
      <div role="dialog" aria-label={title}>
        <h2>{title}</h2>
        {children}
      </div>
    ) : null,
}));

jest.mock('@repo/ui/Logo', () => ({
  Logo: ({ className }: { className?: string }) => (
    <span data-testid="arch-logo" className={className} />
  ),
}));

jest.mock('@repo/ui/SecondaryButton', () => ({
  SecondaryButton: ({
    children,
    onClick,
    disabled,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button type="button" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

jest.mock('./actions', () => ({
  saveHourlyLoad: jest.fn().mockResolvedValue({
    success: true,
    load: {
      id: 'load-saved-1',
      machine_id: 'dt-02',
      shift_type: 'day',
      hour_01: 1,
      total_loads: 1,
    },
  }),
  splitMachineHourlyLoad: jest.fn().mockResolvedValue({ success: true, newLoad: null }),
}));

describe('HourlyLoadsGrid Engineering Breakdown Blocking', () => {
  const machines = [
    {
      id: 'dt-01',
      name: 'DT-01',
      machine_type: 'Dump Truck',
      serial_number: 'SN-DT01',
      bin_factor: 28,
      site_id: 'site-1',
    },
    {
      id: 'dt-02',
      name: 'DT-02',
      machine_type: 'Dump Truck',
      serial_number: 'SN-DT02',
      bin_factor: 28,
      site_id: 'site-1',
    },
  ];

  const excavators = [
    {
      id: 'ex-01',
      name: 'EX-01',
      machine_type: 'Excavator',
      site_id: 'site-1',
    },
  ];

  const sites = [{ id: 'site-1', name: 'Main Pit', site_code: 'PIT-01' }];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('matches active breakdowns by machine_id, fleet_id, and machine_name while ignoring completed records', () => {
    const matched = buildActiveBreakdownByMachineMap(machines, [
      {
        id: 'bd-completed',
        machine_id: 'dt-02',
        fleet_id: 'SN-DT02',
        status: 'completed',
        reason: 'Old fault',
      },
      {
        id: 'bd-active-sn',
        fleet_id: ' sn-dt01 ',
        status: 'active',
        reason: 'Transmission overheat [Shift Delay: 4.0h]',
      },
    ]);

    expect(matched.size).toBe(1);
    expect(matched.get('dt-01')?.id).toBe('bd-active-sn');
    expect(matched.has('dt-02')).toBe(false);
    expect(formatBreakdownReasonSubtitle('Transmission overheat [Shift Delay: 4.0h]')).toBe(
      'Transmission overheat'
    );
  });

  it('renders the whole breakdown machine row red, displays Breakdown booked by Engineering, and blocks all interaction', async () => {
    render(
      <HourlyLoadsGrid
        departmentId="dept-cr"
        machines={machines}
        excavators={excavators}
        hourlyLoads={[
          {
            id: 'load-1',
            machine_id: 'dt-01',
            shift_type: 'day',
            hour_01: 3,
            hour_02: 0,
            hour_03: 0,
            hour_04: 0,
            hour_05: 0,
            hour_06: 0,
            hour_07: 0,
            hour_08: 0,
            hour_09: 0,
            hour_10: 0,
            hour_11: 0,
            hour_12: 0,
            total_loads: 3,
            material_type: 'Waste',
            excavator_id: 'ex-01',
          },
        ]}
        sites={sites}
        activeBreakdowns={[
          {
            id: 'bd-1',
            fleet_id: 'SN-DT01',
            machine_id: 'dt-01',
            machine_name: 'DT-01',
            reason: 'Hydraulic hose rupture [Shift Delay: 6.0h]',
            status: 'active',
            date_in: '2026-11-20',
            time_in: '07:15:00',
          },
        ]}
        today="2026-11-20"
        initialShift="day"
      />
    );

    const blockedRow = screen.getByTestId('hourly-load-row-dt-01');
    expect(blockedRow).toHaveAttribute('data-breakdown-blocked', 'true');
    expect(blockedRow).toHaveAttribute('aria-disabled', 'true');
    expect(blockedRow.className).toContain('bg-red-50');
    expect(blockedRow.className).toContain('border-red-300');
    expect(blockedRow.className).toContain('text-red-900');
    expect(blockedRow.className).not.toContain(['dark', ''].join(':'));

    const note = screen.getByTestId('breakdown-note-dt-01');
    expect(note).toHaveTextContent('Breakdown booked by Engineering');
    expect(note).toHaveTextContent('Hydraulic hose rupture');

    // Excavator dropdown & every hour input / button in the broken-down row must be disabled
    const blockedSelect = within(blockedRow).getByLabelText('Assign excavator for DT-01');
    expect(blockedSelect).toBeDisabled();

    const blockedHourInputs = within(blockedRow).getAllByRole('textbox');
    expect(blockedHourInputs).toHaveLength(12);
    for (const input of blockedHourInputs) {
      expect(input).toBeDisabled();
      expect(input).toHaveAttribute('readonly');
    }

    const blockedUpBtn = within(blockedRow).getByRole('button', { name: 'Increase 06:00 loads' });
    const blockedDownBtn = within(blockedRow).getByRole('button', {
      name: 'Decrease 06:00 loads',
    });
    expect(blockedUpBtn).toBeDisabled();
    expect(blockedDownBtn).toBeDisabled();

    // Even forced synthetic DOM events on the broken-down row must never trigger saves
    fireEvent.click(blockedUpBtn);
    fireEvent.change(blockedSelect, { target: { value: '' } });
    fireEvent.change(blockedHourInputs[0]!, { target: { value: '9' } });
    fireEvent.blur(blockedHourInputs[0]!);
    expect(saveHourlyLoad).not.toHaveBeenCalled();

    // Healthy truck DT-02 in the same table remains fully interactive
    const healthyRow = screen.getByTestId('hourly-load-row-dt-02');
    expect(healthyRow).not.toHaveAttribute('data-breakdown-blocked');
    const healthyUpBtn = within(healthyRow).getByRole('button', { name: 'Increase 06:00 loads' });
    expect(healthyUpBtn).not.toBeDisabled();
    fireEvent.click(healthyUpBtn);

    await waitFor(() => {
      expect(saveHourlyLoad).toHaveBeenCalledWith(
        expect.objectContaining({
          machineId: 'dt-02',
          patch: expect.objectContaining({ hour_01: 1 }),
        })
      );
    });

    // Open Split Modal and confirm broken-down truck is marked and blocked
    fireEvent.click(screen.getByRole('button', { name: /Add Machine Split/i }));
    const splitTruckSelect = screen.getByLabelText('Select Haul Truck') as HTMLSelectElement;
    const blockedOption = within(splitTruckSelect).getByText(
      /DT-01 \(Dump Truck\) — Breakdown booked by Engineering/i
    ) as HTMLOptionElement;
    expect(blockedOption.disabled).toBe(true);
    expect(splitMachineHourlyLoad).not.toHaveBeenCalled();
  });

  it('supports healthy grid interactions: search, filter, shift switch, excavator assign, direct edit, and split submission', async () => {
    render(
      <HourlyLoadsGrid
        departmentId="dept-cr"
        machines={machines}
        excavators={excavators}
        hourlyLoads={[]}
        sites={sites}
        activeBreakdowns={[]}
        today="2026-11-20"
        initialShift="day"
      />
    );

    // Search & clear
    const searchInput = screen.getByLabelText('Search machine');
    fireEvent.change(searchInput, { target: { value: 'DT-02' } });
    expect(screen.queryByTestId('hourly-load-row-dt-01')).not.toBeInTheDocument();
    expect(screen.getByTestId('hourly-load-row-dt-02')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Clear machine search'));
    expect(screen.getByTestId('hourly-load-row-dt-01')).toBeInTheDocument();

    // Assign excavator on DT-01
    const dt01Select = screen.getByLabelText('Assign excavator for DT-01');
    fireEvent.change(dt01Select, { target: { value: 'ex-01' } });
    await waitFor(() => {
      expect(saveHourlyLoad).toHaveBeenCalledWith(
        expect.objectContaining({
          machineId: 'dt-01',
          patch: expect.objectContaining({ excavator_id: 'ex-01' }),
        })
      );
    });

    // Excavator filter
    const excFilter = screen.getByLabelText('Filter by assigned excavator');
    fireEvent.change(excFilter, { target: { value: '__unassigned__' } });
    expect(screen.queryByTestId('hourly-load-row-dt-01')).not.toBeInTheDocument();
    expect(screen.getByTestId('hourly-load-row-dt-02')).toBeInTheDocument();
    fireEvent.change(excFilter, { target: { value: '' } });

    // Direct number edit on DT-02 hour_01
    const dt02Row = screen.getByTestId('hourly-load-row-dt-02');
    const dt02Inputs = within(dt02Row).getAllByRole('textbox');
    fireEvent.change(dt02Inputs[0]!, { target: { value: '7' } });
    fireEvent.blur(dt02Inputs[0]!);
    await waitFor(() => {
      expect(saveHourlyLoad).toHaveBeenCalledWith(
        expect.objectContaining({
          machineId: 'dt-02',
          patch: expect.objectContaining({ hour_01: 7 }),
        })
      );
    });

    // Shift switch to Night
    fireEvent.click(screen.getByRole('button', { name: /Night \(18:00 - 05:59\)/i }));
    expect(screen.getByRole('columnheader', { name: '18:00' })).toBeInTheDocument();

    // Create split on healthy machine
    fireEvent.click(screen.getByRole('button', { name: /Add Machine Split/i }));
    fireEvent.click(screen.getByRole('button', { name: /Confirm & Add Split/i }));
    await waitFor(() => {
      expect(splitMachineHourlyLoad).toHaveBeenCalledWith(
        expect.objectContaining({
          departmentId: 'dept-cr',
          machineId: 'dt-01',
          shiftType: 'night',
        })
      );
    });

    // Keyboard ArrowUp on grid cell wrapper & decrement button click
    const dt02RowAfter = screen.getByTestId('hourly-load-row-dt-02');
    const firstHourCellWrapper = dt02RowAfter.querySelector('[data-hour="hour_01"]') as HTMLElement;
    fireEvent.keyDown(firstHourCellWrapper, { key: 'ArrowUp' });

    // Switch back to Day shift and verify realtime CDC updates for hourly_loads, excavator_activity, and breakdowns
    fireEvent.click(screen.getByRole('button', { name: /Day \(06:00 - 17:59\)/i }));

    act(() => {
      realtimeCallbacks.hourly_loads?.({
        eventType: 'INSERT',
        new: {
          id: 'rt-load-1',
          machine_id: 'dt-02',
          shift_type: 'day',
          hour_01: 4,
          total_loads: 4,
        },
        old: {},
      });
      realtimeCallbacks.excavator_activity?.({
        eventType: 'UPDATE',
        new: {
          machine_id: 'ex-01',
          site_id: 'site-1',
          material_type: 'Coal',
        },
        old: {},
      });
      realtimeCallbacks.breakdowns?.({
        eventType: 'INSERT',
        new: {
          id: 'rt-bd-1',
          machine_id: 'dt-01',
          fleet_id: 'SN-DT01',
          status: 'active',
          reason: 'Live steering fault',
        },
        old: {},
      });
    });

    expect(screen.getByTestId('hourly-load-row-dt-01')).toHaveAttribute(
      'data-breakdown-blocked',
      'true'
    );
    expect(screen.getByTestId('breakdown-note-dt-01')).toHaveTextContent('Live steering fault');

    act(() => {
      realtimeCallbacks.breakdowns?.({
        eventType: 'UPDATE',
        new: {
          id: 'rt-bd-1',
          machine_id: 'dt-01',
          status: 'completed',
        },
        old: {},
      });
      realtimeCallbacks.hourly_loads?.({
        eventType: 'DELETE',
        new: {},
        old: { id: 'rt-load-1' },
      });
    });

    expect(screen.getByTestId('hourly-load-row-dt-01')).not.toHaveAttribute(
      'data-breakdown-blocked'
    );
  });

  it('reverts optimistic changes when saveHourlyLoad fails', async () => {
    (saveHourlyLoad as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    render(
      <HourlyLoadsGrid
        departmentId="dept-cr"
        machines={machines}
        excavators={excavators}
        hourlyLoads={[]}
        sites={sites}
        activeBreakdowns={[]}
        today="2026-11-20"
        initialShift="day"
      />
    );

    const dt02Row = screen.getByTestId('hourly-load-row-dt-02');
    const upBtn = within(dt02Row).getByRole('button', { name: 'Increase 06:00 loads' });
    fireEvent.click(upBtn);

    await waitFor(() => {
      expect(saveHourlyLoad).toHaveBeenCalledTimes(1);
    });
    const inputs = within(dt02Row).getAllByRole('textbox') as HTMLInputElement[];
    await waitFor(() => {
      expect(inputs[0]?.value).toBe('0');
    });
  });

  it('renders empty state when no machines are configured', () => {
    render(
      <HourlyLoadsGrid
        departmentId="dept-cr"
        machines={[]}
        excavators={[]}
        hourlyLoads={[]}
        sites={sites}
        today="2026-11-20"
        initialShift="day"
      />
    );

    expect(
      screen.getByText(/No machines available. Add machines in the Machine DB tab first./i)
    ).toBeInTheDocument();
  });
});
