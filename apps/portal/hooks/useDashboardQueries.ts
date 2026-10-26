'use client';

import { createBrowserSupabaseClient } from '@repo/supabase/client';
import { useQuery } from '@tanstack/react-query';

const supabase = createBrowserSupabaseClient();

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
          .eq('machine_operations.shift_date', today)
          .is('deleted_at', null),
        supabase
          .from('hourly_loads')
          .select('total_loads')
          .eq('department_id', deptId)
          .eq('load_date', today),
        supabase.from('machines').select('*', { count: 'exact', head: true }).eq('active', true),
      ]);

      const totalHours =
        todayOperations.data?.reduce((sum, op) => sum + (op.hours_worked || 0), 0) || 0;
      const activeOperations =
        todayOperations.data?.filter((op) => op.end_smu === null).length || 0;

      const joinedDelays = todayDelayEntries.data ?? [];
      const embeddedDelays =
        todayOperations.data?.flatMap((op) =>
          Array.isArray(op.delay_entries) ? op.delay_entries : []
        ) ?? [];
      const delayRows = joinedDelays.length > 0 ? joinedDelays : embeddedDelays;

      const totalDelayHours = delayRows.reduce((sum, d) => sum + (d.duration_hours || 0), 0);
      const committedDelayHours = delayRows
        .filter((d) => d.status === 'committed')
        .reduce((sum, d) => sum + (d.duration_hours || 0), 0);
      const draftDelayHours = delayRows
        .filter((d) => d.status === 'draft')
        .reduce((sum, d) => sum + (d.duration_hours || 0), 0);

      const totalLoads = todayLoads.data?.reduce((sum, l) => sum + (l.total_loads || 0), 0) || 0;
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
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
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
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Fetch shift coverage data
 * Used by ShiftCoverageWidget
 */
export function useShiftCoverage(deptId: string, today: string) {
  return useQuery({
    queryKey: ['shift-coverage', deptId, today],
    queryFn: async () => {
      const { data: todayLogs } = await supabase
        .from('daily_logs')
        .select('id, log_date, shift')
        .eq('department_id', deptId)
        .eq('log_date', today)
        .order('shift');

      const shiftCount = todayLogs?.length ?? 0;
      const latestShift = todayLogs?.[shiftCount - 1]?.shift;

      return {
        shiftCount,
        latestShift,
        logs: todayLogs || [],
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}
