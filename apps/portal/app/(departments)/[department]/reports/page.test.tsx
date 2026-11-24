import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { getDepartmentContext } from '~/lib/dept-context';
import { mapOperationsToMachineDailyRecords } from './machine-activity-helpers';
import ReportsPage from './page';
import {
  buildEngineeringAndExportPayloads,
  buildShiftAndMachineReports,
} from './reports-server-helpers';
import { fetchDepartmentReportsRawData } from './reports-server-queries';

jest.mock('next/server', () => ({
  connection: jest.fn(async () => undefined),
}));

jest.mock('~/lib/dept-context', () => ({
  getDepartmentContext: jest.fn(),
}));

jest.mock(
  '~/features/departments/components/plant-inventory/PlantInventoryWorkspaceClient',
  () => ({
    PlantInventoryWorkspaceClient: ({
      mode,
      today,
      initialReportTab,
    }: {
      mode: string;
      today: string;
      initialReportTab?: string;
    }) => (
      <div data-testid="plant-inventory-reports">
        {mode}:{today}:{initialReportTab ?? 'none'}
      </div>
    ),
  })
);

jest.mock('~/features/departments/components/plant-processing/actions', () => ({
  getPlantProcessingWorkspaceData: jest.fn(async (today: string) => ({
    currentDate: today,
    initialSheets: [],
    initialDelays: [],
  })),
}));

jest.mock('~/features/departments/components/plant-processing/PlantHistoryDatabaseClient', () => ({
  PlantHistoryDatabaseClient: ({ initialDate }: { initialDate: string }) => (
    <div data-testid="plant-processing-reports">{initialDate}</div>
  ),
}));

jest.mock('~/features/departments/components/production/actions', () => ({
  getProductionPerformanceData: jest.fn(async () => ({
    selectedMonth: '2026-10',
    monthLabel: 'October 2026',
    availableMonths: [],
    targets: {},
    shiftRows: [],
    dailyRows: [],
    weeklyRows: [],
    monthlyRows: [],
    delayGroups: [],
    foremanSummary: {},
  })),
}));

jest.mock('~/features/departments/components/production/ProductionReportsWorkspace', () => ({
  ProductionReportsWorkspace: ({
    deptId,
    initialTab,
    initialData,
  }: {
    deptId: string;
    initialTab?: string;
    initialData: { monthLabel: string };
  }) => (
    <div data-testid="production-reports-workspace">
      {deptId}:{initialTab ?? 'foreman'}:{initialData.monthLabel}
    </div>
  ),
}));

jest.mock('./ReportsDashboardClient', () => ({
  ReportsDashboardClient: ({
    departmentSlug,
    initialTab,
    fleetMachines,
    fleetOperators,
  }: {
    departmentSlug: string;
    initialTab: string;
    fleetMachines: Array<{ id: string; name: string; baselineSmr: number; siteName: string }>;
    fleetOperators: Array<{ id: string; fullName: string; employeeCode: string }>;
  }) => (
    <div data-testid="reports-dashboard-client">
      <span data-testid="dept-slug">{departmentSlug}</span>
      <span data-testid="initial-tab">{initialTab}</span>
      <span data-testid="machines-count">{fleetMachines.length}</span>
      <span data-testid="operators-count">{fleetOperators.length}</span>
      <span data-testid="first-machine-smr">{fleetMachines[0]?.baselineSmr ?? ''}</span>
      <span data-testid="second-machine-smr">{fleetMachines[1]?.baselineSmr ?? ''}</span>
      <span data-testid="second-machine-site">{fleetMachines[1]?.siteName ?? ''}</span>
      <span data-testid="first-operator">{fleetOperators[0]?.fullName ?? ''}</span>
    </div>
  ),
}));

jest.mock('./reports-server-queries', () => ({
  fetchDepartmentReportsRawData: jest.fn(),
}));

jest.mock('./reports-server-helpers', () => ({
  buildShiftAndMachineReports: jest.fn(),
  buildEngineeringAndExportPayloads: jest.fn(),
}));

jest.mock('./machine-activity-helpers', () => ({
  mapOperationsToMachineDailyRecords: jest.fn(),
}));

function setupDefaultServerMocks() {
  (fetchDepartmentReportsRawData as jest.Mock).mockResolvedValue({
    operations: [
      { id: 'op-1', machine_id: 'mach-1', end_smu: 1450.5 },
      { id: 'op-2', machine_id: 'mach-1', end_smu: 1400 },
      { id: 'op-3', machine_id: 'mach-2', end_smu: null },
      { id: 'op-4', machine_id: '', end_smu: 9999 },
    ],
    loads: [],
    delays: [],
    excavatorAssignments: [],
    dozerRolls: [],
    breakdowns: [],
    engNotes: [],
    dailyLogs: [],
    rawMachines: [
      {
        id: 'mach-1',
        name: 'EX-01 Liebherr 984',
        machine_type: 'Excavator',
        serial_number: 'SN-101',
        site_id: 'site-1',
        active: true,
        sites: [{ name: 'North Pit' }],
      },
      {
        id: 'mach-2',
        name: 'ADT-101 Bell',
        machine_type: null,
        serial_number: null,
        site_id: null,
        active: true,
        sites: null,
      },
      {
        id: 'mach-inactive',
        name: 'Retired Truck',
        machine_type: 'ADT',
        active: false,
        sites: null,
      },
    ],
    rawOperators: [
      { id: 'op-a', full_name: 'S. Mokoena', employee_code: 'EMP-01', active: true },
      { id: 'op-b', full_name: 'Inactive Op', employee_code: null, active: false },
    ],
    completeness: { totalCount: 0, submittedCount: 0, missingMachines: [] },
    queryWarnings: [],
    machineHoursByLog: new Map(),
    fuelLogsByLog: new Map(),
    productionByLog: new Map(),
  });

  (mapOperationsToMachineDailyRecords as jest.Mock).mockReturnValue([]);
  (buildShiftAndMachineReports as jest.Mock).mockReturnValue({
    shiftRows: [],
    machineOperationLogs: [],
  });
  (buildEngineeringAndExportPayloads as jest.Mock).mockReturnValue({
    engineeringLogs: [],
    totalFleetCount: 2,
    coveredFleetCount: 1,
    missingCoverage: [],
    csvContent: '',
    exportRows: [],
    pdfReportData: {},
  });
}

describe('ReportsPage ([department]/reports/page.tsx)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupDefaultServerMocks();
  });

  it('renders PlantInventoryWorkspaceClient with dashboard tab by default for plant-inventory', async () => {
    (getDepartmentContext as jest.Mock).mockResolvedValueOnce({
      dept: { name: 'plant-inventory', displayName: 'Plant Inventory', type: 'standard' },
      deptId: 'dept-inv',
      today: '2026-10-22',
    });

    const jsx = await ReportsPage({
      params: Promise.resolve({ department: 'plant-inventory' }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    expect(screen.getByTestId('plant-inventory-reports')).toHaveTextContent(
      'reports:2026-10-22:dashboard'
    );
  });

  it('renders PlantInventoryWorkspaceClient with pdf-report tab when tab=pdf-report', async () => {
    (getDepartmentContext as jest.Mock).mockResolvedValueOnce({
      dept: { name: 'plant-inventory', displayName: 'Plant Inventory', type: 'standard' },
      deptId: 'dept-inv',
      today: '2026-10-22',
    });

    const jsx = await ReportsPage({
      params: Promise.resolve({ department: 'plant-inventory' }),
      searchParams: Promise.resolve({ tab: 'pdf-report' }),
    });
    render(jsx);

    expect(screen.getByTestId('plant-inventory-reports')).toHaveTextContent(
      'reports:2026-10-22:pdf-report'
    );
  });

  it('renders PlantHistoryDatabaseClient for plant-processing', async () => {
    (getDepartmentContext as jest.Mock).mockResolvedValueOnce({
      dept: { name: 'plant-processing', displayName: 'Plant Processing', type: 'standard' },
      deptId: 'dept-pp',
      today: '2026-10-22',
    });

    const jsx = await ReportsPage({
      params: Promise.resolve({ department: 'plant-processing' }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    expect(screen.getByTestId('plant-processing-reports')).toHaveTextContent('2026-10-22');
  });

  it('renders ProductionReportsWorkspace for production with foreman default and honors tab=pdf-report', async () => {
    (getDepartmentContext as jest.Mock).mockResolvedValueOnce({
      dept: { name: 'production', displayName: 'Production', type: 'standard' },
      deptId: 'dept-prod',
      today: '2026-10-22',
    });

    const defaultJsx = await ReportsPage({
      params: Promise.resolve({ department: 'production' }),
      searchParams: Promise.resolve({}),
    });
    const { unmount } = render(defaultJsx);
    expect(screen.getByTestId('production-reports-workspace')).toHaveTextContent(
      'dept-prod:foreman:October 2026'
    );
    unmount();

    (getDepartmentContext as jest.Mock).mockResolvedValueOnce({
      dept: { name: 'production', displayName: 'Production', type: 'standard' },
      deptId: 'dept-prod',
      today: '2026-10-22',
    });

    const pdfJsx = await ReportsPage({
      params: Promise.resolve({ department: 'production' }),
      searchParams: Promise.resolve({ tab: 'pdf-report' }),
    });
    render(pdfJsx);
    expect(screen.getByTestId('production-reports-workspace')).toHaveTextContent(
      'dept-prod:pdf-report:October 2026'
    );
  });

  it('renders ReportsDashboardClient for standard department with latestSmr, active machine filter, and operators', async () => {
    (getDepartmentContext as jest.Mock).mockResolvedValueOnce({
      dept: { name: 'control-room', displayName: 'Control Room', type: 'control_room' },
      deptId: 'dept-cr',
      supabase: {},
      today: '2026-10-22',
    });

    const jsx = await ReportsPage({
      params: Promise.resolve({ department: 'control-room' }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    expect(screen.getByTestId('dept-slug')).toHaveTextContent('control-room');
    expect(screen.getByTestId('initial-tab')).toHaveTextContent('shift');
    expect(screen.getByTestId('machines-count')).toHaveTextContent('2');
    expect(screen.getByTestId('operators-count')).toHaveTextContent('1');
    expect(screen.getByTestId('first-machine-smr')).toHaveTextContent('1450.5');
    expect(screen.getByTestId('second-machine-smr')).toHaveTextContent('1200');
    expect(screen.getByTestId('second-machine-site')).toHaveTextContent('Brakfontein Pit');
    expect(screen.getByTestId('first-operator')).toHaveTextContent('S. Mokoena');
    expect(fetchDepartmentReportsRawData).toHaveBeenCalledWith(
      expect.objectContaining({
        deptId: 'dept-cr',
        deptSlug: 'control-room',
        toDateStr: '2026-10-22',
      })
    );
  });

  it('defaults availability-utilization initialTab to machine-30d and honors explicit valid tabs', async () => {
    (getDepartmentContext as jest.Mock).mockResolvedValueOnce({
      dept: {
        name: 'availability-utilization',
        displayName: 'Availability & Utilization',
        type: 'standard',
      },
      deptId: 'dept-au',
      supabase: {},
      today: '2026-10-22',
    });

    const defaultJsx = await ReportsPage({
      params: Promise.resolve({ department: 'availability-utilization' }),
      searchParams: Promise.resolve({ from: '2026-10-01', to: '2026-10-22' }),
    });
    const { unmount } = render(defaultJsx);
    expect(screen.getByTestId('initial-tab')).toHaveTextContent('machine-30d');
    unmount();

    (getDepartmentContext as jest.Mock).mockResolvedValueOnce({
      dept: { name: 'drilling', displayName: 'Drilling', type: 'standard' },
      deptId: 'dept-dr',
      supabase: {},
      today: '2026-10-22',
    });

    const tabJsx = await ReportsPage({
      params: Promise.resolve({ department: 'drilling' }),
      searchParams: Promise.resolve({ tab: 'pdf-report' }),
    });
    render(tabJsx);
    expect(screen.getByTestId('initial-tab')).toHaveTextContent('pdf-report');
  });
});
