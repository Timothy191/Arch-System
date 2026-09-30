import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { ExcavatorActivityList } from './ExcavatorActivityList';

describe('ExcavatorActivityList', () => {
  const mockActivities = [
    {
      id: 'act-1',
      machine_id: 'ex-101',
      operator_id: 'op-1',
      activity_date: '2026-03-30',
      shift_type: 'day' as const,
      passes: 4,
      loads: 10,
      notes: 'Day shift smooth run',
      site_id: 'site-1',
      block_mined_id: 'bm-1',
      machine: { name: 'EX-101 Heavy Digger' },
      operator: { full_name: 'John Doe' },
      site: { name: 'Main Pit' },
      block_mined: { name: 'Block A', code: 'BLK-A' },
    },
    {
      id: 'act-2',
      machine_id: 'ex-102',
      operator_id: 'op-2',
      activity_date: '2026-03-30',
      shift_type: 'night' as const,
      passes: 3,
      loads: 8,
      notes: null,
      site_id: 'site-1',
      block_mined_id: null,
      machine: { name: 'EX-102 Night Loader' },
      operator: { full_name: 'Jane Smith' },
      site: { name: 'Main Pit' },
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
      total_bcm: 150,
      notes: null,
      dumper: {
        name: 'DT-01',
        bin_factor: 15,
        machine_type: 'CAT 777',
      },
    },
    {
      id: 'asg-2',
      excavator_activity_id: 'act-2',
      dumper_machine_id: 'd-2',
      material_type: 'Ore',
      total_loads: 8,
      total_bcm: 120,
      notes: null,
      dumper: {
        name: 'DT-02',
        bin_factor: 15,
        machine_type: 'CAT 777',
      },
    },
  ];

  it('renders site heading and aggregates total site BCM and loads', () => {
    render(
      <ExcavatorActivityList
        todayActivity={mockActivities}
        todayAssignments={mockAssignments}
      />
    );

    expect(screen.getByText("Today's Activity")).toBeInTheDocument();
    expect(screen.getAllByText('Main Pit').length).toBeGreaterThan(0);
    expect(screen.getByText('270.0 BCM')).toBeInTheDocument();
    expect(screen.getByText('18 loads')).toBeInTheDocument();
  });

  it('renders Day Shift and Night Shift sections with corresponding machines and assignments', () => {
    render(
      <ExcavatorActivityList
        todayActivity={mockActivities}
        todayAssignments={mockAssignments}
      />
    );

    expect(screen.getByRole('heading', { name: /Day Shift/i })).toBeInTheDocument();
    expect(screen.getByText('EX-101 Heavy Digger')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Block BLK-A')).toBeInTheDocument();
    expect(screen.getByText('Day shift smooth run')).toBeInTheDocument();

    expect(screen.getByRole('heading', { name: /Night Shift/i })).toBeInTheDocument();
    expect(screen.getByText('EX-102 Night Loader')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
  });

  it('correctly maps dumper assignments using the indexed lookup Map', () => {
    render(
      <ExcavatorActivityList
        todayActivity={mockActivities}
        todayAssignments={mockAssignments}
      />
    );

    expect(screen.getByText('DT-01')).toBeInTheDocument();
    expect(screen.getByText('Waste')).toBeInTheDocument();
    expect(screen.getByText('DT-02')).toBeInTheDocument();
    expect(screen.getByText('Ore')).toBeInTheDocument();
  });
});
