/**
 * @jest-environment node
 */
import {
  createDepartment,
  deactivateEmployeeAdmin,
  getUsersAdminData,
  upsertEmployeeAdmin,
} from './actions';

const mockInviteUserByEmail = jest.fn();

jest.mock('@repo/supabase/server', () => ({
  createServerSupabaseClient: jest.fn(),
}));

jest.mock('@repo/supabase/service-role', () => ({
  createServiceRoleClient: jest.fn(() => ({
    auth: {
      admin: {
        inviteUserByEmail: (...args: unknown[]) => mockInviteUserByEmail(...args),
      },
    },
  })),
}));

jest.mock('@repo/redis', () => ({
  cacheInvalidateTags: jest.fn().mockResolvedValue(undefined),
  revokeSession: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/server-cache', () => ({
  updateTags: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

const { createServerSupabaseClient } = jest.requireMock('@repo/supabase/server') as {
  createServerSupabaseClient: jest.Mock;
};
const { updateTags } = jest.requireMock('@/lib/server-cache') as {
  updateTags: jest.Mock;
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

    it('rejects non-admin callers and invalid payloads in createDepartment', async () => {
      createServerSupabaseClient.mockResolvedValueOnce({
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

      createServerSupabaseClient.mockResolvedValueOnce({
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: { id: 'auth-admin-1' } },
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

      await expect(createDepartment({ display_name: '   ' })).rejects.toThrow(
        'Department name is required'
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
                  is: jest.fn().mockReturnValue({
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

    it('invites new portal login users via service-role auth so they get their own auth_id', async () => {
      const empInserts: Array<Record<string, unknown>> = [];
      mockInviteUserByEmail.mockResolvedValueOnce({
        data: { user: { id: 'invited-auth-uuid-99' } },
        error: null,
      });

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
                  eq: jest.fn((col: string) => ({
                    maybeSingle: jest.fn().mockResolvedValue({
                      data: col === 'auth_id' ? { id: 'emp-new-99' } : null,
                      error: null,
                    }),
                  })),
                };
              }),
              insert: jest.fn((payload: Record<string, unknown>) => {
                empInserts.push(payload);
                return Promise.resolve({ error: null });
              }),
            };
          }
          if (table === 'personnel') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
                }),
              }),
              insert: jest.fn().mockReturnValue({
                select: jest.fn().mockReturnValue({
                  maybeSingle: jest.fn().mockResolvedValue({
                    data: { id: 'pers-new-99' },
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === 'badges') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
                }),
              }),
              insert: jest.fn().mockResolvedValue({ error: null }),
            };
          }
          return {};
        }),
      });

      const res = await upsertEmployeeAdmin({
        record_type: 'user',
        email: 'new.operator@plantcor.co.za',
        names: 'Bongani',
        surname: 'Zulu',
        full_name: 'Bongani Zulu',
        id_number: '9101015009081',
        job_title: 'Control Operator',
        area: 'Control Room',
        medical_expiry: '2027-06-01',
        induction_expiry: '2027-07-01',
        coy_number: 'COY-7701',
        qr_code: 'QR-COY-7701',
        photo_url: '',
        role: 'operator',
        department_id: 'dept-cr',
        accessible_departments: ['dept-cr'],
      });

      expect(res).toEqual({ success: true });
      expect(mockInviteUserByEmail).toHaveBeenCalledWith(
        'new.operator@plantcor.co.za',
        expect.objectContaining({
          data: expect.objectContaining({ full_name: 'Bongani Zulu' }),
        })
      );
      expect(empInserts[0]).toMatchObject({
        auth_id: 'invited-auth-uuid-99',
        employee_code: 'COY-7701',
      });
      expect(empInserts[0]?.auth_id).not.toBe('admin-auth-id');
      expect(updateTags).toHaveBeenCalled();
    });

    it('persists badge-only employee records to personnel + badges without inserting employees.auth_id = admin', async () => {
      const empInsert = jest.fn();

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
                    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
                  }),
                };
              }),
              insert: empInsert,
            };
          }
          if (table === 'personnel') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
                }),
              }),
              insert: jest.fn().mockReturnValue({
                select: jest.fn().mockReturnValue({
                  maybeSingle: jest.fn().mockResolvedValue({
                    data: { id: 'pers-badge-1' },
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === 'badges') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
                }),
              }),
              insert: jest.fn().mockResolvedValue({ error: null }),
            };
          }
          return {};
        }),
      });

      const res = await upsertEmployeeAdmin({
        record_type: 'employee',
        names: 'Mandla',
        surname: 'Sithole',
        full_name: 'Mandla Sithole',
        id_number: '8802025009081',
        job_title: 'Rigger',
        area: 'Plant',
        medical_expiry: '2027-06-01',
        induction_expiry: '2027-07-01',
        coy_number: 'COY-8801',
        qr_code: 'QR-COY-8801',
        photo_url: '',
        role: 'operator',
        department_id: 'dept-plant',
        accessible_departments: [],
      });

      expect(res).toEqual({ success: true });
      expect(empInsert).not.toHaveBeenCalled();
      expect(mockInviteUserByEmail).not.toHaveBeenCalled();
    });

    it('deactivates an employee soft-delete, marks personnel inactive, and revokes badges', async () => {
      const empUpdate = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      });
      const persUpdate = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      });
      const badgeUpdate = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      });

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
                if (cols === 'id, role') {
                  return {
                    eq: jest.fn().mockReturnValue({
                      single: jest.fn().mockResolvedValue({
                        data: { id: 'emp-admin', role: 'admin' },
                        error: null,
                      }),
                    }),
                  };
                }
                return {
                  eq: jest.fn().mockReturnValue({
                    maybeSingle: jest.fn().mockResolvedValue({
                      data: {
                        id: 'emp-target',
                        auth_id: 'other-auth-id',
                        employee_code: 'COY-4001',
                        full_name: 'Lerato Khumalo',
                      },
                      error: null,
                    }),
                  }),
                };
              }),
              update: empUpdate,
            };
          }
          if (table === 'personnel') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn((col: string) => ({
                  maybeSingle: jest.fn().mockResolvedValue({
                    data: col === 'emp_code' ? { id: 'pers-target', emp_code: 'COY-4001' } : null,
                    error: null,
                  }),
                })),
              }),
              update: persUpdate,
            };
          }
          if (table === 'badges') {
            return { update: badgeUpdate };
          }
          return {};
        }),
      });

      const res = await deactivateEmployeeAdmin('emp-target');
      expect(res).toEqual({ success: true });
      expect(empUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ deleted_at: expect.any(String) })
      );
      expect(persUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: 'Inactive' }));
      expect(badgeUpdate).toHaveBeenCalledWith(expect.objectContaining({ is_active: false }));
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
