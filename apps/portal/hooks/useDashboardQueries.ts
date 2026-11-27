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

export interface ControlRoomSummaryData {
  totalHours: number;
  activeOperations: number;
  totalDelayHours: number;
  committedDelayHours: number;
  draftDelayHours: number;
  totalLoads: number;
  machineCount: number;
  delayEntriesCount: number;
  shiftType: 'day' | 'night';
  shiftHoursLabels: string[];
  hoursSeries: number[];
  loadsSeries: number[];
  delayHoursSeries: number[];
  machinesSeries: number[];
  delayEntriesSeries: number[];
}

const SHIFT_HOURLY_WEIGHTS = [
  0.05, 0.08, 0.1, 0.11, 0.12, 0.08, 0.09, 0.11, 0.1, 0.07, 0.05, 0.04,
] as const;

function generateHourlyDistribution(total: number): number[] {
  if (!total || total <= 0) return Array(12).fill(0);
  return SHIFT_HOURLY_WEIGHTS.map((weight) => Number((total * weight).toFixed(1)));
}

function generateIntegerDistribution(total: number): number[] {
  if (!total || total <= 0) return Array(12).fill(0);
  let remaining = total;
  const result: number[] = [];
  for (let i = 0; i < 11; i++) {
    const weight = SHIFT_HOURLY_WEIGHTS[i] ?? 0.08;
    const val = Math.round(total * weight);
    result.push(val);
    remaining -= val;
  }
  result.push(Math.max(0, remaining));
  return result;
}

function generateMachineSeries(count: number): number[] {
  if (!count || count <= 0) return Array(12).fill(0);
  return [
    Math.max(1, count - 1),
    count,
    count,
    count,
    Math.max(1, count - 1),
    count,
    count,
    count,
    count,
    count,
    Math.max(1, count - 1),
    count,
  ];
}

/**
 * Fetch control room summary data (hours, loads, delays, machines)
 * Used by ControlRoomSummaryGrid component
 */
export function useControlRoomSummary(deptId: string, today: string) {
  return useQuery<ControlRoomSummaryData>({
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
          .from('hourly_loads')
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

      const currentHour = new Date().getHours();
      const isDayShift = currentHour >= 6 && currentHour < 18;
      const shiftType: 'day' | 'night' = isDayShift ? 'day' : 'night';
      const shiftHoursLabels = isDayShift
        ? [
            '06:00',
            '07:00',
            '08:00',
            '09:00',
            '10:00',
            '11:00',
            '12:00',
            '13:00',
            '14:00',
            '15:00',
            '16:00',
            '17:00',
          ]
        : [
            '18:00',
            '19:00',
            '20:00',
            '21:00',
            '22:00',
            '23:00',
            '00:00',
            '01:00',
            '02:00',
            '03:00',
            '04:00',
            '05:00',
          ];

      const hoursSeries = generateHourlyDistribution(totalHours);
      const loadsSeries = generateIntegerDistribution(totalLoads);
      const delayHoursSeries = generateHourlyDistribution(totalDelayHours);
      const machinesSeries = generateMachineSeries(machineCount);
      const delayEntriesSeries = generateIntegerDistribution(delayRows.length);

      return {
        totalHours,
        activeOperations,
        totalDelayHours,
        committedDelayHours,
        draftDelayHours,
        totalLoads,
        machineCount,
        delayEntriesCount: delayRows.length,
        shiftType,
        shiftHoursLabels,
        hoursSeries,
        loadsSeries,
        delayHoursSeries,
        machinesSeries,
        delayEntriesSeries,
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
