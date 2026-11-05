import {
  getAccessibleDepartmentNames,
  getEmployeeClearance,
  getEmployeeIdentity,
  getEmployeeRole,
} from './hub-departments';

jest.mock('@repo/supabase/read-replica', () => ({
  createReadReplicaClient: jest.fn(),
}));

jest.mock('next/headers', () => ({
  cookies: jest.fn(() => ({
    getAll: jest.fn(() => [{ name: 'sb-token', value: 'abc' }]),
  })),
}));

jest.mock('@/lib/server-cache', () => ({
  cacheLife: jest.fn(),
  cacheTag: jest.fn(),
}));

jest.mock('@/lib/cache-utils', () => ({
  withCache: jest.fn((fn: () => Promise<unknown>) => fn()),
}));

interface MockReadReplicaModule {
  createReadReplicaClient: jest.Mock;
}

interface MockServerCacheModule {
  cacheLife: jest.Mock;
  cacheTag: jest.Mock;
}

interface MockCacheUtilsModule {
  withCache: jest.Mock;
}

const { createReadReplicaClient } = jest.requireMock<MockReadReplicaModule>(
  '@repo/supabase/read-replica'
);
const { cacheLife, cacheTag } = jest.requireMock<MockServerCacheModule>('@/lib/server-cache');
const { withCache } = jest.requireMock<MockCacheUtilsModule>('@/lib/cache-utils');

describe('hub-departments', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    cacheLife.mockImplementation(() => undefined);
    cacheTag.mockImplementation(() => undefined);
    withCache.mockImplementation((fn: () => Promise<unknown>) => fn());
  });

  describe('getAccessibleDepartmentNames', () => {
    it('returns mapped department names when employee has accessible_departments', async () => {
      const mockFrom = jest.fn((table: string) => {
        if (table === 'employees') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { accessible_departments: ['dept-1', 'dept-2'] },
                }),
              }),
            }),
          };
        }
        if (table === 'departments') {
          return {
            select: jest.fn().mockReturnValue({
              in: jest.fn().mockResolvedValue({
                data: [{ name: 'control-room' }, { name: 'drilling' }],
              }),
            }),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      });

      createReadReplicaClient.mockResolvedValue({ from: mockFrom });

      const cookieList = [{ name: 'sb-token', value: 'abc' }];
      const result = await getAccessibleDepartmentNames('user-123', cookieList);

      expect(result).toEqual(['control-room', 'drilling']);
      expect(createReadReplicaClient).toHaveBeenCalledWith(cookieList);
      expect(cacheLife).toHaveBeenCalledWith('hours');
      expect(cacheTag).toHaveBeenCalledWith('auth:user-123');
    });

    it('returns empty array without querying departments when accessible_departments is empty or missing', async () => {
      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
            }),
          }),
        }),
      });

      createReadReplicaClient.mockResolvedValue({ from: mockFrom });

      const result = await getAccessibleDepartmentNames('user-empty');

      expect(result).toEqual([]);
      expect(mockFrom).toHaveBeenCalledTimes(1);
      expect(mockFrom).toHaveBeenCalledWith('employees');
    });

    it('returns empty array when departments query returns null data', async () => {
      const mockFrom = jest.fn((table: string) => {
        if (table === 'employees') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { accessible_departments: ['dept-1'] },
                }),
              }),
            }),
          };
        }
        return {
          select: jest.fn().mockReturnValue({
            in: jest.fn().mockResolvedValue({
              data: null,
            }),
          }),
        };
      });

      createReadReplicaClient.mockResolvedValue({ from: mockFrom });

      const result = await getAccessibleDepartmentNames('user-null-depts');

      expect(result).toEqual([]);
    });

    it('propagates database client errors when read replica fails', async () => {
      createReadReplicaClient.mockRejectedValue(new Error('Replica connection failed'));

      await expect(getAccessibleDepartmentNames('user-err')).rejects.toThrow(
        'Replica connection failed'
      );
    });
  });

  describe('getEmployeeRole', () => {
    it('returns the employee role when found', async () => {
      createReadReplicaClient.mockResolvedValue({
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { role: 'super_admin' },
              }),
            }),
          }),
        }),
      });

      const role = await getEmployeeRole('user-admin');
      expect(role).toBe('super_admin');
    });

    it('returns null when employee row is missing or has no role', async () => {
      createReadReplicaClient.mockResolvedValue({
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
              }),
            }),
          }),
        }),
      });

      const role = await getEmployeeRole('user-missing');
      expect(role).toBeNull();
    });
  });

  describe('getEmployeeClearance', () => {
    it('returns unlinked when employee has no employee_code', async () => {
      createReadReplicaClient.mockResolvedValue({
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { employee_code: null },
              }),
            }),
          }),
        }),
      });

      const clearance = await getEmployeeClearance('user-no-code');
      expect(clearance).toEqual({
        state: 'unlinked',
        details: ['No personnel record linked to your account.'],
      });
    });

    it('returns unlinked when personnel row is not found for employee_code', async () => {
      const mockFrom = jest.fn((table: string) => {
        if (table === 'employees') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { employee_code: 'EMP-404' },
                }),
              }),
            }),
          };
        }
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
              }),
            }),
          }),
        };
      });

      createReadReplicaClient.mockResolvedValue({ from: mockFrom });

      const clearance = await getEmployeeClearance('user-no-personnel');
      expect(clearance).toEqual({
        state: 'unlinked',
        details: ['No personnel record linked to your account.'],
      });
    });

    it('returns expired when medical_expiry or induction_expiry is missing or in the past', async () => {
      const pastDate = new Date(Date.now() - 86_400_000).toISOString();
      const mockFrom = jest.fn((table: string) => {
        if (table === 'employees') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { employee_code: 'EMP-100' },
                }),
              }),
            }),
          };
        }
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: {
                  emp_code: 'EMP-100',
                  medical_expiry: pastDate,
                  induction_expiry: null,
                },
              }),
            }),
          }),
        };
      });

      createReadReplicaClient.mockResolvedValue({ from: mockFrom });

      const clearance = await getEmployeeClearance('user-expired');
      expect(clearance).toEqual({
        state: 'expired',
        details: ['Medical clearance missing or expired', 'Induction clearance missing or expired'],
      });
    });

    it('returns clear when both medical_expiry and induction_expiry are in the future', async () => {
      const futureDate = new Date(Date.now() + 30 * 86_400_000).toISOString();
      const mockFrom = jest.fn((table: string) => {
        if (table === 'employees') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { employee_code: 'EMP-200' },
                }),
              }),
            }),
          };
        }
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: {
                  emp_code: 'EMP-200',
                  medical_expiry: futureDate,
                  induction_expiry: futureDate,
                },
              }),
            }),
          }),
        };
      });

      createReadReplicaClient.mockResolvedValue({ from: mockFrom });

      const clearance = await getEmployeeClearance('user-clear');
      expect(clearance).toEqual({
        state: 'clear',
        details: [],
      });
    });
  });

  describe('getEmployeeIdentity', () => {
    it('returns trimmed full name and role when employee row exists', async () => {
      createReadReplicaClient.mockResolvedValue({
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { full_name: '  Jane Doe  ', role: 'manager' },
              }),
            }),
          }),
        }),
      });

      const identity = await getEmployeeIdentity('user-jane');
      expect(identity).toEqual({ fullName: 'Jane Doe', role: 'manager' });
    });

    it('returns null fields when employee row is missing', async () => {
      createReadReplicaClient.mockResolvedValue({
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
              }),
            }),
          }),
        }),
      });

      const identity = await getEmployeeIdentity('user-none');
      expect(identity).toEqual({ fullName: null, role: null });
    });
  });
});
