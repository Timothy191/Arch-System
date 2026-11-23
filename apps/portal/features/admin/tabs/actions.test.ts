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

    it('hydrates department_permissions, gender, date_of_birth, and record_type from employee_department_access', async () => {
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
                        id: 'emp-rw',
                        auth_id: null,
                        record_type: 'user',
                        full_name: 'Lerato Khumalo',
                        gender: 'female',
                        date_of_birth: '1994-09-18T00:00:00Z',
                        employee_code: 'COY-3003',
                        role: 'operator',
                        department_id: 'dept-drill',
                        accessible_departments: ['dept-drill', 'dept-prod'],
                        created_at: '2026-02-01T00:00:00Z',
                        departments: { display_name: 'Drilling' },
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
                data: [
                  { id: 'dept-drill', display_name: 'Drilling' },
                  { id: 'dept-prod', display_name: 'Production' },
                ],
                error: null,
              }),
            };
          }
          if (table === 'personnel') {
            return {
              select: jest.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            };
          }
          if (table === 'employee_department_access') {
            return {
              select: jest.fn().mockResolvedValue({
                data: [
                  { employee_id: 'emp-rw', department_id: 'dept-drill', access_level: 'operate' },
                  { employee_id: 'emp-rw', department_id: 'dept-prod', access_level: 'read' },
                ],
                error: null,
              }),
            };
          }
          return {};
        }),
      });

      const result = await getUsersAdminData();
      expect(result.employees).toHaveLength(1);
      expect(result.employees[0]).toMatchObject({
        record_type: 'user',
        gender: 'female',
        date_of_birth: '1994-09-18',
        accessible_departments: ['dept-drill', 'dept-prod'],
        department_permissions: {
          'dept-drill': { read: true, write: true },
          'dept-prod': { read: true, write: false },
        },
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

    it('persists record_type, gender, birthday and syncs employee_department_access read/operate rows', async () => {
      const empUpdates: Array<Record<string, unknown>> = [];
      const accessDeletes: unknown[] = [];
      const accessUpserts: unknown[] = [];

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
                empUpdates.push(payload);
                return { eq: jest.fn().mockResolvedValue({ error: null }) };
              }),
            };
          }
          if (table === 'employee_department_access') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({
                  data: [{ department_id: 'dept-old' }],
                  error: null,
                }),
              }),
              delete: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  in: jest.fn((col: string, ids: string[]) => {
                    accessDeletes.push({ col, ids });
                    return Promise.resolve({ error: null });
                  }),
                }),
              }),
              upsert: jest.fn((rows: unknown) => {
                accessUpserts.push(rows);
                return Promise.resolve({ error: null });
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
              update: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({ error: null }),
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
        record_type: 'user',
        names: 'Lerato',
        surname: 'Khumalo',
        full_name: 'Lerato Khumalo',
        gender: 'female',
        birthday: '1994-09-18',
        id_number: '9409180000081',
        job_title: 'Control Officer',
        area: 'Control Room',
        medical_expiry: '2027-06-01',
        induction_expiry: '2027-07-01',
        coy_number: 'COY-4001',
        qr_code: 'QR-COY-4001',
        photo_url: '',
        role: 'operator',
        department_id: 'dept-drill',
        accessible_departments: ['dept-drill', 'dept-prod'],
        department_permissions: {
          'dept-drill': { read: true, write: true },
          'dept-prod': { read: true, write: false },
        },
      });

      expect(res).toEqual({ success: true });
      expect(empUpdates[0]).toMatchObject({
        record_type: 'user',
        gender: 'female',
        date_of_birth: '1994-09-18',
        accessible_departments: ['dept-drill', 'dept-prod'],
      });
      expect(accessDeletes).toEqual([{ col: 'department_id', ids: ['dept-old'] }]);
      expect(accessUpserts[0]).toEqual([
        expect.objectContaining({
          employee_id: 'emp-1',
          department_id: 'dept-drill',
          access_level: 'operate',
        }),
        expect.objectContaining({
          employee_id: 'emp-1',
          department_id: 'dept-prod',
          access_level: 'read',
        }),
      ]);
    });

    it('rejects invalid birthday format via Zod contract validation', async () => {
      createServerSupabaseClient.mockResolvedValue({
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: { id: 'admin-auth-id' } },
            error: null,
          }),
        },
        from: jest.fn(() => ({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { role: 'admin' },
                error: null,
              }),
            }),
          }),
        })),
      });

      const res = await upsertEmployeeAdmin({
        names: 'Sipho',
        surname: 'Dlamini',
        full_name: 'Sipho Dlamini',
        gender: 'other',
        birthday: '18-09-1994',
        id_number: '9409180000081',
        job_title: 'Operator',
        area: 'Pit Area',
        medical_expiry: '',
        induction_expiry: '',
        coy_number: 'COY-5001',
        qr_code: '',
        photo_url: '',
        role: 'operator',
        department_id: null,
        accessible_departments: [],
      });

      expect(res).toEqual({
        success: false,
        error: 'Birthday must use YYYY-MM-DD format',
      });
    });
  });
});
