import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MachineOperationsList } from './MachineOperationsList';

describe('MachineOperationsList', () => {
  const mockOperations = [
    {
      id: 'op-1',
      machine_id: 'm-1',
      operator_id: 'op-1',
      site_id: 'site-a',
      shift_type: 'day' as const,
      start_time: '07:00:00',
      end_time: '19:00:00',
      hours_worked: 12.0,
      start_smu: 1000,
      end_smu: 1012,
      block_drilled: 'B-101',
      meters_drilled: 120.5,
      holes_drilled: 24,
      machine: {
        name: 'EX-101 (CAT 6060)',
        machine_type: 'Excavator',
        bin_factor: 25.0,
        serial_number: 'SN-EX101',
      },
      operator: { full_name: 'John Doe' },
      site: { name: 'Pit North' },
      delay_entries: [
        {
          id: 'del-1',
          delay_category_id: 'cat-1',
          delay_start_time: '09:00',
          delay_end_time: '09:30',
          duration_hours: 0.5,
          is_manual_override: false,
          status: 'committed' as const,
          delay_category: { name: 'Refueling' },
        },
      ],
    },
    {
      id: 'op-2',
      machine_id: 'm-2',
      operator_id: 'op-2',
      site_id: 'site-a',
      shift_type: 'night' as const,
      start_time: '19:00:00',
      end_time: null,
      hours_worked: 6.0,
      start_smu: 500,
      end_smu: null,
      machine: {
        name: 'DT-201 (CAT 777)',
        machine_type: 'Dumper',
        bin_factor: 0,
        serial_number: 'SN-DT201',
      },
      operator: { full_name: 'Jane Smith' },
      site: { name: 'Pit North' },
    },
  ];

  const mockTodayLoads = [
    {
      machine_id: 'm-1',
      shift_type: 'day',
      total_loads: 10,
    },
  ];

  const mockActiveBreakdowns = [
    {
      id: 'bd-1',
      fleet_id: 'm-1',
      reason: 'Hydraulic leak',
      repair_notes: 'Replacing O-ring',
      status: 'active',
      date_in: '2025-02-20T10:00:00Z',
      date_out: null,
    },
  ];

  it('renders empty state message when operations array is empty', () => {
    render(<MachineOperationsList operations={[]} todayLoads={[]} />);

    expect(
      screen.getByText(/No operations logged today. Use the form above to add operations./i)
    ).toBeInTheDocument();
  });

  it('renders site headers, shift sections, and machine operation details', () => {
    render(
      <MachineOperationsList
        operations={mockOperations}
        todayLoads={mockTodayLoads}
        activeBreakdowns={mockActiveBreakdowns}
      />
    );

    expect(screen.getAllByText('Pit North').length).toBeGreaterThan(0);
    expect(screen.getByText(/Day Shift \(1\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Night Shift \(1\)/i)).toBeInTheDocument();
    expect(screen.getByText('EX-101 (CAT 6060)')).toBeInTheDocument();
    expect(screen.getByText('DT-201 (CAT 777)')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
  });

  it('calculates pre-indexed material BCM metrics correctly', () => {
    render(
      <MachineOperationsList
        operations={mockOperations}
        todayLoads={mockTodayLoads}
        activeBreakdowns={[]}
      />
    );

    // 10 loads * 25.0 bin_factor = 250.0 BCM
    expect(screen.getAllByText('250.0 BCM').length).toBeGreaterThan(0);
    // 250.0 BCM / 12.0 hours = 20.8 BCM/h
    expect(screen.getByText('20.8 BCM/h')).toBeInTheDocument();
  });

  it('matches breakdown by pre-indexed fleet_id and displays active breakdown alert', () => {
    render(
      <MachineOperationsList
        operations={mockOperations}
        todayLoads={mockTodayLoads}
        activeBreakdowns={mockActiveBreakdowns}
      />
    );

    expect(screen.getByText('Active Breakdown')).toBeInTheDocument();
    expect(screen.getByText(/Engineering Breakdown: Hydraulic leak/i)).toBeInTheDocument();
  });

  it('toggles delay summary view on button click', () => {
    render(
      <MachineOperationsList
        operations={mockOperations}
        todayLoads={mockTodayLoads}
        activeBreakdowns={[]}
      />
    );

    const toggleButton = screen.getByRole('button', { name: /1 delay/i });
    expect(toggleButton).toBeInTheDocument();
    expect(screen.queryByText('Refueling')).not.toBeInTheDocument();

    fireEvent.click(toggleButton);

    expect(screen.getByText('Refueling')).toBeInTheDocument();
    expect(screen.getByText('0.50h')).toBeInTheDocument();
  });

  it('displays fixed Dozer Roll-over amount (hours worked * 250 BCM)', () => {
    render(
      <MachineOperationsList
        operations={[
          {
            id: 'op-dozer',
            machine_id: 'dz-1',
            operator_id: 'op-3',
            site_id: 'site-a',
            shift_type: 'day',
            start_time: '06:00:00',
            end_time: '14:00:00',
            hours_worked: 8.0,
            start_smu: 2000,
            end_smu: 2008,
            machine: {
              name: 'DZ-401 (CAT D10T)',
              machine_type: 'Dozer',
              bin_factor: 0,
              serial_number: 'SN-DZ401',
            },
            operator: { full_name: 'Sam Dozer' },
            site: { name: 'Stockpile A' },
          },
        ]}
        todayLoads={[]}
        activeBreakdowns={[]}
      />
    );

    // 8.0 hours * 250 = 2000.0 BCM
    expect(screen.getByText(/Roll-over: 2000\.0 BCM/i)).toBeInTheDocument();
    expect(screen.getByText('250.0 BCM/h')).toBeInTheDocument();
  });

  describe('Fleet Machines Mode (when machines prop is provided)', () => {
    const mockMachines = [
      {
        id: 'm-1',
        name: 'EX-101 (CAT 6060)',
        machine_type: 'Excavator',
        serial_number: 'SN-EX101',
        site_id: 'site-a',
        latest_smu: 1012,
        site: { name: 'Pit North' },
      },
      {
        id: 'm-2',
        name: 'DT-201 (CAT 777)',
        machine_type: 'Dumper',
        serial_number: 'SN-DT201',
        site_id: 'site-a',
        latest_smu: 500,
        site: { name: 'Pit North' },
      },
      {
        id: 'm-3',
        name: 'DR-301 (Sandvik DR410i)',
        machine_type: 'Drill Rig',
        serial_number: 'SN-DR301',
        site_id: 'site-b',
        latest_smu: 1420.5,
        site: { name: 'South Ridge' },
      },
    ];

    it('lists all fleet machines even when operations array is empty', () => {
      render(
        <MachineOperationsList
          machines={mockMachines}
          operations={[]}
          todayLoads={[]}
          activeBreakdowns={[]}
        />
      );

      // Does not show empty message
      expect(
        screen.queryByText(/No operations logged today. Use the form above to add operations./i)
      ).not.toBeInTheDocument();

      // Renders all machines
      expect(screen.getByText('EX-101 (CAT 6060)')).toBeInTheDocument();
      expect(screen.getByText('DT-201 (CAT 777)')).toBeInTheDocument();
      expect(screen.getByText('DR-301 (Sandvik DR410i)')).toBeInTheDocument();

      // Displays latest SMR values
      expect(screen.getByText('SMR 1012.0')).toBeInTheDocument();
      expect(screen.getByText('SMR 500.0')).toBeInTheDocument();
      expect(screen.getByText('SMR 1420.5')).toBeInTheDocument();

      // Shows standby status for all machines
      expect(screen.getAllByText('Standby').length).toBe(3);
      expect(screen.getAllByText(/Standby — No operations logged today/i).length).toBe(3);
    });

    it('displays operating status and shifts when machine has operations logged', () => {
      render(
        <MachineOperationsList
          machines={mockMachines}
          operations={[mockOperations[0]]}
          todayLoads={mockTodayLoads}
          activeBreakdowns={[]}
        />
      );

      // EX-101 should be operating
      expect(screen.getByText('12.0h logged')).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();

      // Other 2 machines should remain in standby
      expect(screen.getAllByText('Standby').length).toBe(2);
    });

    it('filters machines by status tab when clicked', () => {
      render(
        <MachineOperationsList
          machines={mockMachines}
          operations={[mockOperations[0]]}
          todayLoads={mockTodayLoads}
          activeBreakdowns={mockActiveBreakdowns}
        />
      );

      // Click "Standby (2)" filter
      const standbyBtn = screen.getByRole('button', { name: /Standby \(2\)/i });
      fireEvent.click(standbyBtn);

      // Operating machine should be filtered out
      expect(screen.queryByText('EX-101 (CAT 6060)')).not.toBeInTheDocument();
      // Standby machines should remain visible
      expect(screen.getByText('DT-201 (CAT 777)')).toBeInTheDocument();
      expect(screen.getByText('DR-301 (Sandvik DR410i)')).toBeInTheDocument();
    });

    it('searches and filters machines by query string', () => {
      render(
        <MachineOperationsList
          machines={mockMachines}
          operations={[]}
          todayLoads={[]}
          activeBreakdowns={[]}
        />
      );

      const searchInput = screen.getByPlaceholderText(/Search machine, type, or SN.../i);
      fireEvent.change(searchInput, { target: { value: 'Sandvik' } });

      expect(screen.getByText('DR-301 (Sandvik DR410i)')).toBeInTheDocument();
      expect(screen.queryByText('EX-101 (CAT 6060)')).not.toBeInTheDocument();
      expect(screen.queryByText('DT-201 (CAT 777)')).not.toBeInTheDocument();
    });
  });
});
