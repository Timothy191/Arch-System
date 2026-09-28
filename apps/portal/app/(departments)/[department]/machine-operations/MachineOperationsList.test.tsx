import { render, screen, fireEvent } from '@testing-library/react';
import { MachineOperationsList } from './MachineOperationsList';

describe('MachineOperationsList', () => {
  const mockOperations = [
    {
      id: 'op1',
      machine_id: 'm1',
      operator_id: 'op1',
      site_id: 'site1',
      shift_type: 'day' as const,
      start_time: '07:00:00',
      end_time: '17:00:00',
      hours_worked: 10,
      machine: { name: 'Excavator EX-01', bin_factor: 15.5, serial_number: 'SN-EX01' },
      operator: { full_name: 'John Doe' },
      site: { name: 'North Pit' },
      delay_entries: [
        {
          id: 'del1',
          delay_category_id: 'cat1',
          delay_start_time: '09:00:00',
          delay_end_time: '10:00:00',
          duration_hours: 1.0,
          is_manual_override: false,
          status: 'committed' as const,
          delay_category: { name: 'Weather' },
        },
      ],
    },
    {
      id: 'op2',
      machine_id: 'm2',
      operator_id: 'op2',
      site_id: 'site1',
      shift_type: 'night' as const,
      start_time: '19:00:00',
      end_time: null,
      hours_worked: null,
      machine: { name: 'Hauler HT-02', bin_factor: 20.0, serial_number: 'SN-HT02' },
      operator: { full_name: 'Jane Smith' },
      site: { name: 'North Pit' },
      delay_entries: [],
    },
  ];

  const mockTodayLoads = [
    { machine_id: 'm1', shift_type: 'day', total_loads: 10 },
    { machine_id: 'm1', shift_type: 'night', total_loads: 5 },
    { machine_id: 'm2', shift_type: 'night', total_loads: 8 },
  ];

  const mockActiveBreakdowns = [
    {
      id: 'b1',
      fleet_id: 'SN-HT02',
      reason: 'Hydraulic leak',
      repair_notes: 'Replacing hose',
      status: 'active',
      date_in: '2025-01-01T00:00:00Z',
      date_out: null,
    },
  ];

  it('renders empty state when operations is empty', () => {
    render(<MachineOperationsList operations={[]} todayLoads={[]} />);
    expect(
      screen.getByText('No operations logged today. Use the form above to add operations.')
    ).toBeInTheDocument();
  });

  it('renders site grouping and BCM aggregate metrics correctly', () => {
    render(
      <MachineOperationsList
        operations={mockOperations}
        todayLoads={mockTodayLoads}
        activeBreakdowns={mockActiveBreakdowns}
      />
    );

    // Site header and cards
    expect(screen.getAllByText('North Pit')).not.toHaveLength(0);

    // Machine names
    expect(screen.getByText('Excavator EX-01')).toBeInTheDocument();
    expect(screen.getByText('Hauler HT-02')).toBeInTheDocument();

    // Operators
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();

    // Site total BCM calculation:
    // op1 (m1): 15 loads * 15.5 = 232.5 BCM
    // op2 (m2): 8 loads * 20.0 = 160.0 BCM
    // Site Total BCM = 392.5 BCM
    expect(screen.getByText('392.5 BCM')).toBeInTheDocument();
  });

  it('renders breakdown information for active breakdown machines', () => {
    render(
      <MachineOperationsList
        operations={mockOperations}
        todayLoads={mockTodayLoads}
        activeBreakdowns={mockActiveBreakdowns}
      />
    );

    expect(screen.getByText('Active Breakdown')).toBeInTheDocument();
    expect(screen.getByText('Engineering Breakdown: Hydraulic leak')).toBeInTheDocument();
    expect(screen.getByText('Replacing hose')).toBeInTheDocument();
  });

  it('allows toggling delay summary details', () => {
    render(
      <MachineOperationsList
        operations={mockOperations}
        todayLoads={mockTodayLoads}
        activeBreakdowns={mockActiveBreakdowns}
      />
    );

    const delayButton = screen.getByText('1 delay');
    expect(screen.queryByText('Weather')).not.toBeInTheDocument();

    fireEvent.click(delayButton);

    expect(screen.getByText('Weather')).toBeInTheDocument();
    expect(screen.getByText('1.00h')).toBeInTheDocument();
  });
});
