import { render, screen } from '@testing-library/react';
import { ExcavatorActivityList } from './ExcavatorActivityList';

describe('ExcavatorActivityList Component', () => {
  const mockActivity = [
    {
      id: 'act-1',
      machine_id: 'm-1',
      operator_id: 'op-1',
      activity_date: '2026-03-31',
      shift_type: 'day' as const,
      passes: 10,
      loads: 5,
      notes: 'Operating smoothly',
      site_id: 'site-1',
      block_mined_id: 'bm-1',
      machine: { name: 'EX-01' },
      operator: { full_name: 'John Doe' },
      site: { name: 'North Pit' },
      block_mined: { name: 'Block A', code: 'A1' },
    },
    {
      id: 'act-2',
      machine_id: 'm-2',
      operator_id: 'op-2',
      activity_date: '2026-03-31',
      shift_type: 'night' as const,
      passes: 8,
      loads: 4,
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
      dumper_machine_id: 'dump-1',
      material_type: 'Coal',
      total_loads: 10,
      total_bcm: 250,
      notes: null,
      dumper: {
        name: 'DT-101',
        bin_factor: 25,
        machine_type: 'CAT 777',
      },
    },
    {
      id: 'assign-2',
      excavator_activity_id: 'act-1',
      dumper_machine_id: 'dump-2',
      material_type: 'Overburden',
      total_loads: 5,
      total_bcm: 125,
      notes: null,
      dumper: {
        name: 'DT-102',
        bin_factor: 25,
        machine_type: 'CAT 777',
      },
    },
  ];

  it('renders site headers, machine activities, and assignments correctly', () => {
    render(
      <ExcavatorActivityList
        todayActivity={mockActivity}
        todayAssignments={mockAssignments}
      />
    );

    // Site header check
    expect(screen.getAllByText('North Pit').length).toBeGreaterThan(0);
    expect(screen.getByText('375.0 BCM')).toBeInTheDocument();
    expect(screen.getByText('15 loads')).toBeInTheDocument();

    // Day & Night shift headers
    expect(screen.getAllByText('Day Shift').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Night Shift').length).toBeGreaterThan(0);

    // Excavator activity cards
    expect(screen.getByText('EX-01')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Block A1')).toBeInTheDocument();
    expect(screen.getByText('Operating smoothly')).toBeInTheDocument();

    expect(screen.getByText('EX-02')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();

    // Dumper assignment details
    expect(screen.getByText('DT-101')).toBeInTheDocument();
    expect(screen.getByText('Coal')).toBeInTheDocument();
    expect(screen.getByText('DT-102')).toBeInTheDocument();
    expect(screen.getByText('Overburden')).toBeInTheDocument();
  });

  it('renders empty assignment message when activity has no dumper assignments', () => {
    render(
      <ExcavatorActivityList
        todayActivity={[mockActivity[1]]}
        todayAssignments={[]}
      />
    );

    expect(screen.getByText('EX-02')).toBeInTheDocument();
    expect(screen.getByText('No dumper assignments')).toBeInTheDocument();
  });
});
