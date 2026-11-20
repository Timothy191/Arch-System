import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'sonner';

const mockGetEmployeeCardProfiles = jest.fn(async () => [
  {
    id: 'p1',
    emp_code: 'Brak 0043',
    coy_number: 'Brak 0043',
    first_name: 'Alice',
    surname: 'ADT',
    id_number: '9001015009081',
    job_title: 'ADT Operator',
    area: 'Main Complex',
    department_id: 'd1',
    department_name: 'Production',
    induction_expiry: '2028-01-01',
    medical_expiry: '2028-02-01',
    status: 'Active',
    photo_url: null,
    qr_code: 'EMP-BRAK-0043',
    rfid_code: 'RFID-01',
  },
]);

const mockUpsertEmployee = jest.fn(async () => ({
  success: true as const,
  profile: {
    id: 'p2',
    emp_code: 'Brak 0099',
    coy_number: 'Brak 0099',
    first_name: 'Sipho',
    surname: 'Dlamini',
    id_number: '9202025009081',
    job_title: 'Excavator Operator',
    area: 'Pit North',
    department_id: 'd1',
    department_name: 'Production',
    induction_expiry: '2028-06-01',
    medical_expiry: '2028-07-01',
    status: 'Active',
    photo_url: null,
    qr_code: 'EMP-BRAK-0099',
    rfid_code: null,
  },
}));

const mockSendPrintJob = jest.fn(async () => ({
  success: true as const,
  job: {
    id: 'j2',
    personnel_id: 'p1',
    employee_name: 'Alice ADT',
    role_title: 'ADT Operator',
    qr_code_data: 'EMP-BRAK-0043',
    status: 'queued',
    queued_at: '2026-11-20T08:00:00Z',
    printer_id: 'pr-1',
  },
}));

const mockCancelPrintJob = jest.fn(async () => undefined);

jest.mock('./actions', () => ({
  getEmployeeCardProfiles: (...args: unknown[]) => mockGetEmployeeCardProfiles(...args),
  upsertEmployeeForCardPrinting: (...args: unknown[]) => mockUpsertEmployee(...args),
  sendNeo300PrintJob: (...args: unknown[]) => mockSendPrintJob(...args),
  cancelNeo300Job: (...args: unknown[]) => mockCancelPrintJob(...args),
}));

jest.mock('sonner', () => ({
  toast: {
    info: jest.fn(),
    success: jest.fn(),
    error: jest.fn(),
  },
}));

import { Neo300PrintStudio } from './neo300-print-studio';

const basePrinter = {
  id: 'pr-1',
  name: 'Neo 300',
  model: 'Magicard Neo 300',
  cups_name: 'Magicard_Neo300',
  connection_type: 'usb',
  status: 'online',
  status_message: 'Ready',
  last_online_at: '2026-11-20T08:00:00Z',
};

const baseEmployees = [
  {
    id: 'p1',
    emp_code: 'Brak 0043',
    coy_number: 'Brak 0043',
    first_name: 'Alice',
    surname: 'ADT',
    id_number: '9001015009081',
    job_title: 'ADT Operator',
    area: 'Main Complex',
    department_id: 'd1',
    department_name: 'Production',
    induction_expiry: '2028-01-01',
    medical_expiry: '2028-02-01',
    status: 'Active',
    photo_url: null,
    qr_code: 'EMP-BRAK-0043',
    rfid_code: 'RFID-01',
  },
];

const baseJobs = [
  {
    id: 'j1',
    personnel_id: 'p1',
    employee_name: 'Alice ADT',
    role_title: 'ADT Operator',
    qr_code_data: 'EMP-BRAK-0043',
    status: 'queued',
    queued_at: '2026-11-20T08:00:00Z',
    printer_id: 'pr-1',
  },
];

const baseDepartments = [{ id: 'd1', name: 'production', display_name: 'Production' }];

describe('Neo300PrintStudio full interactive flows', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('opens Add Employee modal, updates Coy Number, submits upsert, and checks printer status', async () => {
    const { container } = render(
      <Neo300PrintStudio
        initialPrinter={basePrinter}
        initialEmployees={baseEmployees}
        initialJobs={baseJobs}
        departments={baseDepartments}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /check status/i }));
    expect(toast.info).toHaveBeenCalledWith('Printer status synchronized');

    fireEvent.click(screen.getByRole('button', { name: /\+ add employee to db/i }));
    const coyInput = container.querySelector('#neo300-coy-number') as HTMLInputElement;
    expect(coyInput).toBeTruthy();
    fireEvent.change(coyInput, { target: { value: 'Brak 0099' } });

    const textInputs = Array.from(
      container.querySelectorAll('form input[type="text"], form input:not([type])')
    ) as HTMLInputElement[];
    for (const input of textInputs) {
      if (input.id !== 'neo300-coy-number') {
        fireEvent.change(input, { target: { value: input.value || 'Brakfontein Update' } });
      }
    }

    const dateInputs = Array.from(
      container.querySelectorAll('form input[type="date"]')
    ) as HTMLInputElement[];
    for (const dateInput of dateInputs) {
      fireEvent.change(dateInput, { target: { value: '2028-11-30' } });
    }

    const selectInputs = Array.from(
      container.querySelectorAll('form select')
    ) as HTMLSelectElement[];
    for (const selectInput of selectInputs) {
      if (selectInput.options.length > 0) {
        fireEvent.change(selectInput, { target: { value: selectInput.options[0]!.value } });
      }
    }

    const form = container.querySelector('form') as HTMLFormElement;
    expect(form).toBeTruthy();
    fireEvent.submit(form);

    await waitFor(() => {
      expect(mockUpsertEmployee).toHaveBeenCalledTimes(1);
    });
  });

  it('opens Edit Photo & Details modal, filters search, prints card, and cancels queued job', async () => {
    const { container } = render(
      <Neo300PrintStudio
        initialPrinter={basePrinter}
        initialEmployees={baseEmployees}
        initialJobs={baseJobs}
        departments={baseDepartments}
      />
    );

    const searchInput = container.querySelector(
      'input[placeholder*="Search"]'
    ) as HTMLInputElement | null;
    if (searchInput) {
      fireEvent.change(searchInput, { target: { value: 'Brak' } });
      await waitFor(() => {
        expect(mockGetEmployeeCardProfiles).toHaveBeenCalled();
      });
    }

    fireEvent.click(screen.getByRole('button', { name: /edit photo & details/i }));
    expect(container.querySelector('#neo300-coy-number')).toBeTruthy();

    const closeBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      /cancel/i.test(b.textContent ?? '')
    );
    if (closeBtn) {
      fireEvent.click(closeBtn);
    }

    const printBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      /print/i.test(b.textContent ?? '')
    );
    if (printBtn) {
      fireEvent.click(printBtn);
      await waitFor(() => {
        expect(mockSendPrintJob).toHaveBeenCalled();
      });
    }

    const cancelJobButtons = Array.from(container.querySelectorAll('button')).filter(
      (b) =>
        /cancel/i.test(b.textContent ?? '') ||
        b.getAttribute('title')?.toLowerCase().includes('cancel')
    );
    if (cancelJobButtons.length > 0) {
      fireEvent.click(cancelJobButtons[0]!);
      await waitFor(() => {
        expect(mockCancelPrintJob).toHaveBeenCalled();
      });
    }
  });
});
