import { render, screen } from '@testing-library/react';
import React from 'react';
import { ExcavatorActivityList } from './ExcavatorActivityList';

describe('ExcavatorActivityList', () => {
  const mockActivities = [
    {
      id: 'act-1',
      machine_id: 'm-1',
      operator_id: 'op-1',
      activity_date: '2025-01-01',
      shift_type: 'day' as const,
      passes: 5,
      loads: 20,
      notes: 'Day shift note',
      site_id: 'site-1',
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
      passes: 4,
      loads: 15,
      notes: 'Night shift note',
      site_id: 'site-1',
      block_mined_id: 'block-2',
      machine: { name: 'EX-200' },
      operator: { full_name: 'Jane Smith' },
      site: { name: 'North Pit' },
      block_mined: { name: 'Block B', code: 'BLK-B' },
    },
  ];

  const mockAssignments = [
    {
      id: 'ass-1',
      excavator_activity_id: 'act-1',
      dumper_machine_id: 'd-1',
      material_type: 'Waste',
      total_loads: 10,
      total_bcm: 150,
      notes: null,
      dumper: { name: 'DT-1', bin_factor: 15, machine_type: 'CAT 777' },
    },
    {
      id: 'ass-2',
      excavator_activity_id: 'act-1',
      dumper_machine_id: 'd-2',
      material_type: 'Ore',
      total_loads: 10,
      total_bcm: 180,
      notes: null,
      dumper: { name: 'DT-2', bin_factor: 18, machine_type: 'CAT 777' },
    },
    {
      id: 'ass-3',
      excavator_activity_id: 'act-2',
      dumper_machine_id: 'd-3',
      material_type: 'Waste',
      total_loads: 15,
      total_bcm: 225,
      notes: null,
      dumper: { name: 'DT-3', bin_factor: 15, machine_type: 'Komatsu HD785' },
    },
  ];

  it('renders today activity and assignments aggregated by site and shift', () => {
    render(
      <ExcavatorActivityList todayActivity={mockActivities} todayAssignments={mockAssignments} />
    );

    expect(screen.getByText("Today's Activity")).toBeInTheDocument();
    expect(screen.getAllByText('North Pit').length).toBeGreaterThan(0);
    expect(screen.getByText('555.0 BCM')).toBeInTheDocument();
    expect(screen.getByText('35 loads')).toBeInTheDocument();

    expect(screen.getAllByText('Day Shift').length).toBeGreaterThan(0);
    expect(screen.getByText('EX-100')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('DT-1')).toBeInTheDocument();
    expect(screen.getByText('DT-2')).toBeInTheDocument();

    expect(screen.getAllByText('Night Shift').length).toBeGreaterThan(0);
    expect(screen.getByText('EX-200')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.getByText('DT-3')).toBeInTheDocument();
  });
});
