import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createStandardOverviewDelays } from '@/lib/shift-sheet-buckets';
import {
  EngineeringOverviewTable,
  type MachineOverviewInitialRow,
} from './EngineeringOverviewTable';

const mockSaveMachineOverviewRow = jest.fn();
const mockBookOutMachineCarryOverBreakdown = jest.fn();

jest.mock('./actions', () => ({
  saveMachineOverviewRow: (...args: unknown[]) => mockSaveMachineOverviewRow(...args),
  bookOutMachineCarryOverBreakdown: (...args: unknown[]) =>
    mockBookOutMachineCarryOverBreakdown(...args),
}));

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

const sampleRow: MachineOverviewInitialRow = {
  machineId: '11111111-1111-4111-8111-111111111111',
  machineName: 'ADT-101 · Bell B45E',
  machineType: 'ADT',
  serialNumber: 'BELL-101',
  siteId: null,
  startSmr: 1200,
  stopSmr: 1208.4,
  operatorId: '22222222-2222-4222-8222-222222222222',
  operatorName: 'T. Mokoena',
  delays: createStandardOverviewDelays(),
  comment: '',
  hasExistingOperation: false,
  carryOverBreakdown: null,
};

const carryOverRow: MachineOverviewInitialRow = {
  machineId: '33333333-3333-4333-8333-333333333333',
  machineName: 'EX-02 · CAT 6015B',
  machineType: 'Excavator',
  serialNumber: 'CAT-6015',
  siteId: null,
  startSmr: 4500,
  stopSmr: 4500,
  operatorId: null,
  operatorName: null,
  delays: {
    ...createStandardOverviewDelays(),
    breakdown: 6,
  },
  comment: '[Carry-Over Breakdown] Main hydraulic pump pressure loss',
  hasExistingOperation: false,
  carryOverBreakdown: {
    id: 'bd-1',
    reason: 'Main hydraulic pump pressure loss',
    dateIn: '2026-10-25',
    timeIn: '22:15:00',
    delayHours: 6,
    isFromPreviousShift: true,
  },
};

describe('EngineeringOverviewTable', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSaveMachineOverviewRow.mockResolvedValue({ success: true });
    mockBookOutMachineCarryOverBreakdown.mockResolvedValue({ success: true });
  });

  it('renders all 20 required columns in order and initializes standard delay defaults', () => {
    render(
      <EngineeringOverviewTable
        departmentId="dept-cr"
        shiftDate="2026-10-26"
        initialShiftType="day"
        initialRows={[sampleRow]}
        operators={[
          {
            id: '22222222-2222-4222-8222-222222222222',
            fullName: 'T. Mokoena',
            employeeCode: 'OP-01',
          },
        ]}
      />
    );

    const headers = screen.getAllByRole('columnheader').map((th) => th.textContent ?? '');
    expect(headers[0]).toContain('Machine ID');
    expect(headers[1]).toContain('Start SMR');
    expect(headers[2]).toContain('Stop SMR');
    expect(headers[3]).toContain('Total SMR Worked');
    expect(headers[4]).toContain('Natural Delays');
    expect(headers[5]).toContain('Blasting Delays');
    expect(headers[6]).toContain('Lunches');
    expect(headers[7]).toContain('Safety Talks');
    expect(headers[8]).toContain('Refueling');
    expect(headers[9]).toContain('No Operator');
    expect(headers[10]).toContain('Standby');
    expect(headers[11]).toContain('Other');
    expect(headers[12]).toContain('GES / Maintenance');
    expect(headers[13]).toContain('Tyres / Trams');
    expect(headers[14]).toContain('Greasing / Startups');
    expect(headers[15]).toContain('Breakdown');
    expect(headers[16]).toContain('Operator');
    expect(headers[17]).toContain('Comments');
    expect(headers[18]).toContain('Availability');
    expect(headers[19]).toContain('Utilization');

    // Standard defaults: Refueling = 0.2, Safety Talks = 0.5, Lunches = 0.5, GES/Maint = 0.5, Tyres/Trams = 0.2, Greasing/Startups = 0.5
    expect(screen.getByLabelText('Refueling ADT-101 · Bell B45E')).toHaveValue(0.2);
    expect(screen.getByLabelText('Safety Talks ADT-101 · Bell B45E')).toHaveValue(0.5);
    expect(screen.getByLabelText('Lunches ADT-101 · Bell B45E')).toHaveValue(0.5);
    expect(screen.getByLabelText('GES / Maintenance ADT-101 · Bell B45E')).toHaveValue(0.5);
    expect(screen.getByLabelText('Tyres / Trams ADT-101 · Bell B45E')).toHaveValue(0.2);
    expect(screen.getByLabelText('Greasing / Startups ADT-101 · Bell B45E')).toHaveValue(0.5);

    // Total SMR worked = 1208.4 - 1200 = 8.4h
    // Downtime = 0.5 + 0.2 + 0.5 + 0 = 1.2h -> Available = 10.8h -> Availability = 90.0%
    // Utilization = 8.4 / 10.8 = 77.8%
    expect(screen.getAllByText('8.4h').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('90.0%').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('77.8%').length).toBeGreaterThanOrEqual(1);
  });

  it('enforces mandatory comment when any delay is recorded and allows saving once comment is provided', async () => {
    render(
      <EngineeringOverviewTable
        departmentId="dept-cr"
        shiftDate="2026-10-26"
        initialShiftType="day"
        initialRows={[sampleRow]}
        operators={[]}
      />
    );

    // Record a Natural Delay of 1.5h (which clears the auto-filled standard allowance note)
    const naturalInput = screen.getByLabelText('Natural Delays ADT-101 · Bell B45E');
    fireEvent.change(naturalInput, { target: { value: '1.5' } });

    const saveBtn = screen.getByRole('button', { name: /^Save$/i });
    fireEvent.click(saveBtn);

    expect(mockSaveMachineOverviewRow).not.toHaveBeenCalled();
    expect(
      screen.getByText(/A matching comment is required when any delay is recorded/i)
    ).toBeInTheDocument();

    // Provide matching comment and save
    const commentInput = screen.getByLabelText('Comments ADT-101 · Bell B45E');
    fireEvent.change(commentInput, {
      target: { value: 'Heavy pit rain and visibility hold for 1.5h' },
    });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(mockSaveMachineOverviewRow).toHaveBeenCalledWith(
        expect.objectContaining({
          machineId: sampleRow.machineId,
          comment: 'Heavy pit rain and visibility hold for 1.5h',
          delays: expect.objectContaining({
            natural: 1.5,
            refueling: 0.2,
            safetyTalks: 0.5,
            lunches: 0.5,
            gesMaintenance: 0.5,
            tyresTracks: 0.2,
            greasingStartups: 0.5,
          }),
        })
      );
    });
  });

  it('displays carried-over breakdown from previous shift and allows booking out', async () => {
    render(
      <EngineeringOverviewTable
        departmentId="dept-cr"
        shiftDate="2026-10-26"
        initialShiftType="day"
        initialRows={[carryOverRow]}
        operators={[]}
      />
    );

    expect(screen.getByText(/Carried Over Breakdown \(Since 2026-10-25\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Breakdown EX-02 · CAT 6015B')).toHaveValue(6);

    const bookOutBtn = screen.getByRole('button', { name: /Book Out/i });
    fireEvent.click(bookOutBtn);

    await waitFor(() => {
      expect(mockBookOutMachineCarryOverBreakdown).toHaveBeenCalledWith(
        expect.objectContaining({
          machineId: carryOverRow.machineId,
          machineName: carryOverRow.machineName,
        })
      );
    });
  });
});
