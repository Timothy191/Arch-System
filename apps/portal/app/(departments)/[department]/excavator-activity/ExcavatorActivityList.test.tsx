import { render, screen } from '@testing-library/react';
import { ExcavatorActivityList } from './ExcavatorActivityList';

describe('ExcavatorActivityList', () => {
  const mockActivities = [
    {
      id: 'act-1',
      machine_id: 'm-1',
      operator_id: 'op-1',
      activity_date: '2025-05-10',
      shift_type: 'day' as const,
      passes: 10,
      loads: 20,
      notes: 'Good progress',
      site_id: 'site-1',
      block_mined_id: 'block-1',
      machine: { name: 'EX-01' },
      operator: { full_name: 'John Doe' },
      site: { name: 'North Pit' },
      block_mined: { name: 'Block A', code: 'A1' },
    },
    {
      id: 'act-2',
      machine_id: 'm-2',
      operator_id: 'op-2',
      activity_date: '2025-05-10',
      shift_type: 'night' as const,
      passes: 5,
      loads: 10,
      notes: null,
      site_id: 'site-1',
      block_mined_id: null,
      machine: { name: 'EX-02' },
      operator: { full_name: 'Jane Smith' },
      site: { name: 'North Pit' },
      block_mined: null,
    },
  ];

  const mockAssignments = [
    {
      id: 'asg-1',
      excavator_activity_id: 'act-1',
      dumper_machine_id: 'd-1',
      material_type: 'Coal',
      total_loads: 15,
      total_bcm: 150.5,
      notes: null,
      dumper: {
        name: 'DT-01',
        bin_factor: 10,
        machine_type: 'Dump Truck',
      },
    },
    {
      id: 'asg-2',
      excavator_activity_id: 'act-2',
      dumper_machine_id: 'd-2',
      material_type: 'Waste',
      total_loads: 8,
      total_bcm: 80,
      notes: null,
      dumper: {
        name: 'DT-02',
        bin_factor: 10,
        machine_type: 'Dump Truck',
      },
    },
  ];

  it('renders site headers, shifts, and assignment metrics correctly', () => {
    render(
      <ExcavatorActivityList
        todayActivity={mockActivities}
        todayAssignments={mockAssignments}
      />
    );

    expect(screen.getByText("Today's Activity")).toBeInTheDocument();
    expect(screen.getAllByText('North Pit').length).toBeGreaterThan(0);
    expect(screen.getByText('EX-01')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('DT-01')).toBeInTheDocument();
    expect(screen.getByText('230.5 BCM')).toBeInTheDocument();
    expect(screen.getAllByText('150.5').length).toBeGreaterThan(0);
    expect(screen.getByText('EX-02')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
  });
});
