import React from 'react';
import { render, screen } from '@testing-library/react';
import { ExcavatorActivityList } from './ExcavatorActivityList';

describe('ExcavatorActivityList', () => {
  const mockActivities = [
    {
      id: 'act-1',
      machine_id: 'm-1',
      operator_id: 'op-1',
      activity_date: '2025-01-15',
      shift_type: 'day' as const,
      passes: 10,
      loads: 50,
      notes: 'Day shift running smooth',
      site_id: 'site-a',
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
      activity_date: '2025-01-15',
      shift_type: 'night' as const,
      passes: 8,
      loads: 40,
      notes: null,
      site_id: 'site-a',
      block_mined_id: null,
      machine: { name: 'EX-02' },
      operator: { full_name: 'Jane Smith' },
      site: { name: 'North Pit' },
      block_mined: null,
    },
    {
      id: 'act-3',
      machine_id: 'm-3',
      operator_id: null,
      activity_date: '2025-01-15',
      shift_type: 'day' as const,
      passes: 5,
      loads: 20,
      notes: null,
      site_id: null,
      block_mined_id: null,
      machine: { name: 'EX-03' },
      operator: null,
      site: null,
      block_mined: null,
    },
  ];

  const mockAssignments = [
    {
      id: 'asgn-1',
      excavator_activity_id: 'act-1',
      dumper_machine_id: 'd-1',
      material_type: 'Coal',
      total_loads: 30,
      total_bcm: 150.5,
      notes: null,
      dumper: { name: 'DT-101', bin_factor: 5, machine_type: 'CAT 777' },
    },
    {
      id: 'asgn-2',
      excavator_activity_id: 'act-1',
      dumper_machine_id: 'd-2',
      material_type: 'Waste',
      total_loads: 20,
      total_bcm: 100.0,
      notes: null,
      dumper: { name: 'DT-102', bin_factor: 5, machine_type: 'CAT 777' },
    },
    {
      id: 'asgn-3',
      excavator_activity_id: 'act-2',
      dumper_machine_id: 'd-3',
      material_type: 'Overburden',
      total_loads: 40,
      total_bcm: 200.0,
      notes: null,
      dumper: { name: 'DT-103', bin_factor: 5, machine_type: 'Komatsu' },
    },
  ];

  it('renders today activity heading and groups activities by site', () => {
    render(
      <ExcavatorActivityList
        todayActivity={mockActivities}
        todayAssignments={mockAssignments}
      />
    );

    expect(screen.getByText("Today's Activity")).toBeInTheDocument();
    expect(screen.getAllByText('North Pit').length).toBeGreaterThan(0);
    expect(screen.getByText('No Site Assigned')).toBeInTheDocument();
  });

  it('calculates and renders site level BCM and loads totals correctly', () => {
    render(
      <ExcavatorActivityList
        todayActivity={mockActivities}
        todayAssignments={mockAssignments}
      />
    );

    // North Pit site totals: act-1 (150.5 + 100.0 = 250.5) + act-2 (200.0) = 450.5 BCM
    expect(screen.getByText('450.5 BCM')).toBeInTheDocument();
    // North Pit site loads: 30 + 20 + 40 = 90 loads
    expect(screen.getByText('90 loads')).toBeInTheDocument();
  });

  it('renders shift badges and machine details for day and night shifts', () => {
    render(
      <ExcavatorActivityList
        todayActivity={mockActivities}
        todayAssignments={mockAssignments}
      />
    );

    expect(screen.getByText('EX-01')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Block A1')).toBeInTheDocument();

    expect(screen.getByText('EX-02')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();

    expect(screen.getAllByText('Day Shift').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Night Shift').length).toBeGreaterThan(0);
  });

  it('renders dumper assignments table for activities with assignments', () => {
    render(
      <ExcavatorActivityList
        todayActivity={mockActivities}
        todayAssignments={mockAssignments}
      />
    );

    expect(screen.getByText('DT-101')).toBeInTheDocument();
    expect(screen.getByText('Coal')).toBeInTheDocument();
    expect(screen.getByText('150.5')).toBeInTheDocument();

    expect(screen.getByText('DT-102')).toBeInTheDocument();
    expect(screen.getByText('Waste')).toBeInTheDocument();
    expect(screen.getByText('100.0')).toBeInTheDocument();

    expect(screen.getByText('Overburden')).toBeInTheDocument();
  });

  it('renders no dumper assignments fallback message when activity has no assignments', () => {
    render(
      <ExcavatorActivityList
        todayActivity={mockActivities}
        todayAssignments={mockAssignments}
      />
    );

    expect(screen.getByText('No dumper assignments')).toBeInTheDocument();
  });
});
