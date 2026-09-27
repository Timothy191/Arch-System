import { render, screen } from '@testing-library/react';
import { ExcavatorActivityList } from './ExcavatorActivityList';

describe('ExcavatorActivityList', () => {
  const mockActivities = [
    {
      id: 'act-1',
      machine_id: 'm-1',
      operator_id: 'op-1',
      activity_date: '2025-01-01',
      shift_type: 'day' as const,
      passes: 4,
      loads: 10,
      notes: 'Day shift operating smooth',
      site_id: 'site-a',
      block_mined_id: 'block-1',
      machine: { name: 'EX-100' },
      operator: { full_name: 'John Doe' },
      site: { name: 'North Pit' },
      block_mined: { name: 'Block A', code: 'BLK-A' },
    },
    {
      id: 'act-2',
      machine_id: 'm-2',
      operator_id: 'op-2',
      activity_date: '2025-01-01',
      shift_type: 'night' as const,
      passes: 5,
      loads: 12,
      notes: null,
      site_id: 'site-a',
      block_mined_id: null,
      machine: { name: 'EX-200' },
      operator: { full_name: 'Jane Smith' },
      site: { name: 'North Pit' },
      block_mined: null,
    },
    {
      id: 'act-3',
      machine_id: 'm-3',
      operator_id: null,
      activity_date: '2025-01-01',
      shift_type: 'day' as const,
      passes: 3,
      loads: 5,
      notes: null,
      site_id: null,
      block_mined_id: null,
      machine: null,
      operator: null,
      site: null,
      block_mined: null,
    },
  ];

  const mockAssignments = [
    {
      id: 'asg-1',
      excavator_activity_id: 'act-1',
      dumper_machine_id: 'd-1',
      material_type: 'Waste',
      total_loads: 10,
      total_bcm: 120.5,
      notes: null,
      dumper: {
        name: 'DT-01',
        bin_factor: 12.05,
        machine_type: 'CAT 777',
      },
    },
    {
      id: 'asg-2',
      excavator_activity_id: 'act-2',
      dumper_machine_id: 'd-2',
      material_type: 'Coal',
      total_loads: 12,
      total_bcm: 150.0,
      notes: null,
      dumper: {
        name: 'DT-02',
        bin_factor: 12.5,
        machine_type: 'Komatsu HD785',
      },
    },
  ];

  it('renders site headers, activities, and shift groups correctly', () => {
    render(
      <ExcavatorActivityList
        todayActivity={mockActivities}
        todayAssignments={mockAssignments}
      />
    );

    // Site headers
    expect(screen.getAllByText('North Pit').length).toBeGreaterThan(0);
    expect(screen.getByText('No Site Assigned')).toBeInTheDocument();

    // Machine names
    expect(screen.getByText('EX-100')).toBeInTheDocument();
    expect(screen.getByText('EX-200')).toBeInTheDocument();
    expect(screen.getByText('Unknown Excavator')).toBeInTheDocument();

    // Operator names
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.getByText('No Operator')).toBeInTheDocument();

    // Block mined code
    expect(screen.getByText('Block BLK-A')).toBeInTheDocument();

    // Notes
    expect(screen.getByText('Day shift operating smooth')).toBeInTheDocument();
  });

  it('correctly maps dumper assignments and calculates site aggregates', () => {
    render(
      <ExcavatorActivityList
        todayActivity={mockActivities}
        todayAssignments={mockAssignments}
      />
    );

    // Dumper details
    expect(screen.getByText('DT-01')).toBeInTheDocument();
    expect(screen.getByText('(CAT 777)')).toBeInTheDocument();
    expect(screen.getByText('DT-02')).toBeInTheDocument();
    expect(screen.getByText('(Komatsu HD785)')).toBeInTheDocument();
    expect(screen.getByText('Waste')).toBeInTheDocument();
    expect(screen.getByText('Coal')).toBeInTheDocument();

    // Aggregate BCM and loads for North Pit (120.5 + 150 = 270.5 BCM, 10 + 12 = 22 loads)
    expect(screen.getByText('270.5 BCM')).toBeInTheDocument();
    expect(screen.getByText('22 loads')).toBeInTheDocument();
  });

  it('renders empty state when no assignments exist for an activity', () => {
    render(
      <ExcavatorActivityList
        todayActivity={[mockActivities[2]!]}
        todayAssignments={[]}
      />
    );

    expect(screen.getByText('No dumper assignments')).toBeInTheDocument();
  });
});
