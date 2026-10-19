/**
 * @jest-environment node
 */
import { createDepartment, getUsersAdminData, upsertEmployeeAdmin } from './actions';

jest.mock('@repo/supabase/server', () => ({
  createServerSupabaseClient: jest.fn(),
}));

jest.mock('@repo/redis', () => ({
  cacheInvalidateTags: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

const { createServerSupabaseClient } = jest.requireMock('@repo/supabase/server') as {
  createServerSupabaseClient: jest.Mock;
};

describe('admin UsersTab server actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('authorization gates', () => {
    it('rejects unauthenticated callers in getUsersAdminData', async () => {
      createServerSupabaseClient.mockResolvedValue({
        auth: {
          getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
        },
      });

      await expect(getUsersAdminData()).rejects.toThrow('Unauthorized');
    });

    it('rejects non-admin callers in getUsersAdminData', async () => {
      createServerSupabaseClient.mockResolvedValue({
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: { id: 'auth-operator-1' } },
            error: null,
          }),
        },
        from: jest.fn(() => ({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { role: 'operator' },
                error: null,
              }),
            }),
          }),
        })),
      });

      await expect(getUsersAdminData()).rejects.toThrow('Forbidden: admin role required');
    });

    it('rejects non-admin callers in createDepartment', async () => {
      createServerSupabaseClient.mockResolvedValue({
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: { id: 'auth-supervisor-1' } },
            error: null,
          }),
        },
        from: jest.fn(() => ({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { role: 'supervisor' },
                error: null,
              }),
            }),
          }),
        })),
      });

      await expect(createDepartment({ display_name: 'Plant' })).rejects.toThrow(
        'Forbidden: admin role required'
      );
    });

    it('rejects unauthenticated and non-admin callers in upsertEmployeeAdmin', async () => {
      createServerSupabaseClient.mockResolvedValueOnce({
        auth: {
          getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
        },
      });

      const basePayload = {
        names: 'Sipho',
        surname: 'Dlamini',
        full_name: 'Sipho Dlamini',
        id_number: '9001015800084',
        job_title: 'Excavator Operator',
        area: 'Pit Area',
        medical_expiry: '2027-06-30',
        induction_expiry: '2027-05-15',
        coy_number: 'COY-1042',
        qr_code: 'QR-COY-1042',
        photo_url: '',
        role: 'operator',
        department_id: 'dept-1',
        accessible_departments: ['dept-1'],
      };

      const unauthRes = await upsertEmployeeAdmin(basePayload);
      expect(unauthRes).toEqual({ success: false, error: 'Unauthorized' });

      createServerSupabaseClient.mockResolvedValueOnce({
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: { id: 'auth-op-1' } },
            error: null,
          }),
        },
        from: jest.fn(() => ({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { role: 'operator' },
                error: null,
              }),
            }),
          }),
        })),
      });

      const forbiddenRes = await upsertEmployeeAdmin(basePayload);
      expect(forbiddenRes).toEqual({
        success: false,
        error: 'Forbidden: admin role required',
      });
    });
  });

  describe('data enrichment & schema-drift resilience', () => {
    it('merges employees with linked personnel/badges and includes unlinked personnel records', async () => {
      createServerSupabaseClient.mockResolvedValue({
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: { id: 'admin-auth-id' } },
            error: null,
          }),
        },
        from: jest.fn((table: string) => {
          if (table === 'employees') {
            return {
              select: jest.fn((cols: string) => {
                if (cols === 'role') {
                  return {
                    eq: jest.fn().mockReturnValue({
                      single: jest.fn().mockResolvedValue({
                        data: { role: 'admin' },
                        error: null,
                      }),
                    }),
                  };
                }
                return {
                  order: jest.fn().mockResolvedValue({
                    data: [
                      {
                        id: 'emp-1',
                        auth_id: 'admin-auth-id',
                        full_name: 'Thabo Mokoena',
                        employee_code: 'COY-1001',
                        role: 'admin',
                        department_id: 'dept-pit',
                        accessible_departments: ['dept-pit'],
                        created_at: '2026-01-01T00:00:00Z',
                        departments: { display_name: 'Pit Operations' },
                      },
                    ],
                    error: null,
                  }),
                };
              }),
            };
          }
          if (table === 'departments') {
            return {
              select: jest.fn().mockResolvedValue({
                data: [{ id: 'dept-pit', display_name: 'Pit Operations' }],
                error: null,
              }),
            };
          }
          if (table === 'personnel') {
            return {
              select: jest.fn().mockResolvedValue({
                data: [
                  {
                    id: 'pers-1',
                    emp_code: 'COY-1001',
                    first_name: 'Thabo',
                    surname: 'Mokoena',
                    id_number: '8501015009087',
                    job_title: 'Shift Boss',
                    area: 'Pit Area',
                    department_id: 'dept-pit',
                    medical_expiry: '2027-03-01',
                    induction_expiry: '2027-04-01',
                    photo_url: null,
                    badges: [{ qr_code: 'QR-COY-1001' }],
                  },
                  {
                    id: 'pers-2',
                    emp_code: 'COY-2002',
                    first_name: 'Lerato',
                    surname: 'Ndlovu',
                    id_number: '9202024800081',
                    job_title: 'Metallurgist',
                    area: 'Plant',
                    department_id: 'dept-pit',
                    medical_expiry: '2027-08-15',
                    induction_expiry: '2027-09-01',
                    photo_url: null,
                    badges: [{ qr_code: 'QR-COY-2002' }],
                  },
                ],
                error: null,
              }),
            };
          }
          return {};
        }),
      });

      const result = await getUsersAdminData();
      expect(result.departments).toHaveLength(1);
      expect(result.employees).toHaveLength(2);

      const enrichedAdmin = result.employees.find((e) => e.employee_code === 'COY-1001');
      expect(enrichedAdmin).toMatchObject({
        first_name: 'Thabo',
        last_name: 'Mokoena',
        national_id: '8501015009087',
        job_title: 'Shift Boss',
        areas: ['Pit Area'],
        medical_expiry_date: '2027-03-01',
        induction_expiry_date: '2027-04-01',
        qr_code_data: 'QR-COY-1001',
      });

      const unlinkedPersonnel = result.employees.find((e) => e.employee_code === 'COY-2002');
      expect(unlinkedPersonnel).toMatchObject({
        full_name: 'Lerato Ndlovu',
        national_id: '9202024800081',
        job_title: 'Metallurgist',
        areas: ['Plant'],
        qr_code_data: 'QR-COY-2002',
      });
    });

    it('falls back to core columns while preserving employee_code when extended columns are missing', async () => {
      const empUpdatePayloads: Array<Record<string, unknown>> = [];
      const persUpdatePayloads: Array<Record<string, unknown>> = [];

      createServerSupabaseClient.mockResolvedValue({
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: { id: 'admin-auth-id' } },
            error: null,
          }),
        },
        from: jest.fn((table: string) => {
          if (table === 'employees') {
            return {
              select: jest.fn((cols: string) => {
                if (cols === 'role') {
                  return {
                    eq: jest.fn().mockReturnValue({
                      single: jest.fn().mockResolvedValue({
                        data: { role: 'admin' },
                        error: null,
                      }),
                    }),
                  };
                }
                return {
                  eq: jest.fn().mockReturnValue({
                    maybeSingle: jest.fn().mockResolvedValue({
                      data: { id: 'emp-1' },
                      error: null,
                    }),
                  }),
                };
              }),
              update: jest.fn((payload: Record<string, unknown>) => {
                empUpdatePayloads.push(payload);
                return {
                  eq: jest.fn().mockResolvedValue(
                    empUpdatePayloads.length === 1
                      ? {
                          error: {
                            code: 'PGRST204',
                            message:
                              "Could not find the 'areas' column of 'employees' in the schema cache",
                          },
                        }
                      : { error: null }
                  ),
                };
              }),
            };
          }
          if (table === 'personnel') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  maybeSingle: jest.fn().mockResolvedValue({
                    data: { id: 'pers-1' },
                    error: null,
                  }),
                }),
              }),
              update: jest.fn((payload: Record<string, unknown>) => {
                persUpdatePayloads.push(payload);
                return {
                  eq: jest.fn().mockResolvedValue(
                    persUpdatePayloads.length === 1
                      ? {
                          error: {
                            code: '42703',
                            message: 'column personnel.area does not exist',
                          },
                        }
                      : { error: null }
                  ),
                };
              }),
            };
          }
          if (table === 'badges') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  maybeSingle: jest.fn().mockResolvedValue({
                    data: { id: 'badge-1' },
                    error: null,
                  }),
                }),
              }),
              update: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({ error: null }),
              }),
            };
          }
          return {};
        }),
      });

      const res = await upsertEmployeeAdmin({
        id: 'emp-1',
        names: 'Thabo',
        surname: 'Mokoena',
        full_name: 'Thabo Mokoena',
        id_number: '8501015009087',
        job_title: 'Shift Boss',
        area: 'Pit Area',
        medical_expiry: '2027-03-01',
        induction_expiry: '2027-04-01',
        coy_number: 'COY-1001',
        qr_code: 'QR-COY-1001',
        photo_url: '',
        role: 'admin',
        department_id: 'dept-pit',
        accessible_departments: ['dept-pit'],
      });

      expect(res).toEqual({ success: true });
      expect(empUpdatePayloads).toHaveLength(2);
      expect(empUpdatePayloads[1]).toMatchObject({
        full_name: 'Thabo Mokoena',
        employee_code: 'COY-1001',
        role: 'admin',
      });
      expect(persUpdatePayloads).toHaveLength(2);
      expect(persUpdatePayloads[1]).not.toHaveProperty('area');
      expect(persUpdatePayloads[1]).toMatchObject({
        emp_code: 'COY-1001',
        id_number: '8501015009087',
        job_title: 'Shift Boss',
      });
    });
  });
});
