import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { DepartmentsTab } from './DepartmentsTab';

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

const MOCK_DEPARTMENTS = [
  {
    id: 'dept-access',
    name: 'access-card-actions',
    display_name: 'Access Card Actions',
    description: null,
    color: 'amber',
    icon: 'CreditCard',
    created_at: '2026-01-15T10:00:00Z',
  },
  {
    id: 'dept-prod',
    name: 'production',
    display_name: 'Production',
    description: null,
    color: 'emerald',
    icon: 'Truck',
    created_at: '2026-01-10T10:00:00Z',
  },
];

const MOCK_SITES = [
  { id: 'site-1', name: 'Brakfontein Pit', site_code: 'BRAK-PIT', active: true },
  { id: 'site-2', name: 'North Pit', site_code: 'NORTH-PIT', active: true },
];

const MOCK_BLOCKS = [
  { id: 'blk-1', name: 'Block A', code: 'BLK-A', site_id: 'site-1', active: true },
  { id: 'blk-2', name: 'Block B', code: 'BLK-B', site_id: 'site-2', active: true },
];

const MOCK_EMPLOYEES = [
  {
    id: 'emp-1',
    full_name: 'Thabo Mokoena',
    role: 'operator',
    job_title: 'Security Lead',
    department_id: 'dept-access',
    accessible_departments: ['access-card-actions'],
    areas: ['All Areas'],
  },
  {
    id: 'emp-2',
    full_name: 'Sipho Dlamini',
    role: 'supervisor',
    job_title: 'Shift Boss',
    department_id: 'dept-prod',
    accessible_departments: ['production'],
    areas: ['Pit Area'],
  },
];

const MOCK_ACCESS_GRANTS = [
  { department_id: 'dept-access', employee_id: 'emp-1', access_level: 'operate' },
  { department_id: 'dept-access', employee_id: 'emp-2', access_level: 'read' },
  { department_id: 'dept-prod', employee_id: 'emp-2', access_level: 'operate' },
];

const MOCK_MACHINES = [
  {
    id: 'm-1',
    name: 'DT-102',
    machine_type: 'Articulated Dumper',
    active: true,
    department_id: 'dept-prod',
    site_id: 'site-1',
    starting_smr: 11850,
  },
];

const MOCK_BREAKDOWNS = [
  {
    id: 'bd-1',
    department_id: 'dept-prod',
    status: 'open',
    site_code: 'BRAK-PIT',
    date_in: '2026-11-23',
    delay_hours: 4.5,
  },
];

const MOCK_DAILY_LOGS = [
  { id: 'dl-1', department_id: 'dept-prod', log_date: '2026-11-23', shift: 'day' },
];

const mockInsertSingle = jest.fn().mockResolvedValue({
  data: {
    id: 'dept-new',
    name: 'safety-compliance',
    display_name: 'Safety Compliance',
    description: null,
    color: 'blue',
    icon: 'ShieldCheck',
    created_at: '2026-11-24T06:00:00Z',
  },
  error: null,
});

const mockUpdateEq = jest.fn().mockResolvedValue({ error: null });

const mockSupabaseClient = {
  from: jest.fn((table: string) => {
    if (table === 'departments') {
      return {
        select: jest.fn().mockReturnValue({
          is: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({ data: MOCK_DEPARTMENTS, error: null }),
          }),
        }),
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: mockInsertSingle,
          }),
        }),
        update: jest.fn().mockReturnValue({
          eq: mockUpdateEq,
        }),
      };
    }
    if (table === 'sites') {
      return {
        select: jest.fn().mockReturnValue({
          is: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({ data: MOCK_SITES, error: null }),
          }),
        }),
      };
    }
    if (table === 'mine_blocks') {
      return {
        select: jest.fn().mockReturnValue({
          is: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({ data: MOCK_BLOCKS, error: null }),
          }),
        }),
      };
    }
    if (table === 'employees') {
      return {
        select: jest.fn().mockReturnValue({
          is: jest.fn().mockResolvedValue({ data: MOCK_EMPLOYEES, error: null }),
        }),
      };
    }
    if (table === 'employee_department_access') {
      return {
        select: jest.fn().mockResolvedValue({ data: MOCK_ACCESS_GRANTS, error: null }),
      };
    }
    if (table === 'machines') {
      return {
        select: jest.fn().mockReturnValue({
          is: jest.fn().mockResolvedValue({ data: MOCK_MACHINES, error: null }),
        }),
      };
    }
    if (table === 'breakdowns') {
      return {
        select: jest.fn().mockReturnValue({
          is: jest.fn().mockReturnValue({
            in: jest.fn().mockResolvedValue({ data: MOCK_BREAKDOWNS, error: null }),
          }),
        }),
      };
    }
    return {
      select: jest.fn().mockReturnValue({
        order: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({ data: MOCK_DAILY_LOGS, error: null }),
        }),
      }),
    };
  }),
};

jest.mock('@repo/supabase/client', () => ({
  createBrowserSupabaseClient: jest.fn(() => mockSupabaseClient),
}));

describe('DepartmentsTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the full-panel header KPIs and live division metrics', async () => {
    render(<DepartmentsTab />);

    const header = screen.getByTestId('departments-full-panel-header');
    expect(header).toBeInTheDocument();
    expect(screen.getByText('Departments & Areas')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('2 Divisions · 2 Active Sites')).toBeInTheDocument();
      expect(screen.getByText('2/2')).toBeInTheDocument();
      expect(screen.getByText('1/1')).toBeInTheDocument();
      expect(screen.getByText('1 open alerts')).toBeInTheDocument();
    });
  });

  it('expands Access Card Actions as an interactive dropdown with full site details and metrics', async () => {
    render(<DepartmentsTab />);

    await waitFor(() => {
      expect(screen.getByTestId('department-row-access-card-actions')).toBeInTheDocument();
    });

    const toggleBtn = screen
      .getByTestId('department-row-access-card-actions')
      .querySelector('button[aria-expanded]')!;
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(toggleBtn);
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');

    const detailsPanel = screen.getByTestId('department-details-access-card-actions');
    expect(detailsPanel).toBeInTheDocument();
    expect(detailsPanel).toHaveTextContent('Cross-Site Operations Coverage');
    expect(detailsPanel).toHaveTextContent('BRAK-PIT');
    expect(detailsPanel).toHaveTextContent('Brakfontein Pit');
    expect(detailsPanel).toHaveTextContent('BLK-A · Block A');
    expect(detailsPanel).toHaveTextContent('1 Read+Write · 1 Read Only');
    expect(detailsPanel).toHaveTextContent('Thabo Mokoena');

    fireEvent.click(toggleBtn);
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('department-details-access-card-actions')).not.toBeInTheDocument();
  });

  it('supports Expand All / Collapse All, search filtering, adding an area, and archiving an area', async () => {
    render(<DepartmentsTab />);

    await waitFor(() => {
      expect(screen.getByTestId('department-row-production')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Expand All/i }));
    expect(screen.getByTestId('department-details-access-card-actions')).toBeInTheDocument();
    expect(screen.getByTestId('department-details-production')).toHaveTextContent(
      'Direct Machine / Event Assignment'
    );
    expect(screen.getByTestId('department-details-production')).toHaveTextContent(
      '11,850 hrs baseline SMR'
    );

    fireEvent.click(screen.getByRole('button', { name: /Collapse All/i }));
    expect(screen.queryByTestId('department-details-production')).not.toBeInTheDocument();

    const searchInput = screen.getByLabelText('Search departments');
    fireEvent.change(searchInput, { target: { value: 'Production' } });
    expect(screen.getByTestId('department-row-production')).toBeInTheDocument();
    expect(screen.queryByTestId('department-row-access-card-actions')).not.toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: '' } });

    fireEvent.change(screen.getByPlaceholderText('Add new area...'), {
      target: { value: 'Safety Compliance' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Add Area/i }));

    await waitFor(() => {
      expect(screen.getByTestId('department-row-safety-compliance')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Remove Safety Compliance' }));
    await waitFor(() => {
      expect(mockUpdateEq).toHaveBeenCalledWith('id', 'dept-new');
      expect(screen.queryByTestId('department-row-safety-compliance')).not.toBeInTheDocument();
    });
  });
});
