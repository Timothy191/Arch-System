/**
 * @jest-environment node
 */

import { revalidatePath } from 'next/cache';
import { getMusterRollCall, markPersonnelMusterStatus } from './muster';
import { assertAccessControlRole } from './shared';

jest.mock('@repo/redis', () => ({
  cacheInvalidateTags: jest.fn(async () => undefined),
}));

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

jest.mock('./shared', () => ({
  assertAccessControlRole: jest.fn(),
}));

interface QueryBuilderResult {
  data: unknown;
  error?: { message: string } | null;
}

/**
 * Mimics @supabase/postgrest-js PostgrestBuilder: a thenable with `.then()`
 * and NO `.catch()` method so any accidental `.catch()` call throws TypeError.
 */
function createPostgrestThenable(
  resolver: () => Promise<QueryBuilderResult>
): Record<string, unknown> {
  const builder: Record<string, unknown> = {
    select: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    in: jest.fn(() => builder),
    order: jest.fn(() => builder),
    limit: jest.fn(() => builder),
    insert: jest.fn(() => builder),
    then: (
      onFulfilled?: (value: QueryBuilderResult) => unknown,
      onRejected?: (reason: unknown) => unknown
    ) => resolver().then(onFulfilled, onRejected),
  };
  return builder;
}

describe('Access Control Muster Server Actions', () => {
  const mockAssertAccessControlRole = assertAccessControlRole as jest.Mock;
  const mockRevalidatePath = revalidatePath as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads muster roll call using thenable Postgrest queries without .catch()', async () => {
    const mockSupabase = {
      from: jest.fn((table: string) => {
        if (table === 'personnel') {
          return createPostgrestThenable(async () => ({
            data: [
              {
                id: 'p-1',
                first_name: 'John',
                surname: 'Doe',
                emp_code: 'EMP-101',
                job_title: 'Operator',
                induction_expiry: '2030-01-01T00:00:00Z',
                medical_expiry: '2030-01-01T00:00:00Z',
                status: 'Active',
              },
              {
                id: 'p-2',
                first_name: 'Jane',
                surname: 'Smith',
                emp_code: 'EMP-102',
                job_title: 'Supervisor',
                induction_expiry: '2030-01-01T00:00:00Z',
                medical_expiry: '2030-01-01T00:00:00Z',
                status: 'Active',
              },
            ],
            error: null,
          }));
        }
        if (table === 'visitors') {
          return createPostgrestThenable(async () => ({
            data: [
              {
                id: 'v-1',
                first_name: 'Alex',
                surname: 'van Wyk',
                company: 'GeoTech',
                reason_for_entry: 'Inspection',
                status: 'Checked In',
                check_in_time: '2026-11-16T06:00:00Z',
              },
            ],
            error: null,
          }));
        }
        if (table === 'access_logs') {
          return createPostgrestThenable(async () => ({
            data: [
              {
                gate_location: 'Main Gate',
                scanned_at: '2026-11-16T06:05:00Z',
                access_granted: true,
                badge_id: 'b-1',
              },
            ],
            error: null,
          }));
        }
        if (table === 'muster_events') {
          return createPostgrestThenable(async () => ({
            data: [
              {
                personnel_id: 'p-1',
                badge_code: 'EMP-101',
                muster_point: 'Muster Point Alpha',
                status: 'accounted',
                recorded_at: '2026-11-16T07:00:00Z',
              },
              {
                personnel_id: 'p-2',
                badge_code: 'EMP-102',
                muster_point: 'Muster Point Bravo',
                status: 'missing',
                recorded_at: '2026-11-16T07:05:00Z',
              },
            ],
            error: null,
          }));
        }
        return createPostgrestThenable(async () => ({ data: [], error: null }));
      }),
    };

    mockAssertAccessControlRole.mockResolvedValue({
      supabase: mockSupabase,
      user: { id: 'user-1' },
      employee: { id: 'emp-1', role: 'access_control' },
    });

    const summary = await getMusterRollCall('dept-access-1');

    expect(summary.totalSoulsOnSite).toBe(3);
    expect(summary.records).toHaveLength(3);
    expect(summary.records.find((r) => r.id === 'p-1')).toMatchObject({
      status: 'accounted',
      station: 'Muster Point Alpha',
    });
    expect(summary.records.find((r) => r.id === 'p-2')).toMatchObject({
      status: 'unaccounted',
      station: null,
    });
    expect(summary.blastStatus).toBe('STANDBY_BLAST_SCHEDULED');
  });

  it('degrades gracefully when muster_events rejects or returns a database error', async () => {
    const mockSupabase = {
      from: jest.fn((table: string) => {
        if (table === 'muster_events') {
          return createPostgrestThenable(async () => {
            throw new Error('PGRST205: table muster_events missing');
          });
        }
        return createPostgrestThenable(async () => ({ data: [], error: null }));
      }),
    };

    mockAssertAccessControlRole.mockResolvedValue({
      supabase: mockSupabase,
      user: { id: 'user-1' },
      employee: { id: 'emp-1', role: 'access_control' },
    });

    const summary = await getMusterRollCall('dept-access-1');

    expect(summary.totalSoulsOnSite).toBe(0);
    expect(summary.accountedCount).toBe(0);
    expect(summary.unaccountedCount).toBe(0);
    expect(summary.records).toEqual([]);
  });

  it('records muster status via supabase.from("muster_events").insert and revalidates paths', async () => {
    const insertCalls: Array<Record<string, unknown>> = [];
    const mockSupabase = {
      from: jest.fn(() => {
        const builder = createPostgrestThenable(async () => ({ data: null, error: null }));
        builder.insert = jest.fn((payload: Record<string, unknown>) => {
          insertCalls.push(payload);
          return createPostgrestThenable(async () => ({ data: null, error: null }));
        });
        return builder;
      }),
    };

    mockAssertAccessControlRole.mockResolvedValue({
      supabase: mockSupabase,
      user: { id: 'auth-user-42' },
      employee: { id: 'emp-42', role: 'access_control' },
    });

    const uuid = '123e4567-e89b-12d3-a456-426614174000';
    const result = await markPersonnelMusterStatus({
      entityId: uuid,
      status: 'unaccounted',
      station: 'Muster Point Bravo',
    });

    expect(result).toEqual({ success: true });
    expect(insertCalls).toEqual([
      {
        personnel_id: uuid,
        badge_code: uuid,
        full_name: uuid,
        muster_point: 'Muster Point Bravo',
        status: 'missing',
        recorded_by: 'auth-user-42',
      },
    ]);
    expect(mockRevalidatePath).toHaveBeenCalledWith('/access-control/muster');
    expect(mockRevalidatePath).toHaveBeenCalledWith('/access-control');
  });
});
