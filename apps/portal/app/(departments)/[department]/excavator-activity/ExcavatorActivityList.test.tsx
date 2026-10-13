import { render, screen } from '@testing-library/react';
import { ExcavatorActivityList } from './ExcavatorActivityList';

describe('ExcavatorActivityList', () => {
  const mockActivity = [
    {
      id: 'act-1',
      machine_id: 'm-1',
      operator_id: 'op-1',
      activity_date: '2026-10-13',
      shift_type: 'day' as const,
      passes: 5,
      loads: 10,
      notes: null,
      site_id: 'site-1',
      block_mined_id: null,
      machine: { name: 'EX-01' },
      operator: { full_name: 'John Doe' },
      site: { name: 'North Pit' },
      block_mined: null,
    },
    {
      id: 'act-2',
      machine_id: 'm-2',
      operator_id: 'op-2',
      activity_date: '2026-10-13',
      shift_type: 'night' as const,
      passes: 4,
      loads: 8,
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
      id: 'asgn-1',
      excavator_activity_id: 'act-1',
      dumper_machine_id: 'd-1',
      material_type: 'Coal',
      total_loads: 10,
      total_bcm: 150,
      notes: null,
      dumper: {
        name: 'DT-01',
        bin_factor: 15,
        machine_type: 'dump_truck',
      },
    },
    {
      id: 'asgn-2',
      excavator_activity_id: 'act-2',
      dumper_machine_id: 'd-2',
      material_type: 'Waste',
      total_loads: 8,
      total_bcm: 120,
      notes: null,
      dumper: {
        name: 'DT-02',
        bin_factor: 15,
        machine_type: 'dump_truck',
      },
    },
  ];

  it('renders today\'s activity and aggregates metrics correctly', () => {
    render(
      <ExcavatorActivityList
        todayActivity={mockActivity}
        todayAssignments={mockAssignments}
      />
    );

    expect(screen.getByText("Today's Activity")).toBeInTheDocument();
    expect(screen.getAllByText('North Pit').length).toBeGreaterThan(0);
    expect(screen.getByText('270.0 BCM')).toBeInTheDocument();
    expect(screen.getByText('18 loads')).toBeInTheDocument();
    expect(screen.getByText('EX-01')).toBeInTheDocument();
    expect(screen.getByText('EX-02')).toBeInTheDocument();
  });
});
