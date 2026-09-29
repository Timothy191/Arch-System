import React from 'react';
import { render, screen } from '@testing-library/react';
import { ExcavatorActivityList } from './ExcavatorActivityList';

describe('ExcavatorActivityList', () => {
  const mockActivities = [
    {
      id: 'act1',
      site_id: 'site1',
      site: { id: 'site1', name: 'North Pit' },
      shift_type: 'day' as const,
      machine: { name: 'EX-01' },
      operator: { full_name: 'John Doe' },
      block_mined: { code: 'B10' },
      notes: 'Normal operation',
    },
    {
      id: 'act2',
      site_id: 'site1',
      site: { id: 'site1', name: 'North Pit' },
      shift_type: 'night' as const,
      machine: { name: 'EX-02' },
      operator: { full_name: 'Jane Smith' },
      notes: undefined,
    },
  ];

  const mockAssignments = [
    {
      id: 'asgn1',
      excavator_activity_id: 'act1',
      dumper: { name: 'DT-01', machine_type: 'Cat 777' },
      material_type: 'Waste',
      total_loads: 10,
      total_bcm: 150.5,
    },
    {
      id: 'asgn2',
      excavator_activity_id: 'act2',
      dumper: { name: 'DT-02', machine_type: 'Cat 777' },
      material_type: 'Coal',
      total_loads: 5,
      total_bcm: 75.0,
    },
  ];

  it('renders site group, shift sections, and activity details correctly', () => {
    render(
      <ExcavatorActivityList
        todayActivity={mockActivities as any}
        todayAssignments={mockAssignments as any}
      />
    );

    expect(screen.getByText("Today's Activity")).toBeInTheDocument();
    expect(screen.getAllByText('North Pit').length).toBeGreaterThan(0);
    expect(screen.getByText('225.5 BCM')).toBeInTheDocument();
    expect(screen.getByText('15 loads')).toBeInTheDocument();
    expect(screen.getByText('EX-01')).toBeInTheDocument();
    expect(screen.getByText('EX-02')).toBeInTheDocument();
    expect(screen.getByText('DT-01')).toBeInTheDocument();
    expect(screen.getByText('DT-02')).toBeInTheDocument();
  });

  it('renders empty container when activities array is empty', () => {
    render(<ExcavatorActivityList todayActivity={[]} todayAssignments={[]} />);
    expect(screen.getByText("Today's Activity")).toBeInTheDocument();
  });
});
