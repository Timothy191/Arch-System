/**
 * @jest-environment node
 */

import { cacheInvalidateTags } from '@repo/redis';
import { revalidatePath } from 'next/cache';
import { DatabaseError, ValidationError } from '@/lib/errors/error-classes';
import { assertAccessControlRole } from '../actions/shared';
import { autoExitOverdueVisitors, manualCheckOutVisitor } from './actions';
import { AUTO_EXITED_VISITOR_STATUS, MANUAL_CHECKED_OUT_STATUS } from './visitor-auto-exit';

jest.mock('@repo/redis', () => ({
  cacheInvalidateTags: jest.fn(async () => undefined),
}));

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

jest.mock('../actions/shared', () => ({
  assertAccessControlRole: jest.fn(),
}));

interface QueryResult {
  data?: unknown;
  error?: { message: string } | null;
}

function createFluentQuery(result: QueryResult) {
  const promise = Promise.resolve(result);
  const chain: Record<string, unknown> = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    in: jest.fn(() => chain),
    update: jest.fn(() => chain),
    insert: jest.fn(() => chain),
    then: (
      onFulfilled?: (val: QueryResult) => unknown,
      onRejected?: (reason: unknown) => unknown
    ) => promise.then(onFulfilled, onRejected),
  };
  return chain;
}

describe('access-control/visitors/actions', () => {
  const mockAssertRole = assertAccessControlRole as jest.Mock;
  const mockRevalidatePath = revalidatePath as jest.Mock;
  const mockCacheInvalidateTags = cacheInvalidateTags as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('autoExitOverdueVisitors', () => {
    it('auto-exits visitors >= 12h, deactivates badges, logs access_logs exit, and skips revalidatePath when skipRevalidate=true', async () => {
      const nowMs = Date.now();
      const overdueTime = new Date(nowMs - 13 * 60 * 60 * 1000).toISOString();
      const recentTime = new Date(nowMs - 2 * 60 * 60 * 1000).toISOString();

      const visitorUpdates: Array<Record<string, unknown>> = [];
      const badgeUpdates: Array<Record<string, unknown>> = [];
      const logInserts: unknown[] = [];

      const mockSupabase = {
        from: jest.fn((table: string) => {
          if (table === 'visitors') {
            const chain = createFluentQuery({
              data: [
                {
                  id: 'v-overdue',
                  first_name: 'John',
                  surname: 'Doe',
                  company: 'Acme Contractors',
                  check_in_time: overdueTime,
                  check_out_time: null,
                  created_at: overdueTime,
                  status: 'Checked In',
                },
                {
                  id: 'v-recent',
                  first_name: 'Jane',
                  surname: 'Fresh',
                  company: 'Mine Corp',
                  check_in_time: recentTime,
                  check_out_time: null,
                  created_at: recentTime,
                  status: 'Checked In',
                },
              ],
              error: null,
            });
            chain.update = jest.fn((payload: Record<string, unknown>) => {
              visitorUpdates.push(payload);
              return createFluentQuery({ data: null, error: null });
            });
            return chain;
          }

          if (table === 'badges') {
            const chain = createFluentQuery({
              data: [
                { id: 'b-overdue', visitor_id: 'v-overdue', issued_at: overdueTime },
                { id: 'b-recent', visitor_id: 'v-recent', issued_at: recentTime },
              ],
              error: null,
            });
            chain.update = jest.fn((payload: Record<string, unknown>) => {
              badgeUpdates.push(payload);
              return createFluentQuery({ data: null, error: null });
            });
            return chain;
          }

          if (table === 'access_logs') {
            const chain = createFluentQuery({ data: null, error: null });
            chain.insert = jest.fn((payload: unknown) => {
              logInserts.push(payload);
              return createFluentQuery({ data: null, error: null });
            });
            return chain;
          }

          return createFluentQuery({ data: [], error: null });
        }),
      };

      mockAssertRole.mockResolvedValue({
        supabase: mockSupabase,
        user: { id: 'u-1' },
        employee: { id: 'e-1', department_id: 'dept-1', role: 'access_control' },
      });

      const result = await autoExitOverdueVisitors('dept-1', { skipRevalidate: true });

      expect(result.autoExited).toHaveLength(1);
      expect(result.autoExited[0]).toMatchObject({
        id: 'v-overdue',
        name: 'John Doe',
        company: 'Acme Contractors',
        checkInTime: overdueTime,
      });
      expect(visitorUpdates[0]).toMatchObject({ status: AUTO_EXITED_VISITOR_STATUS });
      expect(badgeUpdates[0]).toMatchObject({ is_active: false });
      expect(logInserts[0]).toEqual([
        expect.objectContaining({
          badge_id: 'b-overdue',
          direction: 'OUT',
          gate_location: 'Auto-Exit (12h Limit)',
          department_id: 'dept-1',
        }),
      ]);
      expect(mockCacheInvalidateTags).toHaveBeenCalledWith([
        'table:visitors',
        'table:badges',
        'table:access_logs',
        'dept:dept-1',
      ]);
      expect(mockRevalidatePath).not.toHaveBeenCalled();
    });

    it('uses fallback visitors query on schema mismatch, detects overdue badge issued_at, and calls revalidatePath by default', async () => {
      const nowMs = Date.now();
      const recentTime = new Date(nowMs - 1 * 60 * 60 * 1000).toISOString();
      const overdueBadgeTime = new Date(nowMs - 12.5 * 60 * 60 * 1000).toISOString();

      let visitorSelectCall = 0;

      const mockSupabase = {
        from: jest.fn((table: string) => {
          if (table === 'visitors') {
            visitorSelectCall += 1;
            if (visitorSelectCall === 1) {
              return createFluentQuery({
                data: null,
                error: { message: 'column visitors.first_name does not exist' },
              });
            }
            const fallbackChain = createFluentQuery({
              data: [
                {
                  id: 'v-badge-overdue',
                  name: 'Legacy Visitor',
                  company: null,
                  check_in_time: recentTime,
                  check_out_time: null,
                  created_at: recentTime,
                  status: 'Checked In',
                },
              ],
              error: null,
            });
            fallbackChain.update = jest.fn(() => createFluentQuery({ data: null, error: null }));
            return fallbackChain;
          }

          if (table === 'badges') {
            const chain = createFluentQuery({
              data: [{ id: 'b-1', visitor_id: 'v-badge-overdue', issued_at: overdueBadgeTime }],
              error: null,
            });
            chain.update = jest.fn(() => createFluentQuery({ data: null, error: null }));
            return chain;
          }

          return createFluentQuery({ data: null, error: null });
        }),
      };

      mockAssertRole.mockResolvedValue({
        supabase: mockSupabase,
        user: { id: 'u-1' },
        employee: { id: 'e-1', department_id: 'dept-1', role: 'access_control' },
      });

      const result = await autoExitOverdueVisitors('dept-1');

      expect(result.autoExited).toHaveLength(1);
      expect(result.autoExited[0]?.name).toBe('Legacy Visitor');
      expect(result.autoExited[0]?.company).toBe('General Visitor');
      expect(mockRevalidatePath).toHaveBeenCalledWith('/access-control/visitors');
    });

    it('returns empty array when no visitors are overdue and throws DatabaseError when fallback fails', async () => {
      mockAssertRole.mockResolvedValue({
        supabase: {
          from: jest.fn(() => createFluentQuery({ data: [], error: null })),
        },
        user: { id: 'u-1' },
        employee: { id: 'e-1', department_id: 'dept-1', role: 'access_control' },
      });

      await expect(autoExitOverdueVisitors('dept-1')).resolves.toEqual({ autoExited: [] });

      mockAssertRole.mockResolvedValue({
        supabase: {
          from: jest.fn(() =>
            createFluentQuery({ data: null, error: { message: 'connection failed' } })
          ),
        },
        user: { id: 'u-1' },
        employee: { id: 'e-1', department_id: 'dept-1', role: 'access_control' },
      });

      await expect(autoExitOverdueVisitors('dept-1')).rejects.toThrow(DatabaseError);
    });
  });

  describe('manualCheckOutVisitor', () => {
    it('validates visitorId and checks out visitor with requireWrite=true', async () => {
      const visitorUpdates: Array<Record<string, unknown>> = [];
      const badgeUpdates: Array<Record<string, unknown>> = [];

      const mockSupabase = {
        from: jest.fn((table: string) => {
          if (table === 'visitors') {
            const chain = createFluentQuery({ data: null, error: null });
            chain.update = jest.fn((payload: Record<string, unknown>) => {
              visitorUpdates.push(payload);
              return createFluentQuery({ data: null, error: null });
            });
            return chain;
          }
          if (table === 'badges') {
            const chain = createFluentQuery({ data: null, error: null });
            chain.update = jest.fn((payload: Record<string, unknown>) => {
              badgeUpdates.push(payload);
              return createFluentQuery({ data: null, error: null });
            });
            return chain;
          }
          return createFluentQuery({ data: null, error: null });
        }),
      };

      mockAssertRole.mockResolvedValue({
        supabase: mockSupabase,
        user: { id: 'u-1' },
        employee: { id: 'e-1', department_id: 'dept-1', role: 'access_control' },
      });

      await expect(manualCheckOutVisitor('   ')).rejects.toThrow(ValidationError);

      const res = await manualCheckOutVisitor('visitor-99');

      expect(mockAssertRole).toHaveBeenCalledWith({ requireWrite: true });
      expect(res.success).toBe(true);
      expect(res.visitorId).toBe('visitor-99');
      expect(visitorUpdates[0]).toMatchObject({ status: MANUAL_CHECKED_OUT_STATUS });
      expect(badgeUpdates[0]).toMatchObject({ is_active: false });
      expect(mockRevalidatePath).toHaveBeenCalledWith('/access-control/visitors');
    });

    it('throws DatabaseError when visitor update fails', async () => {
      mockAssertRole.mockResolvedValue({
        supabase: {
          from: jest.fn(() =>
            createFluentQuery({ data: null, error: { message: 'update blocked' } })
          ),
        },
        user: { id: 'u-1' },
        employee: { id: 'e-1', department_id: 'dept-1', role: 'access_control' },
      });

      await expect(manualCheckOutVisitor('visitor-99')).rejects.toThrow(DatabaseError);
    });
  });
});
