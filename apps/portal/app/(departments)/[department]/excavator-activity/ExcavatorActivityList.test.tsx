import { render, screen } from '@testing-library/react';
import { ExcavatorActivityList } from './ExcavatorActivityList';

describe('ExcavatorActivityList', () => {
  const mockActivity = [
    {
      id: 'act-1',
      machine_id: 'm-1',
      operator_id: 'op-1',
      activity_date: '2026-10-05',
      shift_type: 'day' as const,
      passes: 4,
      loads: 10,
      notes: 'Good progress',
      site_id: 'site-1',
      block_mined_id: 'block-1',
      machine: { name: 'EX-01' },
      operator: { full_name: 'John Doe' },
      site: { name: 'Pit Alpha' },
      block_mined: { name: 'Block A', code: 'A1' },
    },
    {
      id: 'act-2',
      machine_id: 'm-2',
      operator_id: 'op-2',
      activity_date: '2026-10-05',
      shift_type: 'night' as const,
      passes: 3,
      loads: 8,
      notes: null,
      site_id: 'site-1',
      block_mined_id: null,
      machine: { name: 'EX-02' },
      operator: { full_name: 'Jane Smith' },
      site: { name: 'Pit Alpha' },
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
      total_bcm: 150,
      notes: null,
      dumper: {
        name: 'DT-01',
        bin_factor: 15,
        machine_type: 'Cat 777',
      },
    },
    {
      id: 'assign-2',
      excavator_activity_id: 'act-2',
      dumper_machine_id: 'd-2',
      material_type: 'Ore',
      total_loads: 8,
      total_bcm: 120,
      notes: null,
      dumper: {
        name: 'DT-02',
        bin_factor: 15,
        machine_type: 'Cat 777',
      },
    },
  ];

  it('renders site grouping and excavator activity cards with dumper assignments', () => {
    render(
      <ExcavatorActivityList
        todayActivity={mockActivity}
        todayAssignments={mockAssignments}
      />
    );

    // Site header
    expect(screen.getAllByText('Pit Alpha').length).toBeGreaterThan(0);

    // Shift headers & badges
    expect(screen.getAllByText(/Day Shift/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Night Shift/i).length).toBeGreaterThan(0);

    // Machine and operator info
    expect(screen.getByText('EX-01')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('EX-02')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();

    // Dumpers and loads/BCM
    expect(screen.getByText('DT-01')).toBeInTheDocument();
    expect(screen.getByText('DT-02')).toBeInTheDocument();
    expect(screen.getAllByText('150.0').length).toBeGreaterThan(0);
    expect(screen.getAllByText('120.0').length).toBeGreaterThan(0);
  });
});
