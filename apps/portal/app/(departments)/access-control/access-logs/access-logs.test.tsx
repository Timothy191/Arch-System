import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type {
  AllEmployeesAttendanceRegisterResult,
  EmployeeAttendanceSummary,
} from '../actions/badges';
import {
  AccessLogsClient,
  buildAccessLogsCsv,
  buildAttendanceRegisterCsv,
  buildEmployeeDailyAttendanceCsv,
  escapeAccessLogCsvCell,
  type PersonnelFilterOption,
  type ResolvedAccessLog,
} from './AccessLogsClient';
import AccessLogsPage from './page';

jest.mock('next/server', () => ({
  connection: jest.fn(async () => undefined),
}));

jest.mock('../actions', () => ({
  getAccessLogsWithFilters: jest.fn(),
  getEmployeeAttendanceSummary: jest.fn(),
  getAllEmployeesAttendanceRegister: jest.fn(),
  getPersonnelListForFilter: jest.fn(),
  executeEasyScan: jest.fn(),
}));

const {
  getAccessLogsWithFilters: mockGetAccessLogsWithFilters,
  getEmployeeAttendanceSummary: mockGetEmployeeAttendanceSummary,
  getAllEmployeesAttendanceRegister: mockGetAllEmployeesAttendanceRegister,
  getPersonnelListForFilter: mockGetPersonnelListForFilter,
  executeEasyScan: mockExecuteEasyScan,
} = jest.requireMock('../actions') as {
  getAccessLogsWithFilters: jest.Mock;
  getEmployeeAttendanceSummary: jest.Mock;
  getAllEmployeesAttendanceRegister: jest.Mock;
  getPersonnelListForFilter: jest.Mock;
  executeEasyScan: jest.Mock;
};

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

const { toast: mockToast } = jest.requireMock('sonner') as {
  toast: { success: jest.Mock; error: jest.Mock };
};

describe('AccessLogsClient, AccessLogsPage & Attendance Register', () => {
  const mockPersonnel: readonly PersonnelFilterOption[] = [
    {
      id: 'person-1',
      name: 'John Doe',
      empCode: 'EMP-001',
      idNumber: '9001015009081',
      jobTitle: 'Mining Engineer',
    },
    {
      id: 'person-2',
      name: 'Jane Smith',
      empCode: 'EMP-002',
      idNumber: '9202025009082',
      jobTitle: 'Plant Operator',
    },
  ];

  const mockLogs: readonly ResolvedAccessLog[] = [
    {
      id: 'log-1',
      timestamp: '2026-10-27T06:15:00Z',
      entityName: 'John Doe',
      entityType: 'Employee',
      personnelId: 'person-1',
      idNumber: '9001015009081',
      empCode: 'EMP-001',
      jobTitle: 'Mining Engineer',
      qrCodeId: 'BADGE-EMP-001',
      rfidCode: 'RFID-001',
      zone: 'Main Gate North Turnstile',
      accessMethod: 'QR Scan',
      status: 'Granted',
      isGranted: true,
      denialReason: null,
      direction: 'IN',
      alcoholTested: 'Approved',
      operator: 'Gate Officer',
      deviceId: 'C66-01',
    },
    {
      id: 'log-2',
      timestamp: '2026-10-27T14:30:00Z',
      entityName: 'Jane Smith',
      entityType: 'Employee',
      personnelId: 'person-2',
      idNumber: '9202025009082',
      empCode: 'EMP-002',
      jobTitle: 'Plant Operator',
      qrCodeId: 'BADGE-EMP-002',
      zone: 'East Pit Boom Gate',
      accessMethod: 'RFID',
      status: 'Denied',
      isGranted: false,
      denialReason: 'Failed Breathalyzer Alcohol Test',
      direction: 'OUT',
      alcoholTested: 'Failed',
    },
  ];

  const mockAttendanceSummary: EmployeeAttendanceSummary = {
    employee: {
      id: 'person-1',
      name: 'John Doe',
      empCode: 'EMP-001',
      idNumber: '9001015009081',
      jobTitle: 'Mining Engineer',
    },
    totalScans: 2,
    todayScansCount: 2,
    firstInToday: '2026-10-27T06:15:00Z',
    lastOutToday: '2026-10-27T14:30:00Z',
    currentPresence: 'OFF_SITE',
    lastGateLocation: 'Main Gate North Turnstile',
    totalHoursToday: '8h 15m',
    complianceRate: 100,
    dateRange: 'ALL',
    daysPresent: 1,
    firstTimeIn: '2026-10-27T06:15:00Z',
    lastTimeOut: '2026-10-27T14:30:00Z',
    grantedCount: 2,
    deniedCount: 0,
    alcoholTestedCount: 2,
    alcoholPassCount: 2,
    alcoholFailCount: 0,
    denialReasons: [],
    dailyRecords: [
      {
        date: '2026-10-27',
        timeIn: '2026-10-27T06:15:00Z',
        timeOut: '2026-10-27T14:30:00Z',
        direction: 'IN / OUT',
        alcoholTested: 'Approved',
        status: 'Granted',
        denialReason: null,
        gateLocation: 'Main Gate North Turnstile',
        scanCount: 2,
      },
    ],
  };

  const mockRegisterData: AllEmployeesAttendanceRegisterResult = {
    dateRange: 'QUARTER',
    totalEmployees: 2,
    records: [
      {
        employeeId: 'person-1',
        name: 'John Doe',
        coyNumber: 'EMP-001',
        idNumber: '9001015009081',
        jobTitle: 'Mining Engineer',
        daysPresent: 18,
        firstTimeIn: '2026-08-01T06:00:00Z',
        lastTimeOut: '2026-10-27T14:30:00Z',
        totalScans: 36,
        grantedCount: 36,
        deniedCount: 0,
        alcoholTestedCount: 36,
        alcoholPassCount: 36,
        alcoholFailCount: 0,
        denialReasons: [],
        dailyRecords: [
          {
            date: '2026-10-27',
            timeIn: '2026-10-27T06:15:00Z',
            timeOut: '2026-10-27T14:30:00Z',
            direction: 'IN / OUT',
            alcoholTested: 'Approved',
            status: 'Granted',
            denialReason: null,
            gateLocation: 'Main Gate North Turnstile',
            scanCount: 2,
          },
        ],
      },
      {
        employeeId: 'person-2',
        name: 'Jane Smith',
        coyNumber: 'EMP-002',
        idNumber: '9202025009082',
        jobTitle: 'Plant Operator',
        daysPresent: 12,
        firstTimeIn: '2026-09-01T06:00:00Z',
        lastTimeOut: '2026-10-26T14:00:00Z',
        totalScans: 25,
        grantedCount: 24,
        deniedCount: 1,
        alcoholTestedCount: 25,
        alcoholPassCount: 24,
        alcoholFailCount: 1,
        denialReasons: ['Failed Breathalyzer Alcohol Test'],
        dailyRecords: [
          {
            date: '2026-10-27',
            timeIn: null,
            timeOut: null,
            direction: 'IN',
            alcoholTested: 'Failed',
            status: 'Denied',
            denialReason: 'Failed Breathalyzer Alcohol Test',
            gateLocation: 'East Pit Boom Gate',
            scanCount: 1,
          },
        ],
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetPersonnelListForFilter.mockResolvedValue(mockPersonnel);
    mockGetAccessLogsWithFilters.mockResolvedValue({
      logs: mockLogs,
      totalCount: mockLogs.length,
      queryWarning: null,
    });
    mockGetEmployeeAttendanceSummary.mockResolvedValue(mockAttendanceSummary);
    mockGetAllEmployeesAttendanceRegister.mockResolvedValue(mockRegisterData);

    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: jest.fn(() => 'blob:mock-csv'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: jest.fn(),
    });
    jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders access logs with alcohol status, direction, ID/Coy numbers, and inline denial reason', () => {
    render(
      <AccessLogsClient
        initialLogs={mockLogs}
        initialTotalCount={mockLogs.length}
        personnelList={mockPersonnel}
      />
    );

    expect(screen.getByText('Access Logs & Attendance Register')).toBeInTheDocument();
    expect(screen.getAllByText('John Doe')[0]).toBeInTheDocument();
    expect(screen.getAllByText(/9001015009081/)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/EMP-001/)[0]).toBeInTheDocument();
    expect(screen.getByText('Pass (Approved)')).toBeInTheDocument();
    expect(screen.getByText('Fail (Failed)')).toBeInTheDocument();
    expect(screen.getByText('IN')).toBeInTheDocument();
    expect(screen.getByText('OUT')).toBeInTheDocument();
    expect(screen.getByText(/Reason: Failed Breathalyzer Alcohol Test/)).toBeInTheDocument();
  });

  it('opens detail modal for a denied scan and jumps into employee attendance register', async () => {
    render(
      <AccessLogsClient
        initialLogs={mockLogs}
        initialTotalCount={mockLogs.length}
        personnelList={mockPersonnel}
        initialAttendanceRegister={mockRegisterData}
      />
    );

    const detailButtons = screen.getAllByRole('button', { name: /Details/i });
    fireEvent.click(detailButtons[1]!);

    expect(screen.getByText('Access Scan Telemetry Details')).toBeInTheDocument();
    expect(screen.getAllByText('9202025009082')[0]).toBeInTheDocument();
    expect(screen.getAllByText('EMP-002')[0]).toBeInTheDocument();
    expect(screen.getByText('Failed Breathalyzer Alcohol Test')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Open Employee Attendance Register' }));
    expect(screen.getByText('2026-10-27')).toBeInTheDocument();
  });

  it('supports filtering by employee select, search input, direction, status, pagination, and reset', async () => {
    render(
      <AccessLogsClient
        initialLogs={mockLogs}
        initialTotalCount={120}
        personnelList={mockPersonnel}
      />
    );

    fireEvent.click(screen.getByLabelText('Next page'));
    await waitFor(() => {
      expect(mockGetAccessLogsWithFilters).toHaveBeenCalledWith(
        expect.objectContaining({ page: 2 })
      );
    });

    fireEvent.change(screen.getByLabelText(/Filter by Employee/i), {
      target: { value: 'person-1' },
    });
    await waitFor(() => {
      expect(mockGetAccessLogsWithFilters).toHaveBeenCalledWith(
        expect.objectContaining({ employeeId: 'person-1' })
      );
      expect(mockGetEmployeeAttendanceSummary).toHaveBeenCalledWith('person-1', 'ALL');
    });

    fireEvent.change(screen.getByPlaceholderText(/Filter by name/i), {
      target: { value: 'Breathalyzer' },
    });
    await waitFor(() => {
      expect(mockGetAccessLogsWithFilters).toHaveBeenCalledWith(
        expect.objectContaining({ searchQuery: 'Breathalyzer' })
      );
    });

    fireEvent.click(screen.getByRole('button', { name: 'Entry (IN)' }));
    fireEvent.click(screen.getByRole('button', { name: 'DENIED' }));
    await waitFor(() => {
      expect(mockGetAccessLogsWithFilters).toHaveBeenCalledWith(
        expect.objectContaining({ direction: 'IN' })
      );
      expect(mockGetAccessLogsWithFilters).toHaveBeenCalledWith(
        expect.objectContaining({ statusFilter: 'DENIED' })
      );
    });

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    await waitFor(() => {
      expect(mockGetAccessLogsWithFilters).toHaveBeenCalledWith(
        expect.objectContaining({
          employeeId: null,
          searchQuery: '',
          direction: 'ALL',
          statusFilter: 'ALL',
          dateRange: 'ALL',
        })
      );
    });
  });

  it('displays queryWarning banner safely, handles empty logs state, and triggers CSV downloads', async () => {
    render(
      <AccessLogsClient
        initialLogs={[]}
        initialTotalCount={0}
        personnelList={mockPersonnel}
        initialQueryWarning="Loaded compatibility columns safely."
      />
    );

    expect(screen.getByText('Schema Compatibility Notice')).toBeInTheDocument();
    expect(screen.getByText('No scan logs matched your filter criteria.')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Dismiss warning'));
    expect(screen.queryByText('Schema Compatibility Notice')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Clear all filters' }));
    await waitFor(() => {
      expect(mockGetAccessLogsWithFilters).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole('button', { name: /Export CSV/i }));
    expect(mockToast.success).toHaveBeenCalled();
  });

  it('displays the Employee Attendance Register Dossier and clears filter', async () => {
    render(
      <AccessLogsClient
        initialLogs={mockLogs}
        initialTotalCount={mockLogs.length}
        personnelList={mockPersonnel}
        initialEmployeeId="person-1"
        initialAttendanceSummary={mockAttendanceSummary}
      />
    );

    expect(screen.getByText(/Full Site Attendance Register/i)).toBeInTheDocument();
    expect(screen.getByText('OFF SITE')).toBeInTheDocument();
    expect(screen.getByText('8h 15m')).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Clear Filter (Show All Personnel)'));
    await waitFor(() => {
      expect(mockGetAccessLogsWithFilters).toHaveBeenCalledWith(
        expect.objectContaining({ employeeId: null })
      );
    });
  });

  it('loads Employee Attendance Register tab dynamically, filters, drills down, and exports CSV', async () => {
    render(
      <AccessLogsClient
        initialLogs={mockLogs}
        initialTotalCount={mockLogs.length}
        personnelList={mockPersonnel}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '90D (3 Mo)' }));
    await waitFor(() => {
      expect(mockGetAccessLogsWithFilters).toHaveBeenCalledWith(
        expect.objectContaining({ dateRange: 'QUARTER' })
      );
    });

    fireEvent.click(screen.getByRole('tab', { name: /Employee Attendance Register/i }));
    await waitFor(() => {
      expect(mockGetAllEmployeesAttendanceRegister).toHaveBeenCalled();
    });
    expect(screen.getByText('Master Employee Attendance Register')).toBeInTheDocument();
    expect(screen.getAllByText(/ID: 9202025009082/)[0]).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/Search employees in register/i), {
      target: { value: 'Jane' },
    });
    fireEvent.click(screen.getByRole('button', { name: '12 Months' }));
    await waitFor(() => {
      expect(mockGetAllEmployeesAttendanceRegister).toHaveBeenCalledWith(
        expect.objectContaining({ dateRange: 'YEAR' })
      );
    });

    const dailyRecordButtons = screen.getAllByRole('button', { name: /Daily Record/i });
    fireEvent.click(dailyRecordButtons[1]!);

    expect(screen.getByText('2026-10-27')).toBeInTheDocument();
    expect(screen.getByText(/Reason: Failed Breathalyzer Alcohol Test/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Export Employee CSV/i }));
    expect(mockToast.success).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /All Employees/i }));
    expect(screen.getByText('Master Employee Attendance Register')).toBeInTheDocument();
  });

  it('opens Easy Scanner dialog, handles empty code error, OUT toggle, scan submission, and scan error', async () => {
    mockExecuteEasyScan
      .mockResolvedValueOnce({
        success: true,
        accessGranted: true,
        name: 'John Doe',
        empCode: 'EMP-001',
        jobTitle: 'Mining Engineer',
        entityType: 'personnel',
        message: 'Access Granted - East Pit Boom Gate',
        denialReason: null,
        scannedAt: '2026-10-27T08:00:00Z',
        gateLocation: 'East Pit Boom Gate',
        direction: 'OUT',
      })
      .mockRejectedValueOnce(new Error('Scanner hardware offline'));

    render(
      <AccessLogsClient
        initialLogs={mockLogs}
        initialTotalCount={mockLogs.length}
        personnelList={mockPersonnel}
      />
    );

    fireEvent.click(screen.getByText('⚡ Easy Scanner Console'));
    expect(screen.getByText('Easy Scanner Terminal')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Verify & Log' }));
    expect(mockToast.error).toHaveBeenCalledWith('Scan code cannot be empty');

    fireEvent.change(screen.getByLabelText(/Gate Terminal/i), {
      target: { value: 'East Pit Boom Gate' },
    });
    fireEvent.click(screen.getByRole('button', { name: /OUT \(Exit\)/i }));

    const input = screen.getByPlaceholderText(/Scan QR or RFID/i);
    fireEvent.change(input, { target: { value: 'BADGE-EMP-001' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    await waitFor(() => {
      expect(mockExecuteEasyScan).toHaveBeenCalledWith({
        code: 'BADGE-EMP-001',
        direction: 'OUT',
        gateLocation: 'East Pit Boom Gate',
        scannerId: 'EASY-SCANNER-CONSOLE',
      });
      expect(screen.getByText('ACCESS GRANTED')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Bob Dozer'));
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Scanner hardware offline');
    });
  });

  it('handles denial feedback and fetch failures cleanly without crashing', async () => {
    mockExecuteEasyScan.mockResolvedValueOnce({
      success: false,
      accessGranted: false,
      name: 'Unrecognized Badge / RFID',
      entityType: 'UNKNOWN',
      message: 'DENIED - Unrecognized Badge / RFID',
      denialReason: 'DENIED - Unrecognized Badge / RFID',
      scannedAt: '2026-10-27T08:45:00Z',
      gateLocation: 'Main Gate North Turnstile',
      direction: 'IN',
    });
    mockGetAccessLogsWithFilters.mockRejectedValueOnce(new Error('Network timeout'));

    render(
      <AccessLogsClient
        initialLogs={mockLogs}
        initialTotalCount={mockLogs.length}
        personnelList={mockPersonnel}
      />
    );

    fireEvent.click(screen.getByText('⚡ Easy Scanner Console'));
    fireEvent.click(screen.getByText('Unknown Tag'));

    await waitFor(() => {
      expect(screen.getByText('ACCESS DENIED')).toBeInTheDocument();
      expect(mockToast.error).toHaveBeenCalledWith('Network timeout');
    });
  });

  it('renders RSC AccessLogsPage gracefully across nullable rows, fleet rows, and rejected loaders', async () => {
    mockGetAccessLogsWithFilters.mockResolvedValueOnce({
      logs: [
        {
          id: 'raw-1',
          scanned_at: null,
          gate_location: null,
          access_granted: false,
          denial_reason: 'Induction Expired',
          access_type: null,
          direction: null,
          alcohol_tested: 'Not Tested',
          badge: {
            id: 'b-vis',
            qr_code: 'TEMP-01',
            rfid_code: null,
            entity_type: 'visitor',
            personnel: null,
            visitor: {
              id: 'v-1',
              name: 'Legacy Guest',
              first_name: null,
              surname: null,
              id_number: '8501015009080',
              company: 'Audit Ltd',
            },
          },
        },
        {
          id: 'raw-2',
          scanned_at: '2026-10-27T09:00:00Z',
          gate_location: 'Weighbridge',
          access_granted: true,
          denial_reason: null,
          access_type: 'RFID',
          direction: 'IN',
          alcohol_tested: 'Approved',
          badge: {
            id: 'b-fleet',
            qr_code: 'FL-01',
            rfid_code: null,
            entity_type: 'fleet',
            personnel: null,
            visitor: null,
            fleet: { fleet_code: 'ADT-14', registration_number: 'ND-7741' },
          },
        },
      ],
      totalCount: 2,
      queryWarning: 'Compatibility mode enabled.',
    });

    const pageElement = await AccessLogsPage({
      searchParams: Promise.resolve({ page: 'invalid', dateRange: 'QUARTER' }),
    });
    const { unmount } = render(pageElement);

    expect(screen.getByText('Legacy Guest')).toBeInTheDocument();
    expect(screen.getByText('Fleet: ADT-14')).toBeInTheDocument();
    expect(screen.getByText(/Reason: Induction Expired/)).toBeInTheDocument();
    expect(screen.getByText('Compatibility mode enabled.')).toBeInTheDocument();
    unmount();

    mockGetPersonnelListForFilter.mockRejectedValueOnce(new Error('Personnel failure'));
    mockGetAccessLogsWithFilters.mockRejectedValueOnce(new Error('Logs failure'));
    mockGetAllEmployeesAttendanceRegister.mockResolvedValueOnce({
      records: [],
      totalEmployees: 0,
      dateRange: 'QUARTER',
      queryWarning: 'Register degraded.',
    });

    const recoveredPage = await AccessLogsPage({
      searchParams: Promise.resolve({}),
    });
    render(recoveredPage);
    expect(screen.getByText(/Access logs query recovered/i)).toBeInTheDocument();
  });

  it('escapes CSV formula injection cells and builds access-logs & attendance register CSVs', () => {
    expect(escapeAccessLogCsvCell('=CMD()')).toBe('"\'=CMD()"');
    expect(escapeAccessLogCsvCell('+SUM(1,2)')).toBe('"\'+SUM(1,2)"');
    expect(escapeAccessLogCsvCell('Normal "Quoted"')).toBe('"Normal ""Quoted"""');

    const logsCsv = buildAccessLogsCsv(mockLogs);
    expect(logsCsv).toContain('Alcohol Testing');
    expect(logsCsv).toContain('Failed Breathalyzer Alcohol Test');

    const registerCsv = buildAttendanceRegisterCsv(mockRegisterData.records);
    expect(registerCsv).toContain('9001015009081');
    expect(registerCsv).toContain('EMP-002');

    const dailyCsv = buildEmployeeDailyAttendanceCsv(mockRegisterData.records[1]!);
    expect(dailyCsv).toContain('2026-10-27');
    expect(dailyCsv).toContain('Failed Breathalyzer Alcohol Test');
  });
});
