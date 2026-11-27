import { fireEvent, render, screen } from '@testing-library/react';
import { toast } from 'sonner';
import { createStandardOverviewDelays, reconcileShortShiftHours } from '@/lib/shift-sheet-buckets';
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
    warning: jest.fn(),
  },
}));

jest.mock('@repo/supabase/client', () => ({
  createBrowserSupabaseClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({ data: [] }),
    })),
  })),
}));

jest.mock('@/lib/weather-api', () => ({
  fetchWeather: jest.fn().mockResolvedValue({
    weatherCode: 0,
    description: 'Clear sky',
  }),
}));

const sampleRow: MachineOverviewInitialRow = {
  machineId: '11111111-1111-4111-8111-111111111111',
  machineName: 'ADT-101 · Bell B45E',
  machineType: 'ADT',
  serialNumber: 'BELL-101',
  siteId: 'site-alpha-123',
  siteName: 'Pit Alpha',
  startSmr: 1200,
  stopSmr: 1208.4,
  previousClosingSmr: 1200,
  operatorId: '22222222-2222-4222-8222-222222222222',
  operatorName: 'T. Mokoena',
  delays: createStandardOverviewDelays(),
  comment: '',
  hasExistingOperation: false,
  carryOverBreakdown: null,
};

const secondSiteRow: MachineOverviewInitialRow = {
  machineId: '22222222-2222-4222-8222-222222222223',
  machineName: 'ADT-102 · Bell B45E',
  machineType: 'ADT',
  serialNumber: 'BELL-102',
  siteId: 'site-alpha-123',
  siteName: 'Pit Alpha',
  startSmr: 800,
  stopSmr: 805,
  previousClosingSmr: 800,
  operatorId: null,
  operatorName: null,
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
  siteName: null,
  startSmr: 4500,
  stopSmr: 4500,
  previousClosingSmr: 4500,
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

describe('EngineeringOverviewTable (Feedback Items 1–14)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSaveMachineOverviewRow.mockResolvedValue({ success: true });
    mockBookOutMachineCarryOverBreakdown.mockResolvedValue({ success: true });
  });

  it('Item 1: removes "Quick Log" and provides "Log Form" modal popup with validation, cancel, and revision', async () => {
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

    // No "Quick Log" button in the table row
    expect(screen.queryByRole('button', { name: /^Quick Log$/i })).not.toBeInTheDocument();

    // Has "Log Form" button
    const openModalBtn = screen.getByTestId(`open-log-form-btn-${sampleRow.machineId}`);
    expect(openModalBtn).toBeInTheDocument();
    fireEvent.click(openModalBtn);

    // Modal opens with role="dialog" and aria-modal="true"
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText(/Log Form: ADT-101 · Bell B45E/i)).toBeInTheDocument();

    // Start SMR is immutable inside modal
    const modalStartSmr = screen.getByLabelText('Modal Start SMR');
    expect(modalStartSmr).toHaveAttribute('readOnly');
    expect(modalStartSmr).toHaveValue(1200);

    // Stop SMR is editable in modal
    const modalStopSmr = screen.getByLabelText('Modal Stop SMR');
    expect(modalStopSmr).not.toHaveAttribute('readOnly');
    fireEvent.change(modalStopSmr, { target: { value: '1209.0' } });

    // Lunches is locked in modal
    const modalLunches = screen.getByLabelText('Modal Lunches');
    expect(modalLunches).toHaveAttribute('readOnly');
    expect(modalLunches).toHaveValue(0.5);

    // Safety Talks has min=0.5 in modal
    const modalSafety = screen.getByLabelText('Modal Safety Talks');
    expect(modalSafety).toHaveAttribute('min', '0.5');

    // Cancel closes modal
    const cancelBtn = screen.getByTestId('log-form-cancel-btn');
    fireEvent.click(cancelBtn);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    // Reopen and test Escape key closes modal
    fireEvent.click(openModalBtn);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('Item 2: completely deletes "Max 12.0h · ... prod left · ... max delays" with zero residual traces', () => {
    const { container } = render(
      <EngineeringOverviewTable
        departmentId="dept-cr"
        shiftDate="2026-10-26"
        initialShiftType="day"
        initialRows={[sampleRow]}
        operators={[]}
      />
    );

    expect(screen.queryByText(/prod left/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/max delays/i)).not.toBeInTheDocument();
    expect(container.innerHTML).not.toContain('prod left');
    expect(container.innerHTML).not.toContain('max delays');
  });

  it('Item 3: applies dark crisp grid lines across table, thead, tbody, th, and td', () => {
    render(
      <EngineeringOverviewTable
        departmentId="dept-cr"
        shiftDate="2026-10-26"
        initialShiftType="day"
        initialRows={[sampleRow]}
        operators={[]}
      />
    );

    const table = screen.getByRole('table');
    expect(table.className).toContain('border-collapse');
    expect(table.className).toContain('border');
    expect(table.className).toContain('border-slate-400/70');

    const headers = screen.getAllByRole('columnheader');
    expect(headers[0]?.className).toContain('border-slate-300/90');

    // Darkened group borders
    expect(headers[4]?.className).toContain('border-x-amber-600/40');
    expect(headers[5]?.className).toContain('border-x-sky-600/40');
    expect(headers[12]?.className).toContain('border-x-rose-600/40');
  });

  it('Item 4 & 5: Start SMR is immutable and Stop SMR is non-editable in the Overview Table', () => {
    render(
      <EngineeringOverviewTable
        departmentId="dept-cr"
        shiftDate="2026-10-26"
        initialShiftType="day"
        initialRows={[sampleRow]}
        operators={[]}
      />
    );

    const startSmrInput = screen.getByLabelText('Start SMR ADT-101 · Bell B45E');
    expect(startSmrInput).toHaveAttribute('readOnly');
    expect(startSmrInput).toHaveAttribute('aria-readonly', 'true');

    const stopSmrInput = screen.getByLabelText('Stop SMR ADT-101 · Bell B45E');
    expect(stopSmrInput).toHaveAttribute('readOnly');
    expect(stopSmrInput).toHaveAttribute('title', 'Editable in Log Form or Quick Logger');
  });

  it('Item 6: Time Unit toggle switches between decimal hours and whole minutes with concise legend', () => {
    render(
      <EngineeringOverviewTable
        departmentId="dept-cr"
        shiftDate="2026-10-26"
        initialShiftType="day"
        initialRows={[sampleRow]}
        operators={[]}
      />
    );

    // Legend is visible
    expect(screen.getByText('0.5h = 30m · 0.2h = 12m')).toBeInTheDocument();

    const toggleBtn = screen.getByTestId('time-unit-toggle');
    expect(toggleBtn).toHaveTextContent('Hours (h)');

    // Worked hours is 8.4h
    expect(screen.getAllByText('8.4h').length).toBeGreaterThanOrEqual(1);

    // Toggle to minutes
    fireEvent.click(toggleBtn);
    expect(toggleBtn).toHaveTextContent('Minutes (m)');

    // 8.4h * 60 = 504m
    expect(screen.getAllByText('504m').length).toBeGreaterThanOrEqual(1);
  });

  it('Item 7: QuickDelayLoggerPanel provides grouped select dropdown with All, Delays/Breakdowns, and optgroup per type', () => {
    render(
      <EngineeringOverviewTable
        departmentId="dept-cr"
        shiftDate="2026-10-26"
        initialShiftType="day"
        initialRows={[sampleRow, carryOverRow]}
        operators={[]}
      />
    );

    const dropdown = screen.getByTestId('fleet-category-dropdown');
    expect(dropdown).toBeInTheDocument();
    expect(dropdown.querySelector('option[value="all"]')).toBeInTheDocument();
    expect(dropdown.querySelector('option[value="abnormal"]')).toBeInTheDocument();
    expect(dropdown.querySelector('optgroup[label^="ADT"]')).toBeInTheDocument();
    expect(dropdown.querySelector('optgroup[label^="Excavator"]')).toBeInTheDocument();
  });

  it('Item 8: displays Weather Linked indicator in the Natural Delays header', () => {
    render(
      <EngineeringOverviewTable
        departmentId="dept-cr"
        shiftDate="2026-10-26"
        initialShiftType="day"
        initialRows={[sampleRow]}
        operators={[]}
      />
    );

    const weatherBadge = screen.getByTestId('weather-linked-badge');
    expect(weatherBadge).toBeInTheDocument();
    expect(weatherBadge).toHaveTextContent('Weather Linked');
  });

  it('Item 9: center-aligns all table headers, inputs, and cells', () => {
    render(
      <EngineeringOverviewTable
        departmentId="dept-cr"
        shiftDate="2026-10-26"
        initialShiftType="day"
        initialRows={[sampleRow]}
        operators={[]}
      />
    );

    const headers = screen.getAllByRole('columnheader');
    for (const th of headers) {
      expect(th.className).toContain('text-center');
      expect(th.className).toContain('align-middle');
    }

    const startSmr = screen.getByLabelText('Start SMR ADT-101 · Bell B45E');
    expect(startSmr.className).toContain('text-center');
  });

  it('Item 10: auto-propagates blasting delay to all machines sharing the same siteId with notification', () => {
    render(
      <EngineeringOverviewTable
        departmentId="dept-cr"
        shiftDate="2026-10-26"
        initialShiftType="day"
        initialRows={[sampleRow, secondSiteRow]}
        operators={[]}
      />
    );

    const blastingInput = screen.getByLabelText('Blasting Delays ADT-101 · Bell B45E');
    fireEvent.change(blastingInput, { target: { value: '1.0' } });

    // Propagated to ADT-102
    const secondBlasting = screen.getByLabelText('Blasting Delays ADT-102 · Bell B45E');
    expect(secondBlasting).toHaveValue(1);

    expect(toast.info).toHaveBeenCalledWith(
      expect.stringMatching(/Blasting delay \(1\.0h\) auto-propagated/i)
    );
  });

  it('Item 11: compulsory lunches are locked at 0.5h across table and cannot be changed', () => {
    render(
      <EngineeringOverviewTable
        departmentId="dept-cr"
        shiftDate="2026-10-26"
        initialShiftType="day"
        initialRows={[sampleRow]}
        operators={[]}
      />
    );

    const lunchInput = screen.getByLabelText('Lunches ADT-101 · Bell B45E');
    expect(lunchInput).toHaveAttribute('readOnly');
    expect(lunchInput).toHaveValue(0.5);

    fireEvent.change(lunchInput, { target: { value: '2.0' } });
    expect(lunchInput).toHaveValue(0.5);
  });

  it('Item 12: safety talks enforce minimum 0.5h (can only increase above 0.5h)', () => {
    render(
      <EngineeringOverviewTable
        departmentId="dept-cr"
        shiftDate="2026-10-26"
        initialShiftType="day"
        initialRows={[sampleRow]}
        operators={[]}
      />
    );

    const safetyInput = screen.getByLabelText('Safety Talks ADT-101 · Bell B45E');
    expect(safetyInput).toHaveAttribute('min', '0.5');

    // Attempting to decrease below 0.5 clamps to 0.5
    fireEvent.change(safetyInput, { target: { value: '0.1' } });
    expect(safetyInput).toHaveValue(0.5);

    // Can increase to 1.0h
    fireEvent.change(safetyInput, { target: { value: '1.0' } });
    expect(safetyInput).toHaveValue(1);
  });

  it('Item 13: auto-reconciles short shift hours (50/50 split between Refueling and GES/Maintenance)', () => {
    // 8.0h worked, 2.4h standard delays -> 10.4h total -> 1.6h shortfall
    const result = reconcileShortShiftHours({
      startSmr: 1000,
      stopSmr: 1008,
      delays: createStandardOverviewDelays(),
      comment: 'Regular shift',
      maxShiftHours: 12,
    });

    expect(result.shortfallHours).toBe(1.6);
    // 1.6 / 2 = 0.8h each
    // refueling was 0.2 -> 0.2 + 0.8 = 1.0
    expect(result.delays.refueling).toBe(1.0);
    // gesMaintenance was 0.5 -> 0.5 + 0.8 = 1.3
    expect(result.delays.gesMaintenance).toBe(1.3);
    expect(result.comment).toContain('Shift Shortfall 50/50 Reconciled');
  });

  it('Item 14: clarifies "Other" delay column as "External / Non-Site (e.g. DMRE)"', () => {
    render(
      <EngineeringOverviewTable
        departmentId="dept-cr"
        shiftDate="2026-10-26"
        initialShiftType="day"
        initialRows={[sampleRow]}
        operators={[]}
      />
    );

    expect(screen.getByTitle('External / Non-Site (e.g. DMRE)')).toBeInTheDocument();
  });
});
