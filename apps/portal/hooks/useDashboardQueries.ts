'use client';

import { createBrowserSupabaseClient } from '@repo/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { isRetryableErrorDefault } from '@/lib/errors/retry-strategy';

const supabase = createBrowserSupabaseClient();

const QUERY_STALE_TIME_MS = 5 * 60 * 1000; // 5 minutes
const QUERY_GC_TIME_MS = 10 * 60 * 1000; // 10 minutes
const MAX_QUERY_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 30000;

function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (failureCount >= MAX_QUERY_RETRIES) {
    return false;
  }
  return isRetryableErrorDefault(error);
}

function calculateRetryDelay(attempt: number): number {
  return Math.min(BASE_RETRY_DELAY_MS * 2 ** attempt, MAX_RETRY_DELAY_MS);
}

/**
 * Fetch control room summary data (hours, loads, delays, machines)
 * Used by ControlRoomSummaryGrid component
 */
export function useControlRoomSummary(deptId: string, today: string) {
  return useQuery({
    queryKey: ['control-room-summary', deptId, today],
    queryFn: async () => {
      const [todayOperations, todayDelayEntries, todayLoads, machines] = await Promise.all([
        supabase
          .from('machine_operations')
          .select('hours_worked, end_smu, delay_entries:delay_entries(duration_hours, status)')
          .eq('department_id', deptId)
          .eq('shift_date', today),
        supabase
          .from('delay_entries')
          .select('duration_hours, status, machine_operations!inner(department_id, shift_date)')
          .eq('machine_operations.department_id', deptId)
          .eq('machine_operations.shift_date', today),
        supabase
          .from('production_loads')
          .select('id', { count: 'exact', head: true })
          .eq('department_id', deptId)
          .eq('load_date', today),
        supabase.from('machines').select('*', { count: 'exact', head: true }).eq('active', true),
      ]);

      const operations = todayOperations.data ?? [];
      const delayRows = todayDelayEntries.data ?? [];

      const totalHours = operations.reduce((sum, op) => sum + (Number(op.hours_worked) || 0), 0);
      const activeOperations = operations.filter((op) => !op.end_smu).length;

      let committedDelayHours = 0;
      let draftDelayHours = 0;

      for (const row of delayRows) {
        const hours = Number(row.duration_hours) || 0;
        if (row.status === 'committed') {
          committedDelayHours += hours;
        } else {
          draftDelayHours += hours;
        }
      }

      const totalDelayHours = committedDelayHours + draftDelayHours;
      const totalLoads = todayLoads.count ?? 0;
      const machineCount = machines.count ?? 0;

      return {
        totalHours,
        activeOperations,
        totalDelayHours,
        committedDelayHours,
        draftDelayHours,
        totalLoads,
        machineCount,
        delayEntriesCount: delayRows.length,
      };
    },
    staleTime: QUERY_STALE_TIME_MS,
    gcTime: QUERY_GC_TIME_MS,
    retry: shouldRetryQuery,
    retryDelay: calculateRetryDelay,
  });
}

/**
 * Fetch non-control room summary data (daily logs, machines)
 * Used by NonControlRoomSummaryGrid component
 */
export function useNonControlRoomSummary(deptId: string, today: string) {
  return useQuery({
    queryKey: ['non-control-room-summary', deptId, today],
    queryFn: async () => {
      const [todayLogs, machines] = await Promise.all([
        supabase
          .from('daily_logs')
          .select('id, log_date, shift')
          .eq('department_id', deptId)
          .eq('log_date', today)
          .order('shift'),
        supabase.from('machines').select('*', { count: 'exact', head: true }).eq('active', true),
      ]);

      const shiftCount = todayLogs.data?.length ?? 0;
      const latestShift = todayLogs.data?.[shiftCount - 1]?.shift;
      const machineCount = machines.count ?? 0;

      return {
        shiftCount,
        latestShift,
        machineCount,
        hasLogs: shiftCount > 0,
      };
    },
    staleTime: QUERY_STALE_TIME_MS,
    gcTime: QUERY_GC_TIME_MS,
    retry: shouldRetryQuery,
    retryDelay: calculateRetryDelay,
  });
}
