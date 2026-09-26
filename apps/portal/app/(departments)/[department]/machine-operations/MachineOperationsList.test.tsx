import { render, screen, fireEvent } from '@testing-library/react';
import { MachineOperationsList } from './MachineOperationsList';

describe('MachineOperationsList', () => {
  it('renders empty state message when operations array is empty', () => {
    render(<MachineOperationsList operations={[]} todayLoads={[]} />);

    expect(
      screen.getByText('No operations logged today. Use the form above to add operations.')
    ).toBeInTheDocument();
  });

  it('groups operations by site and displays pre-indexed site totals and shift breakdown', () => {
    const mockOperations = [
      {
        id: 'op1',
        machine_id: 'm1',
        operator_id: 'op_user1',
        site_id: 'site1',
        shift_type: 'day' as const,
        start_time: '07:00:00',
        end_time: '17:00:00',
        hours_worked: 10,
        machine: { name: 'Excavator EX01', bin_factor: 15, serial_number: 'EX01-SN' },
        operator: { full_name: 'John Doe' },
        site: { name: 'North Pit' },
        delay_entries: [],
      },
      {
        id: 'op2',
        machine_id: 'm2',
        operator_id: 'op_user2',
        site_id: 'site1',
        shift_type: 'night' as const,
        start_time: '19:00:00',
        end_time: '05:00:00',
        hours_worked: 10,
        machine: { name: 'Excavator EX02', bin_factor: 20, serial_number: 'EX02-SN' },
        operator: { full_name: 'Jane Smith' },
        site: { name: 'North Pit' },
        delay_entries: [],
      },
    ];

    const mockLoads = [
      { machine_id: 'm1', shift_type: 'day', total_loads: 8 },
      { machine_id: 'm2', shift_type: 'night', total_loads: 5 },
    ];

    render(<MachineOperationsList operations={mockOperations} todayLoads={mockLoads} />);

    // Site header
    expect(screen.getByRole('heading', { name: 'North Pit', level: 4 })).toBeInTheDocument();
    // Total site hours (10 + 10 = 20.0h)
    expect(screen.getByText('20.0h')).toBeInTheDocument();
    // Total site BCM: (8 * 15) + (5 * 20) = 120 + 100 = 220.0 BCM
    expect(screen.getByText('220.0 BCM')).toBeInTheDocument();

    // Shift headers
    expect(screen.getByText('Day Shift')).toBeInTheDocument();
    expect(screen.getByText('Night Shift')).toBeInTheDocument();

    // Machine names & Operators
    expect(screen.getByText('Excavator EX01')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Excavator EX02')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
  });

  it('renders active breakdown details when machine has an active breakdown', () => {
    const mockOperations = [
      {
        id: 'op1',
        machine_id: 'm1',
        operator_id: 'op_user1',
        site_id: 'site1',
        shift_type: 'day' as const,
        start_time: '07:00:00',
        end_time: null,
        hours_worked: null,
        machine: { name: 'Hauler DT01', bin_factor: 10, serial_number: 'DT01-SN' },
        operator: { full_name: 'Bob Miller' },
        site: { name: 'South Pit' },
        delay_entries: [],
      },
    ];

    const mockBreakdowns = [
      {
        id: 'b1',
        fleet_id: 'm1',
        reason: 'Engine Overheating',
        repair_notes: 'Replacing radiator hose',
        status: 'active',
        date_in: '2026-03-30T10:00:00Z',
        date_out: null,
      },
    ];

    render(
      <MachineOperationsList
        operations={mockOperations}
        todayLoads={[]}
        activeBreakdowns={mockBreakdowns}
      />
    );

    expect(screen.getByText('Active Breakdown')).toBeInTheDocument();
    expect(screen.getByText('Engineering Breakdown: Engine Overheating')).toBeInTheDocument();
    expect(screen.getByText('Replacing radiator hose')).toBeInTheDocument();
  });

  it('toggles delay summary details when delay button is clicked', () => {
    const mockOperations = [
      {
        id: 'op1',
        machine_id: 'm1',
        operator_id: 'op_user1',
        site_id: 'site1',
        shift_type: 'day' as const,
        start_time: '07:00:00',
        end_time: '17:00:00',
        hours_worked: 10,
        machine: { name: 'Dozer DZ01', bin_factor: 0, serial_number: 'DZ01-SN' },
        operator: { full_name: 'Alice Johnson' },
        site: { name: 'East Pit' },
        delay_entries: [
          {
            id: 'd1',
            delay_category_id: 'cat1',
            delay_start_time: '09:00:00',
            delay_end_time: '09:30:00',
            duration_hours: 0.5,
            is_manual_override: false,
            status: 'committed' as const,
            delay_category: { name: 'Refueling' },
          },
          {
            id: 'd2',
            delay_category_id: 'cat2',
            delay_start_time: '12:00:00',
            delay_end_time: '13:00:00',
            duration_hours: 1.0,
            is_manual_override: true,
            status: 'draft' as const,
            delay_category: { name: 'Operator Meal Break' },
          },
        ],
      },
    ];

    render(<MachineOperationsList operations={mockOperations} todayLoads={[]} />);

    const delayButton = screen.getByRole('button', { name: /2 delays/i });
    expect(delayButton).toBeInTheDocument();
    expect(screen.getByText('1.50h total')).toBeInTheDocument();

    // Before clicking, category details should not be shown
    expect(screen.queryByText('Refueling')).not.toBeInTheDocument();

    // Click to expand
    fireEvent.click(delayButton);

    expect(screen.getByText('Refueling')).toBeInTheDocument();
    expect(screen.getByText('0.50h')).toBeInTheDocument();
    expect(screen.getByText('Operator Meal Break')).toBeInTheDocument();
    expect(screen.getByText('1.00h')).toBeInTheDocument();
    expect(screen.getByText('Includes manual override entries')).toBeInTheDocument();
  });
});
