import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { getDepartmentContext, requireDepartment } from '~/lib/dept-context';
import { getMultiSiteShiftReport, getUnifiedShiftReport } from './actions';
import ShiftCompilationPage from './page';

jest.mock('next/server', () => ({
  connection: jest.fn(async () => undefined),
}));

jest.mock('@repo/utils', () => ({
  getCurrentShift: jest.fn(() => 'day'),
}));

jest.mock('@repo/supabase', () => ({
  getAuthenticatedEmployee: jest.fn(async () => ({
    user: {
      id: 'user-1',
      email: 'dispatch@plantcor.co.za',
      user_metadata: { full_name: 'L. Dlamini' },
    },
    employee: { id: 'emp-1', role: 'supervisor' },
  })),
}));

const mockLimit = jest.fn(async () => ({
  data: [
    {
      id: 'rep-1',
      report_date: '2026-10-22',
      shift_type: 'day',
      operator_name: 'L. Dlamini',
      status: 'submitted',
      submitter_id: 'emp-1',
      created_by: 'emp-1',
      approver_id: null,
      approval_note: null,
      approved_at: null,
      created_at: '2026-10-22T06:00:00Z',
    },
  ],
}));

jest.mock('@repo/supabase/server', () => ({
  createServerSupabaseClient: jest.fn(async () => ({
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: mockLimit,
    })),
  })),
}));

jest.mock('~/lib/control-room-fleet-smr', () => ({
  getFleetOpeningSmrSnapshot: jest.fn(async () => ({ closeoutFleet: [] })),
}));

jest.mock('~/lib/dept-context', () => ({
  getDepartmentContext: jest.fn(async ({ department }: { department: string }) => ({
    deptId: 'dept-cr-01',
    today: '2026-10-22',
    dept: { name: department, displayName: 'Control Room', type: 'control_room' },
  })),
  requireDepartment: jest.fn((department: string, allowed: string) => {
    if (department !== allowed) {
      throw new Error('NEXT_NOT_FOUND');
    }
  }),
}));

jest.mock('./actions', () => ({
  getUnifiedShiftReport: jest.fn(async () => ({
    data: {
      meta: {
        department_id: 'dept-cr-01',
        shift_date: '2026-10-22',
        shift_type: 'day',
        compiled_at: '2026-10-22T12:00:00Z',
      },
      shift_status: { status: 'open' },
      production: { total_loads: 42, machines: [] },
      fleet_performance: [],
      breakdowns: [],
      tire_management: [],
    },
  })),
  getMultiSiteShiftReport: jest.fn(async () => ({ data: null })),
}));

jest.mock('./ShiftCompilationClient', () => ({
  ShiftCompilationClient: ({
    departmentSlug,
    shiftDate,
    shiftType,
    initialSection,
    initialReport,
    recentCloseoutReports,
  }: {
    departmentSlug: string;
    shiftDate: string;
    shiftType: string;
    initialSection: string;
    initialReport: { production: { total_loads: number } };
    recentCloseoutReports: Array<{ id: string }>;
  }) => (
    <div data-testid="shift-compilation-client">
      <span data-testid="dept-slug">{departmentSlug}</span>
      <span data-testid="shift-date">{shiftDate}</span>
      <span data-testid="shift-type">{shiftType}</span>
      <span data-testid="initial-section">{initialSection}</span>
      <span data-testid="total-loads">{initialReport.production.total_loads}</span>
      <span data-testid="recent-count">{recentCloseoutReports.length}</span>
    </div>
  ),
}));

describe('ShiftCompilationPage ([department]/shift-compilation/page.tsx)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('requires control-room department and rejects other department slugs', async () => {
    await expect(
      ShiftCompilationPage({
        params: Promise.resolve({ department: 'production' }),
        searchParams: Promise.resolve({}),
      })
    ).rejects.toThrow('NEXT_NOT_FOUND');

    expect(requireDepartment).toHaveBeenCalledWith('production', 'control-room');
    expect(getDepartmentContext).not.toHaveBeenCalled();
  });

  it('renders ShiftCompilationClient with fetched report and closeout summaries', async () => {
    const jsx = await ShiftCompilationPage({
      params: Promise.resolve({ department: 'control-room' }),
      searchParams: Promise.resolve({ date: '2026-10-21', shift: 'night', tab: 'closeout' }),
    });
    render(jsx);

    expect(requireDepartment).toHaveBeenCalledWith('control-room', 'control-room');
    expect(getUnifiedShiftReport).toHaveBeenCalledWith('dept-cr-01', '2026-10-21', 'night');
    expect(getMultiSiteShiftReport).toHaveBeenCalledWith('dept-cr-01', '2026-10-21', 'night');
    expect(screen.getByTestId('dept-slug')).toHaveTextContent('control-room');
    expect(screen.getByTestId('shift-date')).toHaveTextContent('2026-10-21');
    expect(screen.getByTestId('shift-type')).toHaveTextContent('night');
    expect(screen.getByTestId('initial-section')).toHaveTextContent('closeout');
    expect(screen.getByTestId('total-loads')).toHaveTextContent('42');
    expect(screen.getByTestId('recent-count')).toHaveTextContent('1');
  });

  it('uses fallback report and default searchParams when compiledReport is null', async () => {
    (getUnifiedShiftReport as jest.Mock).mockResolvedValueOnce({ data: null });
    mockLimit.mockResolvedValueOnce({ data: null as unknown as [] });

    const jsx = await ShiftCompilationPage({
      params: Promise.resolve({ department: 'control-room' }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    expect(screen.getByTestId('shift-date')).toHaveTextContent('2026-10-22');
    expect(screen.getByTestId('shift-type')).toHaveTextContent('day');
    expect(screen.getByTestId('initial-section')).toHaveTextContent('handover');
    expect(screen.getByTestId('total-loads')).toHaveTextContent('0');
    expect(screen.getByTestId('recent-count')).toHaveTextContent('0');
  });
});
