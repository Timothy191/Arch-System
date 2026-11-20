import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import type { CardPrintJob, EmployeeCardProfile, Neo300Printer } from './actions';
import { Neo300PrinterQueuePanel } from './Neo300PrinterQueuePanel';

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt, src }: { alt: string; src: string }) => <img alt={alt} src={src} />,
}));

jest.mock('../card-actions/qr-section', () => ({
  QRCodeSection: ({ data }: { data: string }) => <div data-testid="qr">{data}</div>,
}));

const employee: EmployeeCardProfile = {
  id: 'emp-1-abcdef123456',
  emp_code: 'Brak 0043',
  coy_number: 'Brak 0043',
  first_name: 'Alice',
  surname: 'ADT',
  id_number: '9001015009081',
  job_title: 'ADT Operator',
  department_id: 'dept-1',
  department_name: 'Production',
  area: 'Main Complex',
  status: 'Active',
  medical_expiry: '2099-01-15',
  induction_expiry: '2099-06-30',
  photo_url: null,
  qr_code: 'EMP-BRAK-0043',
  rfid_code: 'RFID-1',
  has_card: true,
};

const printer: Neo300Printer = {
  id: 'neo-1',
  name: 'Neo 300',
  model: 'Magicard Neo 300',
  cups_name: 'Magicard_Neo300',
  connection_type: 'usb',
  status: 'online',
  status_message: 'Ready',
  last_online_at: '2026-11-20T08:00:00Z',
};

const jobs: CardPrintJob[] = [
  {
    id: 'job-1',
    personnel_id: 'emp-1-abcdef123456',
    employee_name: 'Alice ADT',
    role_title: 'ADT Operator',
    qr_code_data: 'EMP-BRAK-0043',
    status: 'printing',
    created_at: '2026-11-20T08:00:00Z',
    printer_id: 'neo-1',
  },
];

describe('Neo300PrinterQueuePanel', () => {
  it('defaults to Plantcor Card showing Coy Number and actual Medical & Induction dates, and toggles to Digital front/back', () => {
    const onEditEmployee = jest.fn();
    const onPrint = jest.fn();
    const onCancelJob = jest.fn();

    render(
      <Neo300PrinterQueuePanel
        selectedEmp={employee}
        printer={printer}
        jobs={jobs}
        isPending={false}
        onEditEmployee={onEditEmployee}
        onPrint={onPrint}
        onCancelJob={onCancelJob}
      />
    );

    const templateImg = screen.getByAltText('Plantcor Pty Ltd Access Card Template');
    expect(templateImg).toHaveAttribute('src', '/images/access-card-template.jpeg');

    expect(screen.getByTestId('plantcor-card-coy-number')).toHaveTextContent('Brak 0043');
    expect(screen.getByTestId('plantcor-card-medical-date')).toHaveTextContent('2099-01-15');
    expect(screen.getByTestId('plantcor-card-induction-date')).toHaveTextContent('2099-06-30');
    expect(screen.queryByText('PASS')).not.toBeInTheDocument();
    expect(screen.queryByText('VALID')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Digital' }));
    expect(screen.getByText('COY: Brak 0043')).toBeInTheDocument();
    expect(screen.getByText(/Med: 2099-01-15/)).toBeInTheDocument();
    expect(screen.getByText(/Induct: 2099-06-30/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByText(/MAGICARD SECURE HOLOPRINT/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Edit Photo & Details/i }));
    expect(onEditEmployee).toHaveBeenCalledWith(employee);
  });

  it('shows Not Set when expiry dates are missing and displays expired date text', () => {
    render(
      <Neo300PrinterQueuePanel
        selectedEmp={{
          ...employee,
          coy_number: null,
          emp_code: 'OP-DT-77',
          medical_expiry: '2020-02-01',
          induction_expiry: null,
        }}
        printer={printer}
        jobs={[]}
        isPending={false}
        onEditEmployee={jest.fn()}
        onPrint={jest.fn()}
        onCancelJob={jest.fn()}
      />
    );

    expect(screen.getByTestId('plantcor-card-coy-number')).toHaveTextContent('OP-DT-77');
    expect(screen.getByTestId('plantcor-card-medical-date')).toHaveTextContent('2020-02-01');
    expect(screen.getByTestId('plantcor-card-induction-date')).toHaveTextContent('Not Set');
  });
});
