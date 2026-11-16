import { getOperationalToday } from '@repo/utils/client';
import { fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { getDaysInMonthCount } from '~/app/(departments)/[department]/reports/machine-activity-helpers';
import { DrillingOperationsTable, type DrillOpRow } from './DrillingOperationsTable';

const MONTH_PREFIX_LENGTH = 7;
const EXPECTED_COLUMN_HEADERS = [
  'Date',
  'Start SMR',
  'Stop SMR',
  'Total Worked',
  'Site',
  'Block',
  'Operator',
  'Holes',
  'Meters',
] as const;

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

  it('renders the 9 approved column headers, full-month calendar rows, and monthly totals footer', () => {
    const today = getOperationalToday();
    const expectedMonthDays = getDaysInMonthCount(today.slice(0, MONTH_PREFIX_LENGTH));

    render(
      <DrillingOperationsTable
        departmentId="drilling"
        drills={mockDrills}
        operators={mockOperators}
        initialOps={mockInitialOps}
      />
    );

    // Fleet KPI summary cards
    expect(screen.getByText(/250\.0m/)).toBeInTheDocument();
    expect(screen.getAllByText('50').length).toBeGreaterThan(0);
    expect(screen.getByText(/20\.0h/)).toBeInTheDocument();
    expect(screen.getByText('2 / 2')).toBeInTheDocument();

    // 9 approved column headers
    const columnHeaders = screen.getAllByRole('columnheader');
    expect(columnHeaders).toHaveLength(EXPECTED_COLUMN_HEADERS.length);
    EXPECTED_COLUMN_HEADERS.forEach((headerText, idx) => {
      expect(columnHeaders[idx]).toHaveTextContent(headerText);
    });

    // Full month calendar rows in tbody + 1 header row + 1 footer row
    const allRows = screen.getAllByRole('row');
    const expectedTotalRows = expectedMonthDays + 1 + 1;
    expect(allRows).toHaveLength(expectedTotalRows);

    // Default selected machine DR-01 values
    expect(screen.getAllByText('DR-01 (Sandvik DR412i)').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Block 101').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Pit North').length).toBeGreaterThan(0);
    expect(screen.getAllByText('John Drill').length).toBeGreaterThan(0);
    expect(screen.getAllByText('100.0').length).toBeGreaterThan(0);
    expect(screen.getAllByText('110.0').length).toBeGreaterThan(0);
    expect(screen.getByText('10.00h')).toBeInTheDocument();

    // Monthly Totals footer row
    const totalsRow = screen.getByTestId('machine-30d-totals-row');
    expect(totalsRow).toBeInTheDocument();
    expect(
      within(totalsRow).getByText(
        new RegExp(`Monthly Total \\(${expectedMonthDays} Days · DR-01 \\(Sandvik DR412i\\)\\)`)
      )
    ).toBeInTheDocument();
    expect(within(totalsRow).getByText('10.0h')).toBeInTheDocument();
    expect(within(totalsRow).getByText('150.0m')).toBeInTheDocument();
  });

  it('switches machines via Next button, selector, and rig pills to display DR-02 monthly calendar rows', () => {
    render(
      <DrillingOperationsTable
        departmentId="drilling"
        drills={mockDrills}
        operators={mockOperators}
        initialOps={mockInitialOps}
      />
    );

    // Switch to DR-02 using Next button
    const nextMachineBtn = screen.getByTestId('next-machine-30d-btn');
    fireEvent.click(nextMachineBtn);

    expect(screen.getAllByText('Block 202').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Pit South').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Jane Rig').length).toBeGreaterThan(0);
    expect(screen.getAllByText('200.0').length).toBeGreaterThan(0);
    expect(screen.getAllByText('210.0').length).toBeGreaterThan(0);
    expect(screen.getByText('10.00h')).toBeInTheDocument();
    expect(screen.getAllByText('20').length).toBeGreaterThan(0);
    expect(screen.getAllByText('100.0m').length).toBeGreaterThan(0);

    // Switch back to DR-01 via rig pill
    const dr01Pill = screen.getByTestId('rig-pill-m-dr-1');
    fireEvent.click(dr01Pill);
    expect(screen.getAllByText('Block 101').length).toBeGreaterThan(0);

    // Switch to DR-02 via machine selector dropdown
    const selector = screen.getByTestId('machine-30d-selector');
    fireEvent.change(selector, { target: { value: 'm-dr-2' } });
    expect(screen.getAllByText('Block 202').length).toBeGreaterThan(0);
  });

  it('filters operations and updates KPI metrics and row values when shift filter buttons are clicked', () => {
    render(
      <DrillingOperationsTable
        departmentId="drilling"
        drills={mockDrills}
        operators={mockOperators}
        initialOps={mockInitialOps}
      />
    );

    // Initial state: All Shifts (250.0m fleet total)
    expect(screen.getByText(/250\.0m/)).toBeInTheDocument();

    // Click Day Shift filter button
    const dayFilterBtn = screen.getByRole('button', { name: /^Day$/i });
    fireEvent.click(dayFilterBtn);

    // Day Shift only totals: 150.0m, 30 holes, 10.0h, 1 active rig
    expect(screen.getAllByText(/150\.0m/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('30').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/10\.0h/).length).toBeGreaterThan(0);
    expect(screen.getByText('1 / 2')).toBeInTheDocument();

    // Click Night Shift filter button
    const nightFilterBtn = screen.getByRole('button', { name: /^Night$/i });
    fireEvent.click(nightFilterBtn);

    // Night Shift only fleet totals: 100.0m, 20 holes, 10.0h, 1 active rig
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

    // 58.5 - 50.0 = 8.5h (fleet KPI and footer) and 8.50h (row)
    expect(screen.getAllByText(/8\.5h/).length).toBeGreaterThan(0);
    expect(screen.getByText('8.50h')).toBeInTheDocument();
    expect(screen.getAllByText(/75\.0m/).length).toBeGreaterThan(0);
  });
});
