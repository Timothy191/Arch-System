import {
  buildProfileDetails,
  type DepartmentRow,
  type EmployeeRow,
  formatDisplayNameFromEmail,
  formatProfileDate,
  formatRoleLabel,
  getInitials,
  getProfileDetails,
} from './profile';

interface MockSupabaseServerModule {
  createServerSupabaseClient: jest.Mock;
  getUserSafely: jest.Mock;
}

jest.mock('@repo/supabase/server', () => ({
  createServerSupabaseClient: jest.fn(),
  getUserSafely: jest.fn(),
}));

const { createServerSupabaseClient, getUserSafely } =
  jest.requireMock<MockSupabaseServerModule>('@repo/supabase/server');

const MOCK_DEPARTMENTS: readonly DepartmentRow[] = [
  { id: 'dept-drilling', name: 'drilling', display_name: 'Drilling Operations' },
  { id: 'dept-engineering', name: 'engineering', display_name: 'Engineering' },
  { id: 'dept-production', name: 'production', display_name: 'Production' },
];

const MOCK_EMPLOYEE: EmployeeRow = {
  id: 'employee-uuid',
  full_name: 'Thandiwe Mbeki',
  role: 'supervisor',
  department_id: 'dept-drilling',
  accessible_departments: ['dept-drilling', 'dept-production'],
  created_at: '2025-03-15T08:00:00.000Z',
  updated_at: '2026-01-02T10:30:00.000Z',
};

describe('formatRoleLabel', () => {
  it('maps known role slugs to human labels', () => {
    expect(formatRoleLabel('admin')).toBe('Administrator');
    expect(formatRoleLabel('control_room_operator')).toBe('Control Room Operator');
  });

  it('reads unknown slugs as words (no invented labels)', () => {
    expect(formatRoleLabel('plant_manager')).toBe('plant manager');
  });

  it('returns Unassigned for empty roles', () => {
    expect(formatRoleLabel('')).toBe('Unassigned');
    expect(formatRoleLabel('   ')).toBe('Unassigned');
  });
});

describe('getInitials', () => {
  it('uses the first letters of the first two words', () => {
    expect(getInitials('Thandiwe Mbeki')).toBe('TM');
  });

  it('takes two letters from a single word', () => {
    expect(getInitials('Operator')).toBe('OP');
  });
});

describe('formatDisplayNameFromEmail', () => {
  it('splits separators into spaces', () => {
    expect(formatDisplayNameFromEmail('thandiwe.mbeki@arch.systems')).toBe('thandiwe mbeki');
  });

  it('falls back to a neutral label when there is no email', () => {
    expect(formatDisplayNameFromEmail(null)).toBe('Signed-in user');
    expect(formatDisplayNameFromEmail('')).toBe('Signed-in user');
  });
});

describe('formatProfileDate', () => {
  it('formats valid ISO timestamps', () => {
    expect(formatProfileDate('2025-03-15T08:00:00.000Z')).toMatch(/2025/);
  });

  it('returns null for missing or invalid timestamps', () => {
    expect(formatProfileDate(null)).toBeNull();
    expect(formatProfileDate('not-a-date')).toBeNull();
  });
});

describe('buildProfileDetails', () => {
  it('maps employee and department rows to the profile view model', () => {
    const profile = buildProfileDetails({
      email: 'thandiwe.mbeki@arch.systems',
      employee: MOCK_EMPLOYEE,
      departments: MOCK_DEPARTMENTS,
    });

    expect(profile.fullName).toBe('Thandiwe Mbeki');
    expect(profile.initials).toBe('TM');
    expect(profile.roleLabel).toBe('Supervisor');
    expect(profile.primaryDepartment?.displayName).toBe('Drilling Operations');
    expect(profile.accessibleDepartments.map((department) => department.id)).toEqual([
      'dept-drilling',
      'dept-production',
    ]);
    expect(profile.employeeId).toBe('employee-uuid');
    expect(profile.memberSince).toMatch(/2025/);
    expect(profile.lastUpdated).toMatch(/2026/);
  });

  it('drops accessible ids without a matching department row', () => {
    const profile = buildProfileDetails({
      email: 'thandiwe.mbeki@arch.systems',
      employee: {
        ...MOCK_EMPLOYEE,
        accessible_departments: ['dept-drilling', 'dept-ghost'],
      },
      departments: MOCK_DEPARTMENTS,
    });

    expect(profile.accessibleDepartments.map((department) => department.id)).toEqual([
      'dept-drilling',
    ]);
  });

  it('falls back to the email-derived name when there is no employee row', () => {
    const profile = buildProfileDetails({
      email: 'thandiwe.mbeki@arch.systems',
      employee: null,
      departments: MOCK_DEPARTMENTS,
    });

    expect(profile.fullName).toBe('thandiwe mbeki');
    expect(profile.initials).toBe('TM');
    expect(profile.roleLabel).toBe('Unassigned');
    expect(profile.primaryDepartment).toBeNull();
    expect(profile.accessibleDepartments).toEqual([]);
    expect(profile.employeeId).toBeNull();
    expect(profile.memberSince).toBeNull();
  });

  it('returns null for a primary department id that does not exist', () => {
    const profile = buildProfileDetails({
      email: 'thandiwe.mbeki@arch.systems',
      employee: { ...MOCK_EMPLOYEE, department_id: 'dept-ghost' },
      departments: MOCK_DEPARTMENTS,
    });

    expect(profile.primaryDepartment).toBeNull();
  });
});

describe('getProfileDetails', () => {
  function mockSupabaseQueries(
    employeeResult: { data: EmployeeRow | null },
    departmentResult: { data: DepartmentRow[] | null }
  ) {
    createServerSupabaseClient.mockResolvedValue({
      from: jest.fn((table: string) => {
        if (table === 'employees') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue(employeeResult),
              }),
            }),
          };
        }
        return {
          select: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue(departmentResult),
          }),
        };
      }),
    });
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('joins the employee row with the department registry for the verified user', async () => {
    getUserSafely.mockResolvedValue({ id: 'auth-uuid', email: 'thandiwe.mbeki@arch.systems' });
    mockSupabaseQueries({ data: MOCK_EMPLOYEE }, { data: [...MOCK_DEPARTMENTS] });

    await expect(getProfileDetails()).resolves.toMatchObject({
      fullName: 'Thandiwe Mbeki',
      roleLabel: 'Supervisor',
      primaryDepartment: { name: 'drilling' },
    });
  });

  it('returns null when no verified identity exists', async () => {
    getUserSafely.mockResolvedValue(null);

    await expect(getProfileDetails()).resolves.toBeNull();
  });
});
