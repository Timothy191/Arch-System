import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DrillingOperationsTable, type DrillOpRow } from './DrillingOperationsTable';

describe('DrillingOperationsTable', () => {
  const mockDrills = [
    { id: 'm-dr-1', name: 'DR-01 (Sandvik DR412i)' },
    { id: 'm-dr-2', name: 'DR-02 (Epiroc Pit Viper)' },
  ];

  const mockOperators = [
    { id: 'op-1', full_name: 'John Drill' },
    { id: 'op-2', full_name: 'Jane Rig' },
  ];

  const mockInitialOps: DrillOpRow[] = [
    {
      id: 'op-1',
      machine_id: 'm-dr-1',
      shift_type: 'day',
      open_hours: 100.0,
      close_hours: 110.0,
      total_hours: 10.0,
      holes: 30,
      meters_drilled: 150.0,
      operator_name: 'John Drill',
      block_drilled: 'Block 101',
      site: 'Pit North',
      external_delays_minutes: 15,
      standard_delays_hours: 0,
      production_delays_minutes: 15,
      engineering_delays_minutes: 0,
      comments: 'Normal operation',
      status: 'completed',
    },
    {
      id: 'op-2',
      machine_id: 'm-dr-2',
      shift_type: 'night',
      open_hours: 200.0,
      close_hours: 210.0,
      total_hours: 10.0,
      holes: 20,
      meters_drilled: 100.0,
      operator_name: 'Jane Rig',
      block_drilled: 'Block 202',
      site: 'Pit South',
      external_delays_minutes: 0,
      standard_delays_hours: 0,
      production_delays_minutes: 0,
      engineering_delays_minutes: 0,
      comments: 'Night shift run',
      status: 'active',
    },
  ];

  it('renders empty state message when drills array is empty', () => {
    render(
      <DrillingOperationsTable
        departmentId="drilling"
        drills={[]}
        operators={mockOperators}
        initialOps={mockInitialOps}
      />
    );

    expect(
      screen.getByText(/No active drill rigs registered. Add rigs in the Machines section first./i)
    ).toBeInTheDocument();
  });

  it('renders drilling operations table and auto-compiled KPI summary metrics correctly', () => {
    render(
      <DrillingOperationsTable
        departmentId="drilling"
        drills={mockDrills}
        operators={mockOperators}
        initialOps={mockInitialOps}
      />
    );

    // Meters Drilled: 150 + 100 = 250.0m
    expect(screen.getByText(/250\.0m/)).toBeInTheDocument();
    // Holes Drilled: 30 + 20 = 50
    expect(screen.getAllByText('50').length).toBeGreaterThan(0);
    // Operating Hours: 10.0 + 10.0 = 20.0h
    expect(screen.getByText(/20\.0h/)).toBeInTheDocument();
    // Active Rigs: 2 / 2
    expect(screen.getByText('2 / 2')).toBeInTheDocument();

    // Table entries across shifts
    expect(screen.getAllByText('DR-01 (Sandvik DR412i)').length).toBeGreaterThan(0);
    expect(screen.getAllByText('DR-02 (Epiroc Pit Viper)').length).toBeGreaterThan(0);
    expect(screen.getByText('Block 101')).toBeInTheDocument();
    expect(screen.getByText('Block 202')).toBeInTheDocument();
    expect(screen.getByText('John Drill')).toBeInTheDocument();
    expect(screen.getByText('Jane Rig')).toBeInTheDocument();
  });

  it('filters operations and updates KPI metrics when shift filter buttons are clicked', () => {
    render(
      <DrillingOperationsTable
        departmentId="drilling"
        drills={mockDrills}
        operators={mockOperators}
        initialOps={mockInitialOps}
      />
    );

    // Initial state: All Shifts (250.0m)
    expect(screen.getByText(/250\.0m/)).toBeInTheDocument();

    // Click Day Shift filter button
    const dayFilterBtn = screen.getByRole('button', { name: /^Day$/i });
    fireEvent.click(dayFilterBtn);

    // Day Shift only totals: 150.0m, 30 holes, 10.0h, 1 active rig
    expect(screen.getAllByText(/150\.0m/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('30').length).toBeGreaterThan(0);
    expect(screen.getByText(/10\.0h/)).toBeInTheDocument();
    expect(screen.getByText('1 / 2')).toBeInTheDocument();

    // Click Night Shift filter button
    const nightFilterBtn = screen.getByRole('button', { name: /^Night$/i });
    fireEvent.click(nightFilterBtn);

    // Night Shift only totals: 100.0m, 20 holes, 10.0h, 1 active rig
    expect(screen.getAllByText(/100\.0m/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('20').length).toBeGreaterThan(0);

    // Click All Shifts filter button
    const allFilterBtn = screen.getByRole('button', { name: /All Shifts/i });
    fireEvent.click(allFilterBtn);

    expect(screen.getByText(/250\.0m/)).toBeInTheDocument();
  });

  it('calculates duration from close_hours and open_hours when total_hours is null', () => {
    const opsWithoutTotalHours: DrillOpRow[] = [
      {
        id: 'op-3',
        machine_id: 'm-dr-1',
        shift_type: 'day',
        open_hours: 50.0,
        close_hours: 58.5,
        total_hours: null,
        holes: 15,
        meters_drilled: 75.0,
        operator_name: 'John Drill',
        block_drilled: 'Block 303',
        site: 'Pit East',
        external_delays_minutes: 0,
        standard_delays_hours: 0,
        production_delays_minutes: 0,
        engineering_delays_minutes: 0,
        comments: null,
        status: 'active',
      },
    ];

    render(
      <DrillingOperationsTable
        departmentId="drilling"
        drills={mockDrills}
        operators={mockOperators}
        initialOps={opsWithoutTotalHours}
      />
    );

    // 58.5 - 50.0 = 8.5h
    expect(screen.getByText(/8\.5h/)).toBeInTheDocument();
    expect(screen.getAllByText(/75\.0m/).length).toBeGreaterThan(0);
  });
});
