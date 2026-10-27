import { DEPARTMENTS } from '@repo/departments/data-access';
import { prewarmDepartmentCache } from './prewarm-cache';

jest.mock('@repo/redis/cache', () => ({
  cacheGet: jest.fn(),
  cacheSet: jest.fn(),
}));

jest.mock('@repo/supabase/server', () => ({
  createServerSupabaseClient: jest.fn(),
}));

interface MockRedisCacheModule {
  cacheGet: jest.Mock;
  cacheSet: jest.Mock;
}

interface MockSupabaseServerModule {
  createServerSupabaseClient: jest.Mock;
}

const { cacheGet, cacheSet } = jest.requireMock<MockRedisCacheModule>('@repo/redis/cache');
const { createServerSupabaseClient } =
  jest.requireMock<MockSupabaseServerModule>('@repo/supabase/server');

const CACHE_TTL_SECONDS = 3600;

describe('prewarmDepartmentCache', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('queries Supabase and populates cache with 3600s TTL for uncached departments', async () => {
    cacheGet.mockResolvedValue(null);
    cacheSet.mockResolvedValue(undefined);

    const mockFrom = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn((_col: string, deptName: string) => ({
          single: jest.fn().mockResolvedValue({
            data: { id: `uuid-${deptName}` },
          }),
        })),
      }),
    });

    createServerSupabaseClient.mockResolvedValue({ from: mockFrom });

    await prewarmDepartmentCache();

    expect(cacheGet).toHaveBeenCalledTimes(DEPARTMENTS.length);
    expect(cacheSet).toHaveBeenCalledTimes(DEPARTMENTS.length);
    for (const dept of DEPARTMENTS) {
      expect(cacheSet).toHaveBeenCalledWith(
        `dept:uuid:${dept.name}`,
        `uuid-${dept.name}`,
        CACHE_TTL_SECONDS
      );
    }
  });

  it('skips Supabase lookup and cacheSet when department UUID is already cached', async () => {
    cacheGet.mockResolvedValue('existing-uuid');

    const mockFrom = jest.fn();
    createServerSupabaseClient.mockResolvedValue({ from: mockFrom });

    await prewarmDepartmentCache();

    expect(cacheGet).toHaveBeenCalledTimes(DEPARTMENTS.length);
    expect(mockFrom).not.toHaveBeenCalled();
    expect(cacheSet).not.toHaveBeenCalled();
  });

  it('does not call cacheSet when department is not found in database', async () => {
    cacheGet.mockResolvedValue(null);

    const mockFrom = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: null,
          }),
        }),
      }),
    });

    createServerSupabaseClient.mockResolvedValue({ from: mockFrom });

    await prewarmDepartmentCache();

    expect(mockFrom).toHaveBeenCalledTimes(DEPARTMENTS.length);
    expect(cacheSet).not.toHaveBeenCalled();
  });

  it('silently swallows per-department database errors and continues warming remaining departments', async () => {
    cacheGet.mockResolvedValue(null);
    cacheSet.mockResolvedValue(undefined);

    const firstDeptName = DEPARTMENTS[0]?.name;
    const mockFrom = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn((_col: string, deptName: string) => ({
          single: jest.fn().mockImplementation(async () => {
            if (deptName === firstDeptName) {
              throw new Error('Transient DB timeout');
            }
            return { data: { id: `uuid-${deptName}` } };
          }),
        })),
      }),
    });

    createServerSupabaseClient.mockResolvedValue({ from: mockFrom });

    await expect(prewarmDepartmentCache()).resolves.toBeUndefined();
    expect(cacheSet).toHaveBeenCalledTimes(DEPARTMENTS.length - 1);
  });
});
