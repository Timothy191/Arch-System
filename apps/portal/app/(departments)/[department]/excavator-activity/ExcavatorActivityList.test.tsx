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
      passes: 4,
      loads: 20,
      notes: 'Day shift smooth run',
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
      passes: 3,
      loads: 15,
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
      id: 'assign-1',
      excavator_activity_id: 'act-1',
      dumper_machine_id: 'd-1',
      material_type: 'Waste',
      total_loads: 10,
      total_bcm: 150.0,
      notes: null,
      dumper: {
        name: 'DT-101',
        bin_factor: 15,
        machine_type: 'Dump Truck',
      },
    },
    {
      id: 'assign-2',
      excavator_activity_id: 'act-1',
      dumper_machine_id: 'd-2',
      material_type: 'Ore',
      total_loads: 10,
      total_bcm: 180.0,
      notes: null,
      dumper: {
        name: 'DT-102',
        bin_factor: 18,
        machine_type: 'Dump Truck',
      },
    },
    {
      id: 'assign-3',
      excavator_activity_id: 'act-2',
      dumper_machine_id: 'd-3',
      material_type: 'Ore',
      total_loads: 15,
      total_bcm: 225.0,
      notes: null,
      dumper: {
        name: 'DT-103',
        bin_factor: 15,
        machine_type: 'Dump Truck',
      },
    },
  ];

  it('renders today activity heading and site entries', () => {
    render(
      <ExcavatorActivityList todayActivity={mockActivities} todayAssignments={mockAssignments} />
    );

    expect(screen.getByText("Today's Activity")).toBeInTheDocument();
    expect(screen.getAllByText('North Pit').length).toBeGreaterThan(0);
  });

  it('calculates site aggregate BCM and loads correctly', () => {
    render(
      <ExcavatorActivityList todayActivity={mockActivities} todayAssignments={mockAssignments} />
    );

    // Total site BCM = 150 + 180 + 225 = 555.0
    expect(screen.getByText('555.0 BCM')).toBeInTheDocument();
    // Total site loads = 10 + 10 + 15 = 35
    expect(screen.getByText('35 loads')).toBeInTheDocument();
  });

  it('renders day and night shift activity details and dumper assignments', () => {
    render(
      <ExcavatorActivityList todayActivity={mockActivities} todayAssignments={mockAssignments} />
    );

    // Shift headers
    expect(screen.getByRole('heading', { name: /Day Shift/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Night Shift/i })).toBeInTheDocument();

    // Machine and operator info
    expect(screen.getByText('EX-01')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Block A1')).toBeInTheDocument();

    expect(screen.getByText('EX-02')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();

    // Dumpers mapped from pre-indexed Map
    expect(screen.getByText('DT-101')).toBeInTheDocument();
    expect(screen.getByText('DT-102')).toBeInTheDocument();
    expect(screen.getByText('DT-103')).toBeInTheDocument();

    // Activity note
    expect(screen.getByText('Day shift smooth run')).toBeInTheDocument();
  });
});
