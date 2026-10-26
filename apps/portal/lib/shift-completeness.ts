import { DatabaseError } from '@repo/errors';
import { CacheCategory } from '@repo/redis';
import type { createServerSupabaseClient } from '@repo/supabase/server';
import { withCache } from '@/lib/cache-utils';
import {
  DELAY_BUCKET_BY_CATEGORY,
  type DelayBucketMinutes,
  emptyDelayBuckets,
} from '@/lib/shift-sheet-buckets';

type SupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

export type RequiredForm =
  | 'machine-operations'
  | 'excavator-activity'
  | 'roll-over'
  | 'hourly-loads';

export interface BreakdownDelaySource {
  reason?: string | null;
  delay_hours?: number | null;
  date_in?: string | null;
  time_in?: string | null;
  date_out?: string | null;
  time_out?: string | null;
}

/**
 * Shift delay hours for one Engineering breakdown, capped at a 12-hour shift.
 * Priority: explicit `delay_hours` → `[Shift Delay: Xh]` reason tag → clock
 * difference between in/out. Single source of truth for both the page KPI and
 * the shift sheet's Breakdown column.
 */
export function breakdownShiftDelayHours(breakdown: BreakdownDelaySource): number {
  const explicit = breakdown.delay_hours;
  if (typeof explicit === 'number' && !Number.isNaN(explicit) && explicit > 0) {
    return Math.min(12, Math.max(0, explicit));
  }

  const tagMatch = breakdown.reason?.match(/\[Shift Delay:\s*([\d.]+)h\]/i);
  if (tagMatch?.[1]) {
    const parsed = Number.parseFloat(tagMatch[1]);
    if (!Number.isNaN(parsed) && parsed > 0) return Math.min(12, parsed);
  }

  if (breakdown.date_in && breakdown.time_in && breakdown.date_out && breakdown.time_out) {
    const startMs = new Date(`${breakdown.date_in}T${breakdown.time_in.slice(0, 8)}`).getTime();
    const endMs = new Date(`${breakdown.date_out}T${breakdown.time_out.slice(0, 8)}`).getTime();
    if (!Number.isNaN(startMs) && !Number.isNaN(endMs) && endMs > startMs) {
      return Math.min(12, Number(((endMs - startMs) / 3_600_000).toFixed(2)));
    }
  }

  return 0;
}

export interface MachineCoverageStatus {
  machineId: string;
  machineName: string;
  machineType: string;
  requiredForm: RequiredForm;
  formLabel: string;
  formPath: string;
  hasEntry: boolean;
  exempt: boolean;
  hoursWorked?: number | null;
  /** Shift-sheet detail. Absent until the machine has an operation for the shift. */
  operatorName?: string | null;
  /** Start SMR (service meter reading) — `machine_operations.start_smu`. */
  smrStart?: number | null;
  /** Stop SMR — `machine_operations.end_smu`. */
  smrStop?: number | null;
  /** Free-text comment from committed delay entries. */
  comment?: string | null;
  /** Delay minutes per sheet bucket for this shift. */
  delayMinutes?: DelayBucketMinutes;
}

export interface ShiftCompleteness {
  complete: boolean;
  totalRequired: number;
  totalCovered: number;
  statuses: MachineCoverageStatus[];
}

const DUMPER_KEYWORDS = ['dump truck', 'dumper', 'haul truck'];
const DOZER_KEYWORDS = ['dozer', 'bulldozer'];
const EXCAVATOR_KEYWORDS = ['excavator', 'excavation'];

function machineTypeLC(t: string) {
  return t.toLowerCase();
}

/** Rethrow query failures so `withCache` never caches a partial sheet. */
function assertQuerySucceeded(table: string, error: { message: string } | null): void {
  if (error) {
    throw new DatabaseError(`Failed to load ${table} for shift completeness`, {
      operation: 'select',
      table,
      context: { error: error.message },
    });
  }
}

function requiredFormFor(machineType: string): RequiredForm {
  const t = machineTypeLC(machineType);
  if (EXCAVATOR_KEYWORDS.some((k) => t.includes(k))) return 'excavator-activity';
  if (DOZER_KEYWORDS.some((k) => t.includes(k))) return 'roll-over';
  if (DUMPER_KEYWORDS.some((k) => t.includes(k))) return 'hourly-loads';
  return 'machine-operations';
}

const FORM_META: Record<RequiredForm, { label: string; path: string }> = {
  'machine-operations': {
    label: 'Machine Operations',
    path: 'machine-operations',
  },
  'excavator-activity': {
    label: 'Excavator Activity',
    path: 'excavator-activity',
  },
  'roll-over': { label: 'Roll-Over (Dozers)', path: 'roll-over' },
  'hourly-loads': { label: 'Hourly Loads', path: 'hourly-loads' },
};

// AGENT-TRACE: Server-side validation utilities for shift data integrity
interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

/**
 * Validate machine hours worked does not exceed maximum
 */
export function validateMachineHours(
  hours: number,
  _shiftType: 'day' | 'night'
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Max 12 hours per shift
  if (hours > 12) {
    errors.push({
      field: 'hours_worked',
      message: `${hours}h exceeds maximum 12h per shift`,
      severity: 'error',
    });
  }

  // Additional check: total across day + night shifts should be < 16h
  // This would require fetching the other shift's data, so we flag as warning
  if (hours > 8) {
    errors.push({
      field: 'hours_worked',
      message: `${hours}h is high; ensure combined day + night shifts < 16h`,
      severity: 'warning',
    });
  }

  return errors;
}

/**
 * Validate bin_factor is within reasonable range for mining equipment
 */
export function validateBinFactor(binFactor: number | null): ValidationError[] {
  const errors: ValidationError[] = [];

  if (binFactor === null || binFactor === undefined) {
    return errors; // bin_factor is optional
  }

  // Valid range: 20-100 for mining equipment (typical 30-50 for dump trucks)
  if (binFactor < 20 || binFactor > 100) {
    errors.push({
      field: 'bin_factor',
      message: `Bin factor ${binFactor} is outside reasonable range (20-100)`,
      severity: 'error',
    });
  }

  return errors;
}

/**
 * Cross-field validation: loads_per_hour should be reasonable for operations
 */
export function validateLoadConsistency(
  totalLoads: number,
  hoursWorked: number | null
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (hoursWorked === null || hoursWorked === 0) {
    return errors; // Can't validate without hours worked
  }

  const loadsPerHour = totalLoads / hoursWorked;

  // Reasonable range: 5-50 loads per hour for typical mining operations
  if (loadsPerHour < 5) {
    errors.push({
      field: 'total_loads',
      message: `Loads per hour (${loadsPerHour.toFixed(1)}) is unusually low for ${hoursWorked}h worked`,
      severity: 'warning',
    });
  }

  if (loadsPerHour > 50) {
    errors.push({
      field: 'total_loads',
      message: `Loads per hour (${loadsPerHour.toFixed(1)}) is unusually high for ${hoursWorked}h worked`,
      severity: 'error',
    });
  }

  return errors;
}

/**
 * Comprehensive validation for shift data
 */
export function validateShiftDataIntegrity(
  _machineId: string,
  hoursWorked: number | null,
  totalLoads: number | null,
  binFactor: number | null,
  shiftType: 'day' | 'night'
): ValidationError[] {
  const allErrors: ValidationError[] = [];

  // Validate hours worked
  if (hoursWorked !== null) {
    allErrors.push(...validateMachineHours(hoursWorked, shiftType));
  }

  // Validate bin factor
  allErrors.push(...validateBinFactor(binFactor));

  // Cross-field validation: loads vs hours
  if (hoursWorked !== null && totalLoads !== null) {
    allErrors.push(...validateLoadConsistency(totalLoads, hoursWorked));
  }

  return allErrors;
}

export async function getShiftCompleteness(
  supabase: SupabaseClient,
  deptId: string,
  departmentSlug: string | null,
  date: string,
  shift: 'day' | 'night'
): Promise<ShiftCompleteness> {
  return withCache(
    async () => {
      const [
        machinesResult,
        machineOpsResult,
        excavatorActsResult,
        dozerRollsResult,
        hourlyLoadsResult,
        breakdownsResult,
      ] = await Promise.all([
        supabase
          .from('machines')
          .select('id, name, machine_type, serial_number, report_exempt')
          .eq('department_id', deptId)
          .eq('active', true)
          .order('name'),
        supabase
          .from('machine_operations')
          .select(
            `machine_id, hours_worked, operator_name, start_time, created_at, start_smu, end_smu,
             operator:operators(full_name),
             delay_entries:delay_entries(
               status, duration_hours, manual_duration_hours, is_manual_override,
               description, deleted_at,
               delay_category:delay_categories(name)
             )`
          )
          .eq('department_id', deptId)
          .eq('shift_date', date)
          .eq('shift_type', shift),
        supabase
          .from('excavator_activity')
          .select('machine_id, notes, operator:operators(full_name)')
          .eq('department_id', deptId)
          .eq('activity_date', date)
          .eq('shift_type', shift),
        supabase
          .from('dozer_rolls')
          .select('machine_id, hours_operated, notes, operator:operators(full_name)')
          .eq('department_id', deptId)
          .eq('roll_date', date)
          .eq('shift_type', shift),
        supabase
          .from('hourly_loads')
          .select('machine_id, total_loads')
          .eq('department_id', deptId)
          .eq('load_date', date)
          .eq('shift_type', shift),
        supabase
          .from('breakdowns')
          .select('id, fleet_id, reason, status, delay_hours, date_in, time_in, date_out, time_out')
          .eq('department_id', deptId)
          .or(`status.eq.active,date_in.eq.${date},date_out.eq.${date}`),
      ]);

      assertQuerySucceeded('machines', machinesResult.error);
      assertQuerySucceeded('machine_operations', machineOpsResult.error);
      assertQuerySucceeded('excavator_activity', excavatorActsResult.error);
      assertQuerySucceeded('dozer_rolls', dozerRollsResult.error);
      assertQuerySucceeded('hourly_loads', hourlyLoadsResult.error);
      assertQuerySucceeded('breakdowns', breakdownsResult.error);

      const machines = machinesResult.data ?? [];
      const machineOps = machineOpsResult.data ?? [];
      const excavatorActs = excavatorActsResult.data ?? [];
      const dozerRolls = dozerRollsResult.data ?? [];
      const hourlyLoads = hourlyLoadsResult.data ?? [];
      const breakdowns = breakdownsResult.data ?? [];

      const machineOpIds = new Set(machineOps.map((r: { machine_id: string }) => r.machine_id));
      const excavatorIds = new Set(excavatorActs.map((r: { machine_id: string }) => r.machine_id));
      const dozerIds = new Set(dozerRolls.map((r: { machine_id: string }) => r.machine_id));
      const loadIds = new Set(
        hourlyLoads
          .filter(
            (r: { machine_id: string; total_loads: number | null }) => (r.total_loads ?? 0) > 0
          )
          .map((r: { machine_id: string; total_loads: number | null }) => r.machine_id)
      );

      const machineOpHoursMap = new Map<string, number>();
      for (const op of machineOps) {
        if (op.machine_id && op.hours_worked !== null) {
          const current = machineOpHoursMap.get(op.machine_id) || 0;
          machineOpHoursMap.set(op.machine_id, current + Number(op.hours_worked));
        }
      }

      const dozerHoursMap = new Map<string, number>();
      for (const roll of dozerRolls) {
        if (roll.machine_id && roll.hours_operated !== null) {
          const current = dozerHoursMap.get(roll.machine_id) || 0;
          dozerHoursMap.set(roll.machine_id, current + Number(roll.hours_operated));
        }
      }

      // ---- Shift-sheet detail (machine ID · operator · SMR · delays · comment) ----
      // Aggregated per machine from the operation record and its committed
      // delay_entries, plus Engineering breakdown delay minutes.
      interface SheetDetail {
        operatorName: string | null;
        smrStart: number | null;
        smrStop: number | null;
        comment: string | null;
        delayMinutes: DelayBucketMinutes;
      }

      interface MachineOpDetailRow {
        machine_id: string;
        operator_name: string | null;
        start_time: string | null;
        created_at: string | null;
        start_smu: number | string | null;
        end_smu: number | string | null;
        operator: { full_name: string } | null;
        delay_entries: Array<{
          status: string | null;
          duration_hours: number | string | null;
          manual_duration_hours: number | string | null;
          is_manual_override: boolean | null;
          description: string | null;
          deleted_at: string | null;
          delay_category: { name: string } | null;
        }> | null;
      }

      const sheetDetailByMachine = new Map<string, SheetDetail>();
      const sheetCommentsByMachine = new Map<string, Set<string>>();

      // A machine/shift can hold several operations (the unique key includes
      // start_smu), so order them explicitly: earliest start first, rows without
      // a start time last, created_at as the tie-breaker.
      const orderedOps = [...(machineOps as unknown as MachineOpDetailRow[])].sort((a, b) => {
        if (a.start_time !== b.start_time) {
          if (!a.start_time) return 1;
          if (!b.start_time) return -1;
          return a.start_time < b.start_time ? -1 : 1;
        }
        return (a.created_at ?? '').localeCompare(b.created_at ?? '');
      });

      for (const op of orderedOps) {
        const detail = sheetDetailByMachine.get(op.machine_id) ?? {
          operatorName: null,
          smrStart: null,
          smrStop: null,
          comment: null,
          delayMinutes: emptyDelayBuckets(),
        };

        detail.operatorName ??= op.operator?.full_name ?? op.operator_name ?? null;
        if (detail.smrStart === null && op.start_smu !== null && op.start_smu !== undefined) {
          detail.smrStart = Number(op.start_smu);
        }
        // Latest operation of the shift wins for the stop reading.
        if (op.end_smu !== null && op.end_smu !== undefined) {
          detail.smrStop = Number(op.end_smu);
        }

        for (const entry of op.delay_entries ?? []) {
          if (entry.deleted_at || entry.status !== 'committed') continue;

          const categoryKey = (entry.delay_category?.name ?? '').trim().toLowerCase();
          const bucket = DELAY_BUCKET_BY_CATEGORY[categoryKey];
          const hours =
            entry.is_manual_override && entry.manual_duration_hours !== null
              ? Number(entry.manual_duration_hours)
              : Number(entry.duration_hours ?? 0);
          if (bucket && Number.isFinite(hours) && hours > 0) {
            detail.delayMinutes[bucket] += Math.round(hours * 60);
          }

          const text = entry.description?.trim();
          if (text) {
            const bucketComments = sheetCommentsByMachine.get(op.machine_id) ?? new Set<string>();
            bucketComments.add(text);
            sheetCommentsByMachine.set(op.machine_id, bucketComments);
          }
        }

        sheetDetailByMachine.set(op.machine_id, detail);
      }

      for (const [machineId, comments] of sheetCommentsByMachine) {
        const detail = sheetDetailByMachine.get(machineId);
        if (detail) detail.comment = [...comments].join(' · ');
      }

      // Operator + comment fallbacks for machines whose required form is a
      // roll-over / excavator-activity record (those tables carry no SMR).
      const fallbackOperatorByMachine = new Map<string, string>();
      const fallbackCommentByMachine = new Map<string, string>();
      for (const row of excavatorActs as unknown as Array<{
        machine_id: string;
        notes: string | null;
        operator: { full_name: string } | null;
      }>) {
        if (row.operator?.full_name) {
          fallbackOperatorByMachine.set(row.machine_id, row.operator.full_name);
        }
        if (row.notes?.trim()) fallbackCommentByMachine.set(row.machine_id, row.notes.trim());
      }
      for (const row of dozerRolls as unknown as Array<{
        machine_id: string;
        notes: string | null;
        operator: { full_name: string } | null;
      }>) {
        if (!fallbackOperatorByMachine.has(row.machine_id) && row.operator?.full_name) {
          fallbackOperatorByMachine.set(row.machine_id, row.operator.full_name);
        }
        if (!fallbackCommentByMachine.has(row.machine_id) && row.notes?.trim()) {
          fallbackCommentByMachine.set(row.machine_id, row.notes.trim());
        }
      }

      // Engineering breakdown minutes, resolved by machine id / name / serial.
      const machineIdByKey = new Map<string, string>();
      for (const m of machines) {
        machineIdByKey.set(m.id, m.id);
        machineIdByKey.set(m.name, m.id);
        const serial = (m as { serial_number?: string | null }).serial_number;
        if (serial) machineIdByKey.set(serial, m.id);
      }

      const breakdownMinutesByMachine = new Map<string, number>();
      for (const breakdown of breakdowns) {
        const machineId = machineIdByKey.get(String(breakdown.fleet_id ?? '').trim());
        if (!machineId) continue;
        const minutes = Math.round(breakdownShiftDelayHours(breakdown) * 60);
        if (minutes <= 0) continue;
        breakdownMinutesByMachine.set(
          machineId,
          (breakdownMinutesByMachine.get(machineId) ?? 0) + minutes
        );
      }

      const statuses: MachineCoverageStatus[] = machines.map(
        (m: {
          id: string;
          name: string;
          machine_type: string;
          serial_number?: string | null;
          report_exempt?: boolean | null;
        }) => {
          const requiredForm = requiredFormFor(m.machine_type);
          const meta = FORM_META[requiredForm];

          let hasEntry: boolean;
          switch (requiredForm) {
            case 'excavator-activity':
              hasEntry = excavatorIds.has(m.id);
              break;
            case 'roll-over':
              hasEntry = dozerIds.has(m.id);
              break;
            case 'hourly-loads':
              hasEntry = loadIds.has(m.id);
              break;
            default:
              hasEntry = machineOpIds.has(m.id);
          }

          let hoursWorked: number | null = null;
          if (requiredForm === 'machine-operations') {
            hoursWorked = machineOpHoursMap.get(m.id) ?? null;
          } else if (requiredForm === 'roll-over') {
            hoursWorked = dozerHoursMap.get(m.id) ?? null;
          }

          const detail = sheetDetailByMachine.get(m.id);
          const delayMinutes = detail ? { ...detail.delayMinutes } : emptyDelayBuckets();
          delayMinutes.breakdown += breakdownMinutesByMachine.get(m.id) ?? 0;

          return {
            machineId: m.id,
            machineName: m.name,
            machineType: m.machine_type,
            requiredForm,
            formLabel: meta.label,
            formPath: departmentSlug ? `/${departmentSlug}/${meta.path}` : `/${meta.path}`,
            hasEntry,
            exempt: m.report_exempt ?? false,
            hoursWorked,
            operatorName: detail?.operatorName ?? fallbackOperatorByMachine.get(m.id) ?? null,
            smrStart: detail?.smrStart ?? null,
            smrStop: detail?.smrStop ?? null,
            comment: detail?.comment ?? fallbackCommentByMachine.get(m.id) ?? null,
            delayMinutes,
          };
        }
      );

      const required = statuses.filter((s) => !s.exempt);
      const covered = required.filter((s) => s.hasEntry);

      return {
        complete: required.length === 0 || covered.length === required.length,
        totalRequired: required.length,
        totalCovered: covered.length,
        statuses,
      };
    },
    {
      category: CacheCategory.SHIFT,
      keyParts: [deptId, departmentSlug ?? '', date, shift],
      tags: [
        `dept:${deptId}`,
        'table:machines',
        'table:machine_operations',
        'table:excavator_activity',
        'table:dozer_rolls',
        'table:hourly_loads',
        'table:delay_entries',
        'table:delay_categories',
        'table:breakdowns',
        'table:operators',
      ],
    }
  );
}
