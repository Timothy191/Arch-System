import { render, screen } from '@testing-library/react';
import { ExcavatorActivityList } from './ExcavatorActivityList';

describe('ExcavatorActivityList', () => {
  const mockActivity = [
    {
      id: 'act-1',
      machine_id: 'm-1',
      operator_id: 'op-1',
      activity_date: '2025-01-01',
      shift_type: 'day' as const,
      passes: 10,
      loads: 5,
      notes: 'Day shift note',
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
      activity_date: '2025-01-01',
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
      dumper_machine_id: 'dt-1',
      material_type: 'Coal',
      total_loads: 5,
      total_bcm: 120.5,
      notes: null,
      dumper: {
        name: 'DT-101',
        bin_factor: 24.1,
        machine_type: 'Dump Truck',
      },
    },
    {
      id: 'assign-2',
      excavator_activity_id: 'act-2',
      dumper_machine_id: 'dt-2',
      material_type: 'Overburden',
      total_loads: 4,
      total_bcm: 80.0,
      notes: null,
      dumper: {
        name: 'DT-102',
        bin_factor: 20.0,
        machine_type: 'Dump Truck',
      },
    },
  ];

  it('renders today activity heading and site sections', () => {
    render(
      <ExcavatorActivityList
        todayActivity={mockActivity}
        todayAssignments={mockAssignments}
      />
    );

    expect(screen.getByText("Today's Activity")).toBeInTheDocument();
    expect(screen.getByText('North Pit')).toBeInTheDocument();
    expect(screen.getByText('200.5 BCM')).toBeInTheDocument();
    expect(screen.getByText('9 loads')).toBeInTheDocument();
  });

  it('renders day and night shift activities with dumper assignments', () => {
    render(
      <ExcavatorActivityList
        todayActivity={mockActivity}
        todayAssignments={mockAssignments}
      />
    );

    expect(screen.getByText('EX-01')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Block A1')).toBeInTheDocument();
    expect(screen.getByText('DT-101')).toBeInTheDocument();
    expect(screen.getByText('Coal')).toBeInTheDocument();

    expect(screen.getByText('EX-02')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.getByText('DT-102')).toBeInTheDocument();
    expect(screen.getByText('Overburden')).toBeInTheDocument();
  });
});
