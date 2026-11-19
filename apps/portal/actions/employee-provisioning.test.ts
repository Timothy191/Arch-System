/**
 * @jest-environment node
 */

import { cacheInvalidateTags } from '@repo/redis';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { revalidatePath } from 'next/cache';
import {
  AuthError,
  ConflictError,
  DatabaseError,
  ForbiddenError,
  ValidationError,
} from '@/lib/errors/error-classes';
import {
  getProvisioningReferenceData,
  provisionNewEmployee,
  updateEmployeeAction,
} from './employee-provisioning';

jest.mock('@repo/supabase/server', () => ({
  createServerSupabaseClient: jest.fn(),
}));

jest.mock('@repo/redis', () => ({
  cacheInvalidateTags: jest.fn(async () => undefined),
}));

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

const mockCreateServerSupabaseClient = createServerSupabaseClient as jest.Mock;
const mockCacheInvalidateTags = cacheInvalidateTags as jest.Mock;
const mockRevalidatePath = revalidatePath as jest.Mock;

const DEPT_UUID = '00000000-0000-4000-8000-000000000001';
const EMP_UUID = '00000000-0000-4000-8000-000000000010';
const BADGE_UUID = '00000000-0000-4000-8000-000000000020';

interface MockDbConfig {
  user?: { id: string } | null;
  authError?: { message: string } | null;
  employeeRole?: string | null;
  employeeError?: { message: string } | null;
  departmentsList?: Array<{ id: string; name: string; display_name: string | null }>;
  deptMatch?: { id: string } | null;
  personnelList?: Array<Record<string, unknown>>;
  existingPersonnelConflict?: {
    id: string;
    emp_code: string;
    first_name: string;
    surname: string;
  } | null;
  insertedPersonnel?: Record<string, unknown> | null;
  personnelWriteError?: { message: string } | null;
  insertedBadge?: Record<string, unknown> | null;
  badgeWriteError?: { message: string } | null;
  existingOperator?: { id: string } | null;
  existingBadge?: { id: string; qr_code: string; is_active: boolean } | null;
  updatedBadge?: { id: string; qr_code: string; is_active: boolean } | null;
}

function buildSupabaseMock(config: MockDbConfig = {}) {
  const deptOrCalls: string[] = [];
  const operatorsUpdates: Array<Record<string, unknown>> = [];
  const operatorsInserts: Array<Record<string, unknown>> = [];
  const badgesUpdates: Array<Record<string, unknown>> = [];
  const badgesInserts: Array<Record<string, unknown>> = [];

  const mock = {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: config.user !== undefined ? config.user : { id: 'auth-user-1' } },
        error: config.authError ?? null,
      }),
    },
    from: jest.fn((table: string) => {
      if (table === 'employees') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data:
                  config.employeeRole !== null ? { role: config.employeeRole ?? 'admin' } : null,
                error: config.employeeError ?? null,
              }),
            }),
          }),
        };
      }

      if (table === 'departments') {
        return {
          select: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: config.departmentsList ?? [
                { id: DEPT_UUID, name: 'drilling', display_name: 'Drilling' },
              ],
              error: null,
            }),
            or: jest.fn((filterExpr: string) => {
              deptOrCalls.push(filterExpr);
              return {
                limit: jest.fn().mockReturnValue({
                  maybeSingle: jest.fn().mockResolvedValue({
                    data: config.deptMatch !== undefined ? config.deptMatch : { id: DEPT_UUID },
                    error: null,
                  }),
                }),
              };
            }),
          }),
        };
      }

      if (table === 'personnel') {
        return {
          select: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({
                data: config.personnelList ?? [],
                error: null,
              }),
            }),
            eq: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({
                data: config.existingPersonnelConflict ?? null,
                error: null,
              }),
              neq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: config.existingPersonnelConflict ?? null,
                  error: null,
                }),
              }),
            }),
          }),
          insert: jest.fn((payload: Record<string, unknown>) => ({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data:
                  config.personnelWriteError || config.insertedPersonnel === null
                    ? null
                    : (config.insertedPersonnel ?? {
                        id: EMP_UUID,
                        ...payload,
                      }),
                error: config.personnelWriteError ?? null,
              }),
            }),
          })),
          update: jest.fn((payload: Record<string, unknown>) => ({
            eq: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data:
                    config.personnelWriteError || config.insertedPersonnel === null
                      ? null
                      : (config.insertedPersonnel ?? {
                          id: EMP_UUID,
                          emp_code: 'EMP-10001',
                          ...payload,
                        }),
                  error: config.personnelWriteError ?? null,
                }),
              }),
            }),
          })),
        };
      }

      if (table === 'badges') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({
                data: config.existingBadge ?? null,
                error: null,
              }),
            }),
          }),
          insert: jest.fn((payload: Record<string, unknown>) => {
            badgesInserts.push(payload);
            return {
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: config.badgeWriteError
                    ? null
                    : (config.insertedBadge ?? {
                        id: BADGE_UUID,
                        qr_code: payload.qr_code,
                        is_active: true,
                      }),
                  error: config.badgeWriteError ?? null,
                }),
              }),
            };
          }),
          update: jest.fn((payload: Record<string, unknown>) => {
            badgesUpdates.push(payload);
            return {
              eq: jest.fn().mockReturnValue({
                select: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: config.updatedBadge ?? {
                      id: BADGE_UUID,
                      qr_code: (payload.qr_code as string) ?? 'QR-EXISTING',
                      is_active: true,
                    },
                    error: null,
                  }),
                }),
              }),
            };
          }),
        };
      }

      if (table === 'operators') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({
                data: config.existingOperator ?? null,
                error: null,
              }),
            }),
          }),
          update: jest.fn((payload: Record<string, unknown>) => {
            operatorsUpdates.push(payload);
            return { eq: jest.fn().mockResolvedValue({ error: null }) };
          }),
          insert: jest.fn((payload: Record<string, unknown>) => {
            operatorsInserts.push(payload);
            return Promise.resolve({ error: null });
          }),
        };
      }

      return {};
    }),
  };

  mockCreateServerSupabaseClient.mockResolvedValue(mock);
  return {
    mock,
    deptOrCalls,
    operatorsUpdates,
    operatorsInserts,
    badgesUpdates,
    badgesInserts,
  };
}

describe('employee-provisioning server actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('authentication and RBAC authorization', () => {
    it('throws AuthError across all actions when session is missing', async () => {
      buildSupabaseMock({ user: null });

      await expect(getProvisioningReferenceData()).rejects.toThrow(AuthError);
      await expect(
        provisionNewEmployee({
          first_name: 'Jane',
          surname: 'Doe',
          id_number: '9001010000081',
          job_title: 'Operator',
        })
      ).rejects.toThrow(AuthError);
      await expect(
        updateEmployeeAction({
          id: EMP_UUID,
          first_name: 'Jane',
          surname: 'Doe',
          id_number: '9001010000081',
          job_title: 'Operator',
          status: 'Active',
        })
      ).rejects.toThrow(AuthError);
    });

    it('throws ForbiddenError when caller has operator role or missing employee row', async () => {
      buildSupabaseMock({ employeeRole: 'operator' });

      await expect(getProvisioningReferenceData()).rejects.toThrow(ForbiddenError);
      await expect(
        provisionNewEmployee({
          first_name: 'Jane',
          surname: 'Doe',
          id_number: '9001010000081',
          job_title: 'Operator',
        })
      ).rejects.toThrow(ForbiddenError);
      await expect(
        updateEmployeeAction({
          id: EMP_UUID,
          first_name: 'Jane',
          surname: 'Doe',
          id_number: '9001010000081',
          job_title: 'Operator',
          status: 'Active',
        })
      ).rejects.toThrow(ForbiddenError);

      buildSupabaseMock({ employeeRole: null });
      await expect(getProvisioningReferenceData()).rejects.toThrow(ForbiddenError);
    });
  });

  describe('getProvisioningReferenceData', () => {
    it.each(['admin', 'manager', 'supervisor', 'access_control'])(
      'returns departments and mapped personnel for authorized role=%s',
      async (role) => {
        buildSupabaseMock({
          employeeRole: role,
          departmentsList: [{ id: DEPT_UUID, name: 'drilling', display_name: null }],
          personnelList: [
            {
              id: EMP_UUID,
              emp_code: 'EMP-101',
              first_name: 'Thabo',
              surname: 'Mokoena',
              id_number: '8505055000082',
              job_title: 'Drill Operator',
              department_id: DEPT_UUID,
              medical_expiry: null,
              induction_expiry: null,
              photo_url: null,
              status: null,
              departments: [{ name: 'drilling', display_name: 'Drilling' }],
              badges: [{ id: BADGE_UUID, qr_code: 'QR-EMP-101', is_active: true }],
            },
            {
              id: '00000000-0000-4000-8000-000000000011',
              emp_code: 'EMP-102',
              first_name: 'Lerato',
              surname: 'Ndlovu',
              id_number: '9202025000084',
              job_title: 'Supervisor',
              department_id: null,
              medical_expiry: null,
              induction_expiry: null,
              photo_url: null,
              status: 'Active',
              departments: null,
              badges: null,
            },
          ],
        });

        const result = await getProvisioningReferenceData();
        expect(result.departments).toEqual([
          { id: DEPT_UUID, name: 'drilling', display_name: 'drilling' },
        ]);
        expect(result.recentPersonnel).toHaveLength(2);
        expect(result.recentPersonnel[0]).toMatchObject({
          id: EMP_UUID,
          area_name: 'Drilling',
          status: 'Active',
          badge: { id: BADGE_UUID, qr_code: 'QR-EMP-101', is_active: true },
        });
        expect(result.recentPersonnel[1]).toMatchObject({
          area_name: null,
          badge: null,
        });
      }
    );
  });

  describe('provisionNewEmployee', () => {
    it('throws ValidationError when required fields fail schema validation', async () => {
      buildSupabaseMock({ employeeRole: 'admin' });

      await expect(
        provisionNewEmployee({
          first_name: '',
          surname: 'Doe',
          id_number: '9001010000081',
          job_title: 'Operator',
        })
      ).rejects.toThrow(ValidationError);
    });

    it('sanitizes PostgREST metacharacters in area before .or() department lookup', async () => {
      const { deptOrCalls, operatorsInserts } = buildSupabaseMock({
        employeeRole: 'access_control',
      });

      const result = await provisionNewEmployee({
        first_name: 'John',
        surname: 'Smith',
        id_number: '9001010000081',
        job_title: 'Driller',
        area: 'Drilling,id.eq.1()*\\"',
        medical_expiry: '2027-01-01',
        induction_expiry: '2027-02-01',
        emp_code: 'EMP-999',
        qr_code: 'QR-EMP-999',
      });

      const expectedSanitizedArea = `${'Drilling'}${'id'}eq1`;
      expect(result.success).toBe(true);
      expect(result.data.department_id).toBe(DEPT_UUID);
      expect(deptOrCalls).toEqual([
        `name.eq."${expectedSanitizedArea}",display_name.eq."${expectedSanitizedArea}"`,
      ]);
      expect(operatorsInserts).toHaveLength(1);
      expect(mockCacheInvalidateTags).toHaveBeenCalledWith([
        'table:personnel',
        'table:badges',
        'table:operators',
        'table:employees',
      ]);
      expect(mockRevalidatePath).toHaveBeenCalledWith('/database/panels');
    });

    it('skips department .or() query completely when sanitized area is empty', async () => {
      const { deptOrCalls } = buildSupabaseMock({
        employeeRole: 'supervisor',
        existingOperator: { id: 'op-1' },
      });

      const result = await provisionNewEmployee({
        first_name: 'Sam',
        surname: 'Khumalo',
        id_number: '9101010000088',
        job_title: 'Operator',
        area: '(),."\'\\%*',
      });

      expect(result.success).toBe(true);
      expect(result.data.department_id).toBeNull();
      expect(deptOrCalls).toHaveLength(0);
    });

    it('throws ConflictError on duplicate id_number and DatabaseError on insert failure', async () => {
      buildSupabaseMock({
        employeeRole: 'manager',
        existingPersonnelConflict: {
          id: EMP_UUID,
          emp_code: 'EMP-001',
          first_name: 'Existing',
          surname: 'Person',
        },
      });

      await expect(
        provisionNewEmployee({
          first_name: 'Dup',
          surname: 'User',
          id_number: '9001010000081',
          job_title: 'Operator',
        })
      ).rejects.toThrow(ConflictError);

      buildSupabaseMock({
        employeeRole: 'manager',
        personnelWriteError: { message: 'insert rejected' },
      });

      await expect(
        provisionNewEmployee({
          first_name: 'Err',
          surname: 'User',
          id_number: '9001010000082',
          job_title: 'Operator',
        })
      ).rejects.toThrow(DatabaseError);
    });
  });

  describe('updateEmployeeAction', () => {
    it('throws ValidationError for invalid UUID and ConflictError for duplicate id_number', async () => {
      buildSupabaseMock({ employeeRole: 'admin' });

      await expect(
        updateEmployeeAction({
          id: 'not-a-uuid',
          first_name: 'John',
          surname: 'Doe',
          id_number: '9001010000081',
          job_title: 'Operator',
          status: 'Active',
        })
      ).rejects.toThrow(ValidationError);

      buildSupabaseMock({
        employeeRole: 'admin',
        existingPersonnelConflict: {
          id: '00000000-0000-4000-8000-000000000099',
          emp_code: 'EMP-099',
          first_name: 'Other',
          surname: 'Worker',
        },
      });

      await expect(
        updateEmployeeAction({
          id: EMP_UUID,
          first_name: 'John',
          surname: 'Doe',
          id_number: '9001010000081',
          job_title: 'Operator',
          status: 'Active',
        })
      ).rejects.toThrow(ConflictError);
    });

    it('sanitizes area in updateEmployeeAction and updates existing badge', async () => {
      const { deptOrCalls, badgesUpdates } = buildSupabaseMock({
        employeeRole: 'admin',
        existingBadge: { id: BADGE_UUID, qr_code: 'QR-OLD', is_active: true },
      });

      const res = await updateEmployeeAction({
        id: EMP_UUID,
        first_name: 'John',
        surname: 'Doe',
        id_number: '9001010000081',
        job_title: 'Senior Operator',
        area: 'Plant,or(1.eq.1)',
        qr_code: 'QR-NEW-01',
        status: 'Active',
      });

      const expectedSanitizedArea = `${'Plant'}${'or'}1eq1`;
      expect(res.success).toBe(true);
      expect(deptOrCalls).toEqual([
        `name.ilike.%${expectedSanitizedArea}%,display_name.ilike.%${expectedSanitizedArea}%`,
      ]);
      expect(badgesUpdates).toHaveLength(1);
      expect(badgesUpdates[0]).toMatchObject({
        department_id: DEPT_UUID,
        qr_code: 'QR-NEW-01',
      });
    });

    it('skips area .or() when sanitized area is empty, inserts missing badge, and throws DatabaseError on failure', async () => {
      const { deptOrCalls, badgesInserts } = buildSupabaseMock({
        employeeRole: 'access_control',
        existingBadge: null,
      });

      const res = await updateEmployeeAction({
        id: EMP_UUID,
        first_name: 'John',
        surname: 'Doe',
        id_number: '9001010000081',
        job_title: 'Operator',
        area: ',,()',
        qr_code: 'QR-FRESH-01',
        status: 'Active',
      });

      expect(res.success).toBe(true);
      expect(deptOrCalls).toHaveLength(0);
      expect(badgesInserts).toHaveLength(1);

      buildSupabaseMock({
        employeeRole: 'admin',
        personnelWriteError: { message: 'update failed' },
      });

      await expect(
        updateEmployeeAction({
          id: EMP_UUID,
          first_name: 'John',
          surname: 'Doe',
          id_number: '9001010000081',
          job_title: 'Operator',
          status: 'Active',
        })
      ).rejects.toThrow(DatabaseError);
    });
  });
});
