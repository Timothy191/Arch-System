import { render, screen, fireEvent } from '@testing-library/react';
import { MachineOperationsList } from './MachineOperationsList';

describe('MachineOperationsList', () => {
  const mockOperations = [
    {
      id: 'op1',
      machine_id: 'm1',
      operator_id: 'op_user1',
      site_id: 's1',
      shift_type: 'day' as const,
      start_time: '07:00:00',
      end_time: '19:00:00',
      hours_worked: 12,
      machine: { name: 'Excavator EX01', bin_factor: 15, serial_number: 'SN-EX01' },
      operator: { full_name: 'John Doe' },
      site: { name: 'North Pit' },
      delay_entries: [
        {
          id: 'd1',
          delay_category_id: 'c1',
          delay_start_time: '08:00',
          delay_end_time: '08:30',
          duration_hours: 0.5,
          is_manual_override: false,
          status: 'committed' as const,
          delay_category: { name: 'Refueling' },
        },
        {
          id: 'd2',
          delay_category_id: 'c2',
          delay_start_time: '12:00',
          delay_end_time: '12:30',
          duration_hours: 0.5,
          is_manual_override: true,
          status: 'draft' as const,
          delay_category: { name: 'Meal Break' },
        },
      ],
    },
    {
      id: 'op2',
      machine_id: 'm2',
      operator_id: 'op_user2',
      site_id: 's1',
      shift_type: 'night' as const,
      start_time: '19:00:00',
      end_time: null,
      hours_worked: null,
      machine: { name: 'Hauler DT02', bin_factor: 20, serial_number: 'SN-DT02' },
      operator: { full_name: 'Jane Smith' },
      site: { name: 'North Pit' },
    },
  ];

  const mockLoads = [
    { machine_id: 'm1', shift_type: 'day', total_loads: 10 },
    { machine_id: 'm1', shift_type: 'night', total_loads: 5 },
    { machine_id: 'm2', shift_type: 'night', total_loads: 8 },
  ];

  const mockBreakdowns = [
    {
      id: 'b1',
      fleet_id: 'SN-EX01',
      reason: 'Hydraulic leak',
      repair_notes: 'Replacing seal kit',
      status: 'active',
      date_in: '2026-10-04T00:00:00Z',
      date_out: null,
    },
  ];

  it('renders empty state when no operations logged', () => {
    render(<MachineOperationsList operations={[]} todayLoads={[]} />);
    expect(
      screen.getByText('No operations logged today. Use the form above to add operations.')
    ).toBeInTheDocument();
  });

  it('renders site header, BCM calculations, and shift groupings correctly', () => {
    render(
      <MachineOperationsList
        operations={mockOperations}
        todayLoads={mockLoads}
        activeBreakdowns={mockBreakdowns}
      />
    );

    // Site header (matches all instances including card details)
    expect(screen.getAllByText('North Pit').length).toBeGreaterThan(0);

    // Site total hours (12h) and BCM calculation (m1 loads = 15, bin_factor = 15 -> 225 BCM + m2 loads = 8, bin_factor = 20 -> 160 BCM; Total = 385.0 BCM)
    expect(screen.getByText('12.0h')).toBeInTheDocument();
    expect(screen.getByText('385.0 BCM')).toBeInTheDocument();

    // Machine names & shift headers
    expect(screen.getByText('Day Shift')).toBeInTheDocument();
    expect(screen.getByText('Night Shift')).toBeInTheDocument();
    expect(screen.getByText('Excavator EX01')).toBeInTheDocument();
    expect(screen.getByText('Hauler DT02')).toBeInTheDocument();

    // Breakdown indicator
    expect(screen.getByText('Active Breakdown')).toBeInTheDocument();
    expect(screen.getByText('Engineering Breakdown: Hydraulic leak')).toBeInTheDocument();
    expect(screen.getByText('Replacing seal kit')).toBeInTheDocument();
  });

  it('toggles delay summary view when clicked', () => {
    render(
      <MachineOperationsList
        operations={mockOperations}
        todayLoads={mockLoads}
        activeBreakdowns={[]}
      />
    );

    // Delay summary button
    const delayBtn = screen.getByText('2 delays');
    expect(delayBtn).toBeInTheDocument();

    // Check delay details are hidden initially
    expect(screen.queryByText('Refueling')).not.toBeInTheDocument();

    // Click to expand
    fireEvent.click(delayBtn);

    // Check expanded delay categories and manual override notice
    expect(screen.getByText('Refueling')).toBeInTheDocument();
    expect(screen.getByText('Meal Break')).toBeInTheDocument();
    expect(screen.getByText('Includes manual override entries')).toBeInTheDocument();
  });
});
