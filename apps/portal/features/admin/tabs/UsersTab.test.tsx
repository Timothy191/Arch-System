import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { UsersTab } from './UsersTab';

const mockGetUsersAdminData = jest.fn();
const mockUpsertEmployeeAdmin = jest.fn();
const mockDeactivateEmployeeAdmin = jest.fn();
const mockUploadEmployeePhoto = jest.fn();

jest.mock('./actions', () => ({
  getUsersAdminData: (...args: unknown[]) => mockGetUsersAdminData(...args),
  upsertEmployeeAdmin: (...args: unknown[]) => mockUpsertEmployeeAdmin(...args),
  deactivateEmployeeAdmin: (...args: unknown[]) => mockDeactivateEmployeeAdmin(...args),
  uploadEmployeePhoto: (...args: unknown[]) => mockUploadEmployeePhoto(...args),
}));

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

const DEPARTMENTS = [
  { id: 'dept-drilling', display_name: 'Drilling' },
  { id: 'dept-production', display_name: 'Production' },
  { id: 'dept-engineering', display_name: 'Engineering' },
];

const SITES = [{ id: 'site-1', name: 'Brakfontein Pit', site_code: 'BRAK' }];

const EXISTING_USER = {
  id: 'emp-1',
  auth_id: 'auth-1',
  record_type: 'user' as const,
  full_name: 'Thabo Mokoena',
  first_name: 'Thabo',
  last_name: 'Mokoena',
  gender: 'male' as const,
  date_of_birth: '1990-04-12',
  national_id: '9004125009087',
  job_title: 'Shift Supervisor',
  areas: ['Brakfontein Pit'],
  medical_expiry_date: '2027-06-01',
  induction_expiry_date: '2027-07-01',
  employee_code: 'COY-1001',
  qr_code_data: 'QR-COY-1001',
  photo_url: null,
  role: 'supervisor',
  department_id: 'dept-drilling',
  accessible_departments: ['dept-drilling', 'dept-production'],
  department_permissions: {
    'dept-drilling': { read: true, write: true },
    'dept-production': { read: true, write: false },
  },
  created_at: '2026-01-01T00:00:00.000Z',
  departments: { display_name: 'Drilling' },
};

describe('UsersTab modal redesign, invite email, live areas & deactivation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUsersAdminData.mockResolvedValue({
      employees: [EXISTING_USER],
      departments: DEPARTMENTS,
      sites: SITES,
    });
    mockUpsertEmployeeAdmin.mockResolvedValue({ success: true });
    mockDeactivateEmployeeAdmin.mockResolvedValue({ success: true });
  });

  it('renders Account Type, Email for User, Gender/Birthday, live Areas, and Read+Write permissions in Add modal', async () => {
    render(<UsersTab />);

    await waitFor(() => {
      expect(screen.getByText('Thabo Mokoena')).toBeInTheDocument();
    });
    expect(screen.getByText('User')).toBeInTheDocument();
    expect(screen.getByText(/Male · Born 1990-04-12/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Add Employee/i }));

    const accountSelector = screen.getByTestId('account-type-selector');
    expect(accountSelector).toBeInTheDocument();
    expect(screen.getByTestId('account-type-employee')).toHaveAttribute('aria-checked', 'true');

    fireEvent.click(screen.getByTestId('account-type-user'));
    expect(screen.getByTestId('account-type-user')).toHaveAttribute('aria-checked', 'true');

    fireEvent.change(screen.getByLabelText(/Email Address/i), {
      target: { value: 'lerato@plantcor.co.za' },
    });
    fireEvent.change(screen.getByLabelText('Names'), { target: { value: 'Lerato' } });
    fireEvent.change(screen.getByLabelText('Surname'), { target: { value: 'Khumalo' } });
    fireEvent.click(screen.getByTestId('gender-female'));
    expect(screen.getByTestId('gender-female')).toHaveAttribute('aria-checked', 'true');

    fireEvent.change(screen.getByLabelText('Birthday'), { target: { value: '1994-09-18' } });
    fireEvent.change(screen.getByLabelText('Area'), { target: { value: 'Brakfontein Pit' } });

    const drillingCard = screen.getByTestId('dept-card-dept-drilling');
    fireEvent.click(drillingCard);
    fireEvent.click(screen.getByTestId('dept-card-dept-production'));

    expect(screen.getByText('2 Read · 2 Write enabled')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Production Write permission'));
    expect(screen.getByText('2 Read · 1 Write enabled')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Add User' }));

    await waitFor(() => {
      expect(mockUpsertEmployeeAdmin).toHaveBeenCalledWith(
        expect.objectContaining({
          record_type: 'user',
          email: 'lerato@plantcor.co.za',
          names: 'Lerato',
          surname: 'Khumalo',
          full_name: 'Lerato Khumalo',
          gender: 'female',
          birthday: '1994-09-18',
          area: 'Brakfontein Pit',
          accessible_departments: ['dept-drilling', 'dept-production'],
          department_permissions: {
            'dept-drilling': { read: true, write: true },
            'dept-production': { read: true, write: false },
          },
        })
      );
    });
  });

  it('hydrates existing User on Edit and confirms deactivation via dialog', async () => {
    render(<UsersTab />);

    await waitFor(() => {
      expect(screen.getByLabelText('Edit Thabo Mokoena')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('Edit Thabo Mokoena'));

    expect(screen.getByTestId('account-type-user')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('gender-male')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByLabelText('Birthday')).toHaveValue('1990-04-12');

    fireEvent.click(screen.getByRole('button', { name: 'All Read Only' }));
    expect(screen.getByText('2 Read · 0 Write enabled')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(mockUpsertEmployeeAdmin).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'emp-1',
          record_type: 'user',
          gender: 'male',
          birthday: '1990-04-12',
          department_permissions: {
            'dept-drilling': { read: true, write: false },
            'dept-production': { read: true, write: false },
          },
        })
      );
    });

    fireEvent.click(screen.getByLabelText('Deactivate Thabo Mokoena'));
    expect(screen.getByText('Deactivate Employee')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Deactivate' }));

    await waitFor(() => {
      expect(mockDeactivateEmployeeAdmin).toHaveBeenCalledWith('emp-1');
    });
  });
});
