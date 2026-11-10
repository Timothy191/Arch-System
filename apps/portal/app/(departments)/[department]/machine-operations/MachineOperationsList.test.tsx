import { DepartmentLayout } from '@repo/ui/DepartmentLayout';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MachineOperationsFilterableTable } from './MachineOperationsFilterableTable';
import { MachineOperationsForm } from './MachineOperationsForm';
import { MachineOperationsKpiStrip } from './MachineOperationsKpiStrip';
import { MachineOperationsList } from './MachineOperationsList';

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: jest.fn(),
  }),
  usePathname: () => '/control-room/machine-operations',
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock('@repo/supabase/client', () => ({
  createBrowserSupabaseClient: () => ({
    from: () => ({
      insert: () => ({
        select: () => ({
          single: jest.fn().mockResolvedValue({ data: { id: 'op-new' }, error: null }),
        }),
      }),
    }),
  }),
}));

jest.mock('@/actions/shift-sheet-cache', () => ({
  invalidateShiftSheetCache: jest.fn().mockResolvedValue(undefined),
}));

describe('MachineOperationsList', () => {
  const mockOperations = [
    {
      id: 'op-1',
      machine_id: 'm-1',
      operator_id: 'op-1',
      site_id: 'site-a',
      shift_type: 'day' as const,
      start_time: '07:00:00',
      end_time: '19:00:00',
      hours_worked: 12.0,
      start_smu: 1000,
      end_smu: 1012,
      block_drilled: 'B-101',
      meters_drilled: 120.5,
      holes_drilled: 24,
      machine: {
        name: 'EX-101 (CAT 6060)',
        machine_type: 'Excavator',
        bin_factor: 25.0,
        serial_number: 'SN-EX101',
      },
      operator: { full_name: 'John Doe' },
      site: { name: 'Pit North' },
      delay_entries: [
        {
          id: 'del-1',
          delay_category_id: 'cat-1',
          delay_start_time: '09:00',
          delay_end_time: '09:30',
          duration_hours: 0.5,
          is_manual_override: false,
          status: 'committed' as const,
          delay_category: { name: 'Refueling' },
        },
      ],
    },
    {
      id: 'op-2',
      machine_id: 'm-2',
      operator_id: 'op-2',
      site_id: 'site-a',
      shift_type: 'night' as const,
      start_time: '19:00:00',
      end_time: null,
      hours_worked: 6.0,
      start_smu: 500,
      end_smu: null,
      machine: {
        name: 'DT-201 (CAT 777)',
        machine_type: 'Dumper',
        bin_factor: 0,
        serial_number: 'SN-DT201',
      },
      operator: { full_name: 'Jane Smith' },
      site: { name: 'Pit North' },
    },
  ];

  const mockTodayLoads = [
    {
      machine_id: 'm-1',
      shift_type: 'day',
      total_loads: 10,
    },
  ];

  const mockActiveBreakdowns = [
    {
      id: 'bd-1',
      fleet_id: 'm-1',
      reason: 'Hydraulic leak',
      repair_notes: 'Replacing O-ring',
      status: 'active',
      date_in: '2025-02-20T10:00:00Z',
      date_out: null,
    },
  ];

  it('renders empty state message when operations array is empty', () => {
    render(<MachineOperationsList operations={[]} todayLoads={[]} />);

    expect(
      screen.getByText(/No operations logged today. Use the form above to add operations./i)
    ).toBeInTheDocument();
  });

  it('renders site headers, shift sections, and machine operation details', () => {
    render(
      <MachineOperationsList
        operations={mockOperations}
        todayLoads={mockTodayLoads}
        activeBreakdowns={mockActiveBreakdowns}
      />
    );

    expect(screen.getAllByText('Pit North').length).toBeGreaterThan(0);
    expect(screen.getByText(/Day Shift \(1\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Night Shift \(1\)/i)).toBeInTheDocument();
    expect(screen.getByText('EX-101 (CAT 6060)')).toBeInTheDocument();
    expect(screen.getByText('DT-201 (CAT 777)')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
  });

  it('calculates pre-indexed material BCM metrics correctly', () => {
    render(
      <MachineOperationsList
        operations={mockOperations}
        todayLoads={mockTodayLoads}
        activeBreakdowns={[]}
      />
    );

    // 10 loads * 25.0 bin_factor = 250.0 BCM
    expect(screen.getAllByText('250.0 BCM').length).toBeGreaterThan(0);
    // 250.0 BCM / 12.0 hours = 20.8 BCM/h
    expect(screen.getByText('20.8 BCM/h')).toBeInTheDocument();
  });

  it('matches breakdown by pre-indexed fleet_id and displays active breakdown alert', () => {
    render(
      <MachineOperationsList
        operations={mockOperations}
        todayLoads={mockTodayLoads}
        activeBreakdowns={mockActiveBreakdowns}
      />
    );

    expect(screen.getByText('Active Breakdown')).toBeInTheDocument();
    expect(screen.getByText(/Engineering Breakdown: Hydraulic leak/i)).toBeInTheDocument();
  });

  it('toggles delay summary view on button click', () => {
    render(
      <MachineOperationsList
        operations={mockOperations}
        todayLoads={mockTodayLoads}
        activeBreakdowns={[]}
      />
    );

    const toggleButton = screen.getByRole('button', { name: /1 delay/i });
    expect(toggleButton).toBeInTheDocument();
    expect(screen.queryByText('Refueling')).not.toBeInTheDocument();

    fireEvent.click(toggleButton);

    expect(screen.getByText('Refueling')).toBeInTheDocument();
    expect(screen.getByText('0.50h')).toBeInTheDocument();
  });

  it('displays fixed Dozer Roll-over amount (hours worked * 250 BCM)', () => {
    render(
      <MachineOperationsList
        operations={[
          {
            id: 'op-dozer',
            machine_id: 'dz-1',
            operator_id: 'op-3',
            site_id: 'site-a',
            shift_type: 'day',
            start_time: '06:00:00',
            end_time: '14:00:00',
            hours_worked: 8.0,
            start_smu: 2000,
            end_smu: 2008,
            machine: {
              name: 'DZ-401 (CAT D10T)',
              machine_type: 'Dozer',
              bin_factor: 0,
              serial_number: 'SN-DZ401',
            },
            operator: { full_name: 'Sam Dozer' },
            site: { name: 'Stockpile A' },
          },
        ]}
        todayLoads={[]}
        activeBreakdowns={[]}
      />
    );

    // 8.0 hours * 250 = 2000.0 BCM
    expect(screen.getByText(/Roll-over: 2000\.0 BCM/i)).toBeInTheDocument();
    expect(screen.getByText('250.0 BCM/h')).toBeInTheDocument();
  });

  describe('Fleet Machines Mode (when machines prop is provided)', () => {
    const mockMachines = [
      {
        id: 'm-1',
        name: 'EX-101 (CAT 6060)',
        machine_type: 'Excavator',
        serial_number: 'SN-EX101',
        site_id: 'site-a',
        latest_smu: 1012,
        site: { name: 'Pit North' },
      },
      {
        id: 'm-2',
        name: 'DT-201 (CAT 777)',
        machine_type: 'Dumper',
        serial_number: 'SN-DT201',
        site_id: 'site-a',
        latest_smu: 500,
        site: { name: 'Pit North' },
      },
      {
        id: 'm-3',
        name: 'DR-301 (Sandvik DR410i)',
        machine_type: 'Drill Rig',
        serial_number: 'SN-DR301',
        site_id: 'site-b',
        latest_smu: 1420.5,
        site: { name: 'South Ridge' },
      },
    ];

    it('lists all fleet machines even when operations array is empty', () => {
      render(
        <MachineOperationsList
          machines={mockMachines}
          operations={[]}
          todayLoads={[]}
          activeBreakdowns={[]}
        />
      );

      // Does not show empty message
      expect(
        screen.queryByText(/No operations logged today. Use the form above to add operations./i)
      ).not.toBeInTheDocument();

      // Renders all machines
      expect(screen.getByText('EX-101 (CAT 6060)')).toBeInTheDocument();
      expect(screen.getByText('DT-201 (CAT 777)')).toBeInTheDocument();
      expect(screen.getByText('DR-301 (Sandvik DR410i)')).toBeInTheDocument();

      // Displays latest SMR values
      expect(screen.getByText('SMR 1012.0')).toBeInTheDocument();
      expect(screen.getByText('SMR 500.0')).toBeInTheDocument();
      expect(screen.getByText('SMR 1420.5')).toBeInTheDocument();

      // Shows standby status for all machines
      expect(screen.getAllByText('Standby').length).toBe(3);
      expect(screen.getAllByText(/Standby — No operations logged today/i).length).toBe(3);
    });

    it('displays operating status and shifts when machine has operations logged', () => {
      render(
        <MachineOperationsList
          machines={mockMachines}
          operations={[mockOperations[0]]}
          todayLoads={mockTodayLoads}
          activeBreakdowns={[]}
        />
      );

      // EX-101 should be operating
      expect(screen.getByText('12.0h logged')).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();

      // Other 2 machines should remain in standby
      expect(screen.getAllByText('Standby').length).toBe(2);
    });

    it('filters machines by status tab when clicked', () => {
      render(
        <MachineOperationsList
          machines={mockMachines}
          operations={[mockOperations[0]]}
          todayLoads={mockTodayLoads}
          activeBreakdowns={mockActiveBreakdowns}
        />
      );

      // Click "Standby (2)" filter
      const standbyBtn = screen.getByRole('button', { name: /Standby \(2\)/i });
      fireEvent.click(standbyBtn);

      // Operating machine should be filtered out
      expect(screen.queryByText('EX-101 (CAT 6060)')).not.toBeInTheDocument();
      // Standby machines should remain visible
      expect(screen.getByText('DT-201 (CAT 777)')).toBeInTheDocument();
      expect(screen.getByText('DR-301 (Sandvik DR410i)')).toBeInTheDocument();
    });

    it('searches and filters machines by query string', () => {
      render(
        <MachineOperationsList
          machines={mockMachines}
          operations={[]}
          todayLoads={[]}
          activeBreakdowns={[]}
        />
      );

      const searchInput = screen.getByPlaceholderText(/Search machine, type, or SN.../i);
      fireEvent.change(searchInput, { target: { value: 'Sandvik' } });

      expect(screen.getByText('DR-301 (Sandvik DR410i)')).toBeInTheDocument();
      expect(screen.queryByText('EX-101 (CAT 6060)')).not.toBeInTheDocument();
      expect(screen.queryByText('DT-201 (CAT 777)')).not.toBeInTheDocument();
    });
  });

  describe('MachineOperationsForm Dozer Activity Selection (Roll Over vs Other)', () => {
    const dozerMachines = [
      {
        id: 'dz-22',
        name: 'BD-22',
        machine_type: 'Dozer',
        serial_number: 'SN-BD22',
        site_id: 'site-a',
        latest_smu: 1271,
      },
      {
        id: 'ex-101',
        name: 'EX-101',
        machine_type: 'Excavator',
        serial_number: 'SN-EX101',
        site_id: 'site-a',
        latest_smu: 1000,
      },
    ];

    it('renders the Dozer Activity Type section with Roll Over and Other checkboxes when a Dozer is selected', () => {
      render(
        <MachineOperationsForm
          departmentId="dept-cr"
          machines={dozerMachines}
          operators={[{ id: 'op-1', full_name: 'Sam Dozer', employee_code: 'EMP-01' }]}
          sites={[{ id: 'site-a', name: 'Pit North', site_code: 'BKF' }]}
          todayOperations={[]}
        />
      );

      expect(screen.queryByTestId('dozer-activity-section')).not.toBeInTheDocument();

      const selects = screen.getAllByRole('combobox');
      fireEvent.change(selects[0]!, { target: { value: 'dz-22' } });

      expect(screen.getByTestId('dozer-activity-section')).toBeInTheDocument();
      const rolloverCheckbox = screen.getByTestId('dozer-activity-rollover') as HTMLInputElement;
      const otherCheckbox = screen.getByTestId('dozer-activity-other') as HTMLInputElement;

      expect(rolloverCheckbox.checked).toBe(true);
      expect(otherCheckbox.checked).toBe(false);

      // Switch to Other
      fireEvent.click(otherCheckbox);
      expect(rolloverCheckbox.checked).toBe(false);
      expect(otherCheckbox.checked).toBe(true);
      expect(screen.getByLabelText('Other dozer activity details')).toBeInTheDocument();
      expect(screen.getByTestId('dozer-rollover-summary')).toHaveTextContent('0 BCM');
    });

    it('allows marking a machine as ending shift on breakdown to auto-carry over into the new shift', () => {
      render(
        <MachineOperationsForm
          departmentId="dept-cr"
          machines={dozerMachines}
          operators={[{ id: 'op-1', full_name: 'Sam Dozer', employee_code: 'EMP-01' }]}
          sites={[{ id: 'site-a', name: 'Pit North', site_code: 'BKF' }]}
          todayOperations={[]}
        />
      );

      const endsOnBreakdownCheckbox = screen.getByTestId(
        'machine-ops-ends-on-breakdown'
      ) as HTMLInputElement;
      expect(endsOnBreakdownCheckbox.checked).toBe(false);
      expect(screen.queryByLabelText('Breakdown carry-over reason')).not.toBeInTheDocument();

      fireEvent.click(endsOnBreakdownCheckbox);
      expect(endsOnBreakdownCheckbox.checked).toBe(true);
      const reasonInput = screen.getByLabelText('Breakdown carry-over reason');
      expect(reasonInput).toBeInTheDocument();
      fireEvent.change(reasonInput, { target: { value: 'Final drive oil leak at end of shift' } });
      expect(reasonInput).toHaveValue('Final drive oil leak at end of shift');
    });
  });

  describe('Design Feedback Verification: Search Pill & Sidebar Bordering', () => {
    it('renders visible pill-shaped search inputs with golden bordering in MachineOperationsFilterableTable', () => {
      render(
        <MachineOperationsFilterableTable
          machines={[
            {
              id: 'm-1',
              name: 'BD-22',
              machine_type: 'Dozer',
              serial_number: 'SN-BD22',
              site_id: 'site-a',
              latest_smu: 1200,
              site: { name: 'Pit North' },
            },
          ]}
          operations={[]}
        />
      );

      const searchInputs = screen.getAllByPlaceholderText(/Search machine, type, or SN\.\.\./i);
      expect(searchInputs.length).toBeGreaterThanOrEqual(2);
      for (const input of searchInputs) {
        expect(input.className).toContain('rounded-full');
        expect(input.className).toContain('gold-steel-border');
        expect(input.className).toContain('gold-steel-border-slim');
      }
    });

    it('renders active Machine Operations sidebar tab without left vertical bar and with refined golden bordering', () => {
      render(
        <DepartmentLayout
          department={{
            name: 'control-room',
            displayName: 'Control Room',
            icon: 'Radio',
            color: 'blue',
          }}
          tabs={[
            { name: 'dashboard', label: 'Dashboard', icon: 'BarChart2' },
            { name: 'machine-operations', label: 'Machine Operations', icon: 'Cpu' },
          ]}
        >
          <div>Content</div>
        </DepartmentLayout>
      );

      const machineOpsLink = screen.getByRole('link', { name: /Machine Operations/i });
      expect(machineOpsLink.className).toContain('gold-steel-border');
      expect(machineOpsLink.className).toContain('border-accent-amber/55');
      expect(machineOpsLink.className).toContain('ring-1');
      // Verify the small straight vertical line on the left (w-1 h-5) is removed
      expect(machineOpsLink.querySelector('.h-5.w-1')).toBeNull();
    });
  });

  describe('7 Design Feedback Items Verification', () => {
    // 1. Sites: Head Office & Brakfontein Plant
    it('supports selecting Head Office and Brakfontein Plant in MachineOperationsForm', () => {
      const sites = [
        { id: 'site-ho', name: 'Head Office', site_code: 'HEAD-OFFICE' },
        { id: 'site-bp', name: 'Brakfontein Plant', site_code: 'BRAK-PLANT' },
        { id: 'site-pit', name: 'Brakfontein Pit', site_code: 'BRAK-PIT' },
      ];
      render(
        <MachineOperationsForm
          departmentId="dept-cr"
          machines={[{ id: 'm-1', name: 'BD-22', machine_type: 'Dozer' }]}
          operators={[{ id: 'op-1', full_name: 'John Doe', employee_code: 'OP-BD01' }]}
          sites={sites}
          todayOperations={[]}
        />
      );

      expect(screen.getByRole('option', { name: 'Head Office' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Brakfontein Plant' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Brakfontein Pit' })).toBeInTheDocument();
    });

    // 2. Tip Readability
    it('renders static accessible operational guidance callout without animate-pulse', () => {
      render(
        <MachineOperationsForm
          departmentId="dept-cr"
          machines={[]}
          operators={[]}
          sites={[]}
          todayOperations={[]}
        />
      );

      const callout = screen.getByRole('note', { name: /SMR logging guidance/i });
      expect(callout).toBeInTheDocument();
      expect(callout.className).not.toContain('animate-pulse');
      expect(screen.getByText(/Operational Tip:/i)).toBeInTheDocument();
      expect(screen.getByText(/Stop SMR is optional at start of shift/i)).toBeInTheDocument();
    });

    // 3. Drill Rig Fields & Penetration Rate
    it('renders Holes, Meters, Block, and auto-calculates Penetration Rate for Drill Rigs', () => {
      const drillMachines = [
        { id: 'dr-1', name: 'DR-02', machine_type: 'Drill Rig', latest_smu: 2000 },
      ];
      render(
        <MachineOperationsForm
          departmentId="dept-cr"
          machines={drillMachines}
          operators={[{ id: 'op-dr', full_name: 'Drill Op', employee_code: 'OP-DR01' }]}
          sites={[{ id: 'site-pit', name: 'Brakfontein Pit', site_code: 'BRAK-PIT' }]}
          mineBlocks={[
            { id: 'blk-1', name: 'North Pit Bench 12', code: 'BLK-A1', site_id: 'site-pit' },
          ]}
          todayOperations={[]}
        />
      );

      // Select drill
      const selects = screen.getAllByRole('combobox');
      fireEvent.change(selects[0]!, { target: { value: 'dr-1' } });

      // Verify drilling fields are visible
      expect(screen.getByText('Drilling Production Metrics')).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/e\.g\. 185\.5/i)).toBeInTheDocument(); // Meters
      expect(screen.getByPlaceholderText(/e\.g\. 24/i)).toBeInTheDocument(); // Holes
      expect(screen.getByPlaceholderText(/e\.g\. BLK-A1/i)).toBeInTheDocument(); // Block
      expect(screen.getByText(/Penetration Rate/i)).toBeInTheDocument();

      // Enter start and stop SMR (4 hours worked: 2000 to 2004) and 100 meters
      const smrInputs = screen.getAllByRole('spinbutton');
      const startSmuInput = smrInputs[0]!;
      const endSmuInput = smrInputs[1]!;
      fireEvent.change(startSmuInput, { target: { value: '2000' } });
      fireEvent.change(endSmuInput, { target: { value: '2004' } });

      // Enter meters
      const metersInput = screen.getByPlaceholderText(/e\.g\. 185\.5/i);
      fireEvent.change(metersInput, { target: { value: '100' } });

      // 100m / 4h = 25.0 m/h
      expect(screen.getByText('25.0 m/h')).toBeInTheDocument();
    });

    // 4. Breakdown SMR lock
    it('locks Start SMR to latest_smu when machine is on active breakdown', () => {
      const machines = [{ id: 'bd-24', name: 'BD-24', machine_type: 'Dozer', latest_smu: 38003.5 }];
      const engineeringDelays = {
        'bd-24': {
          hours: 6.0,
          reasons: ['Track tensioner failure'],
          status: 'active',
        },
      };

      render(
        <MachineOperationsForm
          departmentId="dept-cr"
          machines={machines}
          operators={[{ id: 'op-1', full_name: 'Sam Dozer', employee_code: 'OP-BD01' }]}
          sites={[{ id: 'site-pit', name: 'Brakfontein Pit', site_code: 'BRAK-PIT' }]}
          todayOperations={[]}
          engineeringDelaysByMachine={engineeringDelays}
        />
      );

      const machineSelect = screen.getAllByRole('combobox')[0]!;
      fireEvent.change(machineSelect, { target: { value: 'bd-24' } });

      // Check that startSmu is locked and read-only
      const startSmuInput = screen.getAllByRole('spinbutton')[0]!;
      expect(startSmuInput).toHaveAttribute('readonly');
      expect(startSmuInput).toHaveValue(38003.5);
      expect(screen.getByText(/Locked on Breakdown/i)).toBeInTheDocument();
      expect(screen.getByText(/Opening SMR is locked to Stop SMR/i)).toBeInTheDocument();
    });

    // 5. KPI Strip with Telemetry Sparklines
    it('renders all 5 KPI panels with telemetry sparklines in MachineOperationsKpiStrip', () => {
      render(
        <MachineOperationsKpiStrip
          totalHours={48.5}
          activeMachines={12}
          totalMaterialBCM={3420}
          avgBcmPerHour={70.5}
          totalDelayHours={3.2}
          controlRoomDelayHours={1.2}
          totalEngineeringDelayHours={2.0}
        />
      );

      expect(screen.getByText("Today's Hours")).toBeInTheDocument();
      expect(screen.getAllByText('48.5h').length).toBeGreaterThan(0);
      expect(screen.getByTestId('kpi-sparkline-today-hours')).toBeInTheDocument();

      expect(screen.getByText('Active Machines')).toBeInTheDocument();
      expect(screen.getAllByText('12').length).toBeGreaterThan(0);
      expect(screen.getByTestId('kpi-sparkline-active-machines')).toBeInTheDocument();

      expect(screen.getByText('Material Moved')).toBeInTheDocument();
      expect(screen.getAllByText(/3420/).length).toBeGreaterThan(0);
      expect(screen.getByTestId('kpi-sparkline-material-moved')).toBeInTheDocument();

      expect(screen.getByText('BCM/Hour')).toBeInTheDocument();
      expect(screen.getAllByText('70.5').length).toBeGreaterThan(0);
      expect(screen.getByTestId('kpi-sparkline-bcm-rate')).toBeInTheDocument();

      expect(screen.getByText('Total Delays')).toBeInTheDocument();
      expect(screen.getAllByText('3.2h').length).toBeGreaterThan(0);
      expect(screen.getByText(/CR: 1\.2h \+ Eng: 2\.0h/i)).toBeInTheDocument();
      expect(screen.getByTestId('kpi-sparkline-total-delays')).toBeInTheDocument();
    });

    // 6. Filter Tabs: Breakdown always visible and Inactive
    it('always renders Breakdown and Inactive filter pills with counts', () => {
      render(
        <MachineOperationsFilterableTable
          machines={[
            { id: 'm-1', name: 'BD-22', machine_type: 'Dozer', active: true },
            { id: 'm-2', name: 'DR-02', machine_type: 'Drill Rig', active: false },
          ]}
          operations={[]}
          activeBreakdowns={[]}
        />
      );

      // Breakdowns pill is visible even with 0 breakdowns
      expect(screen.getByRole('button', { name: /Breakdowns \(0\)/i })).toBeInTheDocument();
      // Inactive pill is visible with count 1
      expect(screen.getByRole('button', { name: /Inactive \(1\)/i })).toBeInTheDocument();
    });

    // 7. Grouped Equipment Tables & Column Rationalization
    it('groups machines by category and renders dedicated tailored columns per category', () => {
      const mixedFleet = [
        { id: 'adt-1', name: 'DT-102', machine_type: 'Dump Truck', bin_factor: 28 },
        { id: 'dr-1', name: 'DR-06', machine_type: 'Drill Rig' },
        { id: 'dz-1', name: 'BD-22', machine_type: 'Dozer' },
      ];

      render(
        <MachineOperationsFilterableTable
          machines={mixedFleet}
          operations={[]}
          todayLoads={[{ machine_id: 'adt-1', shift_type: 'day', total_loads: 15 }]}
        />
      );

      // Category section headers are present
      expect(screen.getByTestId('category-section-adt')).toBeInTheDocument();
      expect(screen.getByTestId('category-section-drill')).toBeInTheDocument();
      expect(screen.getByTestId('category-section-dozer')).toBeInTheDocument();

      // ADT section has Loads, Bin Factor, and Total BCM
      const adtSection = screen.getByTestId('category-section-adt');
      expect(adtSection).toHaveTextContent('Loads');
      expect(adtSection).toHaveTextContent('Bin Factor');
      expect(adtSection).toHaveTextContent('Total BCM');
      // ADT does NOT have Holes or Meters
      expect(adtSection).not.toHaveTextContent('Holes');
      expect(adtSection).not.toHaveTextContent('Meters');

      // Drill section has Holes, Meters, and Penetration Rate
      const drillSection = screen.getByTestId('category-section-drill');
      expect(drillSection).toHaveTextContent('Holes');
      expect(drillSection).toHaveTextContent('Meters');
      expect(drillSection).toHaveTextContent('Penetration Rate');
      // Drill does NOT have Loads or Bin Factor
      expect(drillSection).not.toHaveTextContent('Loads');
      expect(drillSection).not.toHaveTextContent('Bin Factor');

      // Dozer section has Activity and Rollover (BCM)
      const dozerSection = screen.getByTestId('category-section-dozer');
      expect(dozerSection).toHaveTextContent('Activity');
      expect(dozerSection).toHaveTextContent('Rollover (BCM)');
      // Dozer does NOT have Holes or Meters
      expect(dozerSection).not.toHaveTextContent('Holes');
      expect(dozerSection).not.toHaveTextContent('Meters');
    });
  });
});
