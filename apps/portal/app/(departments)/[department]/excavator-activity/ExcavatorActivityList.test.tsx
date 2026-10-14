import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ExcavatorActivityList } from './ExcavatorActivityList';

describe('ExcavatorActivityList', () => {
  const mockActivities = [
    {
      id: 'act-1',
      machine_id: 'm-1',
      operator_id: 'op-1',
      activity_date: '2025-02-20',
      shift_type: 'day' as const,
      passes: 10,
      loads: 5,
      notes: 'Day shift smooth operation',
      site_id: 'site-a',
      block_mined_id: 'bm-1',
      machine: { name: 'EX-01 (CAT 6060)' },
      operator: { full_name: 'John Doe' },
      site: { name: 'Pit North' },
      block_mined: { name: 'Block 101', code: '101' },
    },
    {
      id: 'act-2',
      machine_id: 'm-2',
      operator_id: 'op-2',
      activity_date: '2025-02-20',
      shift_type: 'night' as const,
      passes: 8,
      loads: 4,
      notes: null,
      site_id: 'site-a',
      block_mined_id: null,
      machine: { name: 'EX-02 (Komatsu PC8000)' },
      operator: { full_name: 'Jane Smith' },
      site: { name: 'Pit North' },
      block_mined: null,
    },
  ];

  const mockAssignments = [
    {
      id: 'assign-1',
      excavator_activity_id: 'act-1',
      dumper_machine_id: 'd-1',
      material_type: 'Coal',
      total_loads: 5,
      total_bcm: 125.0,
      notes: null,
      dumper: { name: 'DT-01', bin_factor: 25, machine_type: 'CAT 777' },
    },
    {
      id: 'assign-2',
      excavator_activity_id: 'act-2',
      dumper_machine_id: 'd-2',
      material_type: 'Waste',
      total_loads: 4,
      total_bcm: 100.0,
      notes: null,
      dumper: { name: 'DT-02', bin_factor: 25, machine_type: 'CAT 777' },
    },
  ];

  it('renders today activity heading and site header', () => {
    render(
      <ExcavatorActivityList todayActivity={mockActivities} todayAssignments={mockAssignments} />
    );

    expect(screen.getByText("Today's Activity")).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 4, name: /Pit North/i })).toBeInTheDocument();
  });

  it('renders shift sections and machine information', () => {
    render(
      <ExcavatorActivityList todayActivity={mockActivities} todayAssignments={mockAssignments} />
    );

    expect(screen.getAllByText(/Day Shift/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Night Shift/i).length).toBeGreaterThan(0);
    expect(screen.getByText('EX-01 (CAT 6060)')).toBeInTheDocument();
    expect(screen.getByText('EX-02 (Komatsu PC8000)')).toBeInTheDocument();
  });

  it('correctly maps pre-indexed dumper assignments to excavator activity cards', () => {
    render(
      <ExcavatorActivityList todayActivity={mockActivities} todayAssignments={mockAssignments} />
    );

    expect(screen.getByText('Coal')).toBeInTheDocument();
    expect(screen.getByText('Waste')).toBeInTheDocument();
    expect(screen.getAllByText('125.0').length).toBeGreaterThan(0);
    expect(screen.getAllByText('100.0').length).toBeGreaterThan(0);
  });

  it('calculates aggregate site loads and BCM totals', () => {
    render(
      <ExcavatorActivityList todayActivity={mockActivities} todayAssignments={mockAssignments} />
    );

    // Total site BCM = 125 + 100 = 225.0 BCM
    expect(screen.getByText('225.0 BCM')).toBeInTheDocument();
    // Total site loads = 5 + 4 = 9 loads
    expect(screen.getByText('9 loads')).toBeInTheDocument();
  });
});
