import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'sonner';
import type {
  CardPrintJob,
  CardStudioDepartment,
  EmployeeCardProfile,
  Neo300Printer,
} from './actions';
import { getEmployeeCardProfiles, upsertEmployeeForCardPrinting } from './actions';
import { Neo300PrintStudio } from './neo300-print-studio';

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt, src }: { alt: string; src: string }) => <img alt={alt} src={src} />,
}));

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

jest.mock('../components/QRCodeSection', () => ({
  QRCodeSection: ({ data }: { data: string }) => <div data-testid="qr">{data}</div>,
}));

jest.mock('./actions', () => ({
  getEmployeeCardProfiles: jest.fn(),
  getNeo300PrinterStatus: jest.fn(),
  upsertEmployeeForCardPrinting: jest.fn(),
  sendNeo300PrintJob: jest.fn(),
  cancelNeo300Job: jest.fn(),
}));

const initialEmployees: EmployeeCardProfile[] = [
  {
    id: 'emp-1',
    emp_code: 'OP-DT-77',
    coy_number: 'OP-DT-77',
    first_name: 'Alice',
    surname: 'ADT',
    id_number: '9001015009081',
    job_title: 'ADT Operator',
    department_id: 'dept-prod',
    department_name: 'Production',
    area: 'Main Complex',
    status: 'Active',
    medical_expiry: '2027-06-15',
    induction_expiry: '2027-08-20',
    photo_url: null,
    qr_code: 'EMP-OP-DT-77',
    rfid_code: 'RFID-77',
    has_card: true,
  },
];

const printer: Neo300Printer = {
  id: 'neo-1',
  name: 'Security Gate Neo300',
  model: 'Magicard Neo 300',
  cups_name: 'Magicard_Neo300',
  connection_type: 'usb',
  status: 'online',
  status_message: 'Ready',
  last_online_at: '2026-11-20T08:00:00Z',
};

const jobs: CardPrintJob[] = [];
const departments: CardStudioDepartment[] = [
  { id: 'dept-prod', name: 'production', display_name: 'Production' },
];

describe('Neo300PrintStudio Coy Number & Expiry Dates workflow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('edits an employee Coy Number to Brak 0043 preserving case and persists via upsertEmployeeForCardPrinting', async () => {
    const updatedEmp: EmployeeCardProfile = {
      ...initialEmployees[0]!,
      emp_code: 'Brak 0043',
      coy_number: 'Brak 0043',
      qr_code: 'EMP-BRAK-0043',
    };
    (upsertEmployeeForCardPrinting as jest.Mock).mockResolvedValue(updatedEmp);
    (getEmployeeCardProfiles as jest.Mock).mockResolvedValue([updatedEmp]);

    render(
      <Neo300PrintStudio
        initialPrinter={printer}
        initialEmployees={initialEmployees}
        initialJobs={jobs}
        departments={departments}
      />
    );

    expect(screen.getByTestId('employee-row-qr-emp-1')).toHaveTextContent('EMP-OP-DT-77');
    expect(screen.queryByText('AA')).not.toBeInTheDocument();
    expect(screen.getByTestId('plantcor-card-medical-date')).toHaveTextContent('2027-06-15');
    expect(screen.getByTestId('plantcor-card-induction-date')).toHaveTextContent('2027-08-20');

    fireEvent.click(screen.getByRole('button', { name: /Edit Photo & Details/i }));
    const coyInput = screen.getByLabelText('Coy Number *');
    expect(coyInput).toHaveValue('OP-DT-77');

    fireEvent.change(coyInput, { target: { value: 'Brak 0043' } });
    fireEvent.click(screen.getByRole('button', { name: /Update Employee & Card Details/i }));

    await waitFor(() => {
      expect(upsertEmployeeForCardPrinting).toHaveBeenCalledWith(
        expect.objectContaining({
          coy_number: 'Brak 0043',
          emp_code: 'Brak 0043',
          qr_code: 'EMP-OP-DT-77',
        })
      );
      expect(screen.getByTestId('plantcor-card-coy-number')).toHaveTextContent('Brak 0043');
      expect(toast.success).toHaveBeenCalled();
    });
  });

  it('shows an explicit unavailable state when no real QR credential exists', () => {
    const employeeWithoutQr = { ...initialEmployees[0]!, qr_code: null };

    render(
      <Neo300PrintStudio
        initialPrinter={printer}
        initialEmployees={[employeeWithoutQr]}
        initialJobs={jobs}
        departments={departments}
      />
    );

    expect(screen.getByTestId('employee-row-qr-emp-1')).toHaveTextContent('NO QR');
    expect(screen.queryByText('EMP-OP-DT-77')).not.toBeInTheDocument();
  });
});
