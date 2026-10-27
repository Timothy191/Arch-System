import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { EmployeeAttendanceSummary } from '../actions/badges';
import {
  AccessLogsClient,
  type PersonnelFilterOption,
  type ResolvedAccessLog,
} from './AccessLogsClient';

// Mock server actions
jest.mock('../actions', () => ({
  getAccessLogsWithFilters: jest.fn(),
  getEmployeeAttendanceSummary: jest.fn(),
  executeEasyScan: jest.fn(),
}));

const {
  getAccessLogsWithFilters: mockGetAccessLogsWithFilters,
  getEmployeeAttendanceSummary: mockGetEmployeeAttendanceSummary,
  executeEasyScan: mockExecuteEasyScan,
} = jest.requireMock('../actions') as {
  getAccessLogsWithFilters: jest.Mock;
  getEmployeeAttendanceSummary: jest.Mock;
  executeEasyScan: jest.Mock;
};

// Mock sonner toast
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

describe('AccessLogsClient & Attendance Register', () => {
  const mockPersonnel: readonly PersonnelFilterOption[] = [
    {
      id: 'person-1',
      name: 'John Doe',
      empCode: 'EMP-001',
      jobTitle: 'Mining Engineer',
    },
    {
      id: 'person-2',
      name: 'Jane Smith',
      empCode: 'EMP-002',
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
      qrCodeId: 'BADGE-EMP-001',
      zone: 'Main Gate North Turnstile',
      accessMethod: 'QR Scan',
      status: 'Granted',
      direction: 'IN',
    },
    {
      id: 'log-2',
      timestamp: '2026-10-27T14:30:00Z',
      entityName: 'John Doe',
      entityType: 'Employee',
      personnelId: 'person-1',
      qrCodeId: 'BADGE-EMP-001',
      zone: 'Main Gate North Turnstile',
      accessMethod: 'QR Scan',
      status: 'Granted',
      direction: 'OUT',
    },
  ];

  const mockAttendanceSummary: EmployeeAttendanceSummary = {
    employee: {
      id: 'person-1',
      name: 'John Doe',
      empCode: 'EMP-001',
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
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAccessLogsWithFilters.mockResolvedValue({
      logs: mockLogs,
      totalCount: mockLogs.length,
    });
    mockGetEmployeeAttendanceSummary.mockResolvedValue(mockAttendanceSummary);
  });

  it('renders general access logs list and summary counters', () => {
    render(
      <AccessLogsClient
        initialLogs={mockLogs}
        initialTotalCount={mockLogs.length}
        personnelList={mockPersonnel}
      />
    );

    expect(screen.getByText('Access Logs & Attendance Register')).toBeInTheDocument();
    expect(screen.getAllByText('John Doe')[0]).toBeInTheDocument();
    expect(screen.getAllByText('BADGE-EMP-001')[0]).toBeInTheDocument();
    expect(screen.getByText('⚡ Easy Scanner Console')).toBeInTheDocument();
  });

  it('displays the Employee Attendance Register Dossier when an employee is selected', async () => {
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
    expect(screen.getByText('Clear Filter (Show All Personnel)')).toBeInTheDocument();
  });

  it('clears employee filter when clear button is clicked', async () => {
    render(
      <AccessLogsClient
        initialLogs={mockLogs}
        initialTotalCount={mockLogs.length}
        personnelList={mockPersonnel}
        initialEmployeeId="person-1"
        initialAttendanceSummary={mockAttendanceSummary}
      />
    );

    const clearButton = screen.getByText('Clear Filter (Show All Personnel)');
    fireEvent.click(clearButton);

    await waitFor(() => {
      expect(mockGetAccessLogsWithFilters).toHaveBeenCalledWith(
        expect.objectContaining({ employeeId: null })
      );
    });
  });

  it('opens Easy Scanner dialog when button is clicked and executes scan', async () => {
    mockExecuteEasyScan.mockResolvedValue({
      success: true,
      accessGranted: true,
      name: 'John Doe',
      empCode: 'EMP-001',
      jobTitle: 'Mining Engineer',
      entityType: 'personnel',
      message: 'Access Granted - Main Gate North Turnstile',
      denialReason: null,
      scannedAt: '2026-10-27T08:00:00Z',
      gateLocation: 'Main Gate North Turnstile',
      direction: 'IN',
    });

    render(
      <AccessLogsClient
        initialLogs={mockLogs}
        initialTotalCount={mockLogs.length}
        personnelList={mockPersonnel}
      />
    );

    // Open scanner modal
    const scannerButton = screen.getByText('⚡ Easy Scanner Console');
    fireEvent.click(scannerButton);

    expect(screen.getByText('Easy Scanner Terminal')).toBeInTheDocument();

    // Type barcode and submit
    const input = screen.getByPlaceholderText(/Scan QR or RFID/i);
    fireEvent.change(input, { target: { value: 'BADGE-EMP-001' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    await waitFor(() => {
      expect(mockExecuteEasyScan).toHaveBeenCalledWith({
        code: 'BADGE-EMP-001',
        direction: 'IN',
        gateLocation: 'Main Gate North Turnstile',
        scannerId: 'EASY-SCANNER-CONSOLE',
      });
    });

    // Check confirmation card
    await waitFor(() => {
      expect(screen.getByText('ACCESS GRANTED')).toBeInTheDocument();
    });
  });

  it('executes scan via quick preset chip', async () => {
    mockExecuteEasyScan.mockResolvedValue({
      success: true,
      accessGranted: true,
      name: 'Bob Dozer',
      empCode: 'EMP-BOB',
      jobTitle: 'Heavy Fleet Operator',
      entityType: 'personnel',
      message: 'Access Granted',
      denialReason: null,
      scannedAt: '2026-10-27T08:30:00Z',
      gateLocation: 'Main Gate North Turnstile',
      direction: 'IN',
    });

    render(
      <AccessLogsClient
        initialLogs={mockLogs}
        initialTotalCount={mockLogs.length}
        personnelList={mockPersonnel}
      />
    );

    // Open scanner modal
    fireEvent.click(screen.getByText('⚡ Easy Scanner Console'));

    // Click Bob Dozer chip
    const bobChip = screen.getByText('Bob Dozer');
    fireEvent.click(bobChip);

    await waitFor(() => {
      expect(mockExecuteEasyScan).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'BADGE-EMP-BOB' })
      );
    });
  });

  it('handles denial feedback cleanly when badge is invalid', async () => {
    mockExecuteEasyScan.mockResolvedValue({
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

    render(
      <AccessLogsClient
        initialLogs={mockLogs}
        initialTotalCount={mockLogs.length}
        personnelList={mockPersonnel}
      />
    );

    fireEvent.click(screen.getByText('⚡ Easy Scanner Console'));
    const invalidChip = screen.getByText('Unknown Tag');
    fireEvent.click(invalidChip);

    await waitFor(() => {
      expect(screen.getByText('ACCESS DENIED')).toBeInTheDocument();
      expect(
        screen.getByText(/Denial Reason: DENIED - Unrecognized Badge \/ RFID/i)
      ).toBeInTheDocument();
    });
  });
});
