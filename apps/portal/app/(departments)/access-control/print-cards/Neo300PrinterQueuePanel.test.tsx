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
  emp_code: 'EMP-ALICE',
  first_name: 'Alice',
  surname: 'ADT',
  id_number: '9001015009081',
  job_title: 'ADT Operator',
  department_id: 'dept-1',
  department_name: 'Production',
  area: 'Main Complex',
  status: 'Active',
  medical_expiry: '2099-01-01',
  induction_expiry: '2099-01-01',
  photo_url: null,
  qr_code: 'BADGE-EMP-ALICE',
  rfid_code: 'RFID-1',
};

const printer: Neo300Printer = {
  id: 'neo-1',
  name: 'Neo 300',
  model: 'Magicard Neo 300',
  status: 'online',
  ribbon_remaining_pct: 80,
  hopper_cards: 50,
  ip_address: '127.0.0.1',
  port: 9100,
};

const jobs: CardPrintJob[] = [
  {
    id: 'job-1',
    employee_id: 'emp-1-abcdef123456',
    employee_name: 'Alice ADT',
    emp_code: 'EMP-ALICE',
    printer_id: 'neo-1',
    status: 'printing',
    submitted_at: '2026-11-20T08:00:00Z',
  },
];

describe('Neo300PrinterQueuePanel', () => {
  it('renders digital front/back, Plantcor Card template, and triggers print/edit/cancel', () => {
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

    expect(screen.getAllByText('Alice ADT').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByText(/MAGICARD SECURE HOLOPRINT/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Plantcor Card' }));
    const templateImg = screen.getByAltText('Plantcor Pty Ltd Access Card Template');
    expect(templateImg).toHaveAttribute('src', '/images/access-card-template.jpeg');

    fireEvent.click(screen.getByRole('button', { name: /Edit Photo & Details/i }));
    expect(onEditEmployee).toHaveBeenCalledWith(employee);
  });
});
