'use server';

import { AuthError, DatabaseError, ValidationError } from '@repo/errors';
import { cacheInvalidateTags } from '@repo/redis';
import { getAuthenticatedEmployee } from '@repo/supabase';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { createServiceRoleClient } from '@repo/supabase/service-role';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import {
  OVERVIEW_DELAY_COLUMNS,
  type OverviewDelayHours,
  validateOverviewRowDelaysAndComment,
} from '@/lib/shift-sheet-buckets';

// AGENT-TRACE: Explicit allowlist of insertable columns. The previous version
// passed the caller's object straight to `.insert()`, which allowed mass
// assignment of ownership/tenant columns.
const createEngineeringNoteSchema = z
  .object({
    department_id: z.string().uuid(),
    note_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
    shift_type: z.enum(['day', 'night']),
    issue_type: z.enum(['mechanical', 'electrical', 'structural', 'hydraulic', 'other']),
    severity: z.enum(['low', 'medium', 'high', 'critical']),
    machine_id: z.string().uuid().nullable(),
    description: z.string().min(1).max(5000),
    action_taken: z.string().max(5000).nullable(),
    requires_follow_up: z.boolean(),
    status: z.literal('open'),
  })
  .strict();

const overviewDelaysSchema = z.object({
  natural: z.number().min(0).max(12),
  blasting: z.number().min(0).max(12),
  lunches: z.number().min(0).max(12),
  safetyTalks: z.number().min(0).max(12),
  refueling: z.number().min(0).max(12),
  noOperator: z.number().min(0).max(12),
  standby: z.number().min(0).max(12),
  other: z.number().min(0).max(12),
  gesMaintenance: z.number().min(0).max(12),
  tyresTracks: z.number().min(0).max(12),
  greasingStartups: z.number().min(0).max(12),
  breakdown: z.number().min(0).max(12),
});

const saveMachineOverviewRowSchema = z.object({
  departmentId: z.string().uuid(),
  machineId: z.string().uuid(),
  machineName: z.string().min(1).max(200),
  machineType: z.string().min(1).max(100),
  serialNumber: z.string().max(120).nullable().optional(),
  siteId: z.string().uuid().nullable().optional(),
  shiftDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  shiftType: z.enum(['day', 'night']),
  startSmr: z.number().min(0),
  stopSmr: z.number().min(0),
  operatorId: z.string().uuid().nullable().optional(),
  comment: z.string().max(3000),
  endsOnBreakdown: z.boolean().optional().default(false),
  delays: overviewDelaysSchema,
});

const bookOutCarryOverBreakdownSchema = z.object({
  departmentId: z.string().uuid(),
  machineId: z.string().uuid(),
  machineName: z.string().min(1).max(200),
  serialNumber: z.string().max(120).nullable().optional(),
  shiftDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  repairNotes: z.string().max(2000).optional(),
});

export type SaveMachineOverviewRowInput = z.infer<typeof saveMachineOverviewRowSchema>;

export async function createEngineeringNote(payload: unknown) {
  const supabase = await createServerSupabaseClient();

  const principal = await getAuthenticatedEmployee(supabase);
  if (!principal) {
    throw new AuthError('Unauthorized', {
      context: { action: 'createEngineeringNote' },
    });
  }

  const parsed = createEngineeringNoteSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ValidationError('Invalid engineering note payload', {
      context: {
        action: 'createEngineeringNote',
        issues: parsed.error.issues.map((issue) => issue.path.join('.')).join(', '),
      },
    });
  }

  const note = parsed.data;

  const { error } = await supabase.from('engineering_notes').insert({
    department_id: note.department_id,
    note_date: note.note_date,
    shift_type: note.shift_type,
    issue_type: note.issue_type,
    severity: note.severity,
    machine_id: note.machine_id,
    description: note.description,
    action_taken: note.action_taken,
    requires_follow_up: note.requires_follow_up,
    status: note.status,
  });

  if (error) {
    throw new DatabaseError('Failed to create engineering note', {
      operation: 'insert',
      table: 'engineering_notes',
      context: { error: error.message },
    });
  }

  await cacheInvalidateTags(['table:engineering_notes']);
  revalidatePath('/');
  return { success: true };
}

export async function saveMachineOverviewRow(payload: unknown) {
  const supabase = await createServerSupabaseClient();
  const principal = await getAuthenticatedEmployee(supabase);
  if (!principal?.employee) {
    throw new AuthError('Unauthorized', {
      context: { action: 'saveMachineOverviewRow' },
    });
  }

  const parsed = saveMachineOverviewRowSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ValidationError('Invalid machine overview payload', {
      context: {
        action: 'saveMachineOverviewRow',
        issues: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
      },
    });
  }

  const row = parsed.data;

  if (row.stopSmr < row.startSmr) {
    throw new ValidationError('Stop SMR cannot be less than Start SMR', {
      context: { machineId: row.machineId, startSmr: row.startSmr, stopSmr: row.stopSmr },
    });
  }

  const commentCheck = validateOverviewRowDelaysAndComment(
    row.delays as OverviewDelayHours,
    row.comment
  );
  if (!commentCheck.valid) {
    throw new ValidationError(
      commentCheck.error ?? 'A matching comment is required when any delay is recorded',
      {
        context: {
          machineId: row.machineId,
          activeDelays: commentCheck.activeDelayLabels,
        },
      }
    );
  }

  const serviceClient = createServiceRoleClient();

  // 1. Find or create machine_operations record for this machine + shift
  const { data: existingOps, error: findOpErr } = await serviceClient
    .from('machine_operations')
    .select('id')
    .eq('department_id', row.departmentId)
    .eq('machine_id', row.machineId)
    .eq('shift_date', row.shiftDate)
    .eq('shift_type', row.shiftType)
    .order('created_at', { ascending: false })
    .limit(1);

  if (findOpErr) {
    throw new DatabaseError('Failed to query machine operation', {
      operation: 'select',
      table: 'machine_operations',
      context: { error: findOpErr.message },
    });
  }

  let machineOperationId = existingOps?.[0]?.id ?? null;

  if (machineOperationId) {
    const { error: updateOpErr } = await serviceClient
      .from('machine_operations')
      .update({
        start_smu: row.startSmr,
        end_smu: row.stopSmr,
        operator_id: row.operatorId ?? null,
      })
      .eq('id', machineOperationId);

    if (updateOpErr) {
      throw new DatabaseError('Failed to update machine operation SMR', {
        operation: 'update',
        table: 'machine_operations',
        context: { error: updateOpErr.message },
      });
    }
  } else {
    const defaultStartTime = row.shiftType === 'day' ? '06:00' : '18:00';
    const { data: insertedOp, error: insertOpErr } = await serviceClient
      .from('machine_operations')
      .insert({
        department_id: row.departmentId,
        machine_id: row.machineId,
        operator_id: row.operatorId ?? null,
        site_id: row.siteId ?? null,
        shift_date: row.shiftDate,
        shift_type: row.shiftType,
        start_time: defaultStartTime,
        start_smu: row.startSmr,
        end_smu: row.stopSmr,
      })
      .select('id')
      .single();

    if (insertOpErr || !insertedOp) {
      throw new DatabaseError('Failed to create machine operation record', {
        operation: 'insert',
        table: 'machine_operations',
        context: { error: insertOpErr?.message ?? 'Unknown error' },
      });
    }
    machineOperationId = insertedOp.id;
  }

  // 2. Ensure all 12 delay_categories exist and map by categoryName
  const categoryNames = OVERVIEW_DELAY_COLUMNS.map((c) => c.categoryName);
  const { data: existingCategories } = await serviceClient
    .from('delay_categories')
    .select('id, name')
    .in('name', categoryNames);

  const categoryIdByName = new Map<string, string>();
  for (const cat of existingCategories ?? []) {
    categoryIdByName.set(cat.name, cat.id);
  }

  const missingCols = OVERVIEW_DELAY_COLUMNS.filter((c) => !categoryIdByName.has(c.categoryName));
  if (missingCols.length > 0) {
    const { data: seededCats } = await serviceClient
      .from('delay_categories')
      .upsert(
        missingCols.map((c, i) => ({
          name: c.categoryName,
          color: c.isDowntime ? '#ef4444' : '#0ea5e9',
          icon: 'Clock',
          sort_order: 30 + i,
          description: c.label,
          is_active: true,
        })),
        { onConflict: 'name' }
      )
      .select('id, name');

    for (const cat of seededCats ?? []) {
      categoryIdByName.set(cat.name, cat.id);
    }
  }

  // 3. Replace existing delay_entries for this machineOperationId and insert committed entries for > 0 delays
  await serviceClient.from('delay_entries').delete().eq('machine_operation_id', machineOperationId);

  const shiftStartHour = row.shiftType === 'day' ? '06:00:00' : '18:00:00';
  const baseStartIso = `${row.shiftDate}T${shiftStartHour}+02:00`;
  const trimmedComment = row.comment.trim();
  const committedById = principal.employee?.id ?? null;

  const entriesToInsert = OVERVIEW_DELAY_COLUMNS.map((col) => {
    const duration = Number(row.delays[col.key] ?? 0);
    const catId = categoryIdByName.get(col.categoryName);
    if (!catId || duration <= 0) return null;
    const startMs = new Date(baseStartIso).getTime();
    const endIso = new Date(startMs + Math.round(duration * 3_600_000)).toISOString();
    return {
      machine_operation_id: machineOperationId,
      delay_category_id: catId,
      delay_start_time: new Date(startMs).toISOString(),
      delay_end_time: endIso,
      is_manual_override: true,
      manual_duration_hours: duration,
      description: trimmedComment,
      status: 'committed' as const,
      committed_at: new Date().toISOString(),
      committed_by: committedById,
      created_by: committedById,
    };
  }).filter((item): item is NonNullable<typeof item> => item !== null);

  if (entriesToInsert.length > 0) {
    const { error: delayInsertErr } = await serviceClient
      .from('delay_entries')
      .insert(entriesToInsert);

    if (delayInsertErr) {
      throw new DatabaseError('Failed to save machine delay entries', {
        operation: 'insert',
        table: 'delay_entries',
        context: { error: delayInsertErr.message },
      });
    }
  }

  // 4. Breakdown Carry-Over Persistence: if machine ends shift on breakdown (or has breakdown hours),
  // persist an active breakdown record so it carries over as-is to the new shift until booked out.
  const fleetKeys = [row.serialNumber, row.machineName, row.machineId].filter((v): v is string =>
    Boolean(v?.trim())
  );

  if (row.endsOnBreakdown || row.delays.breakdown > 0) {
    const { data: activeBds } = await serviceClient
      .from('breakdowns')
      .select('id, reason')
      .in('fleet_id', fleetKeys)
      .eq('status', 'active')
      .is('deleted_at', null)
      .limit(1);

    const breakdownReason = `${trimmedComment || 'Machine on breakdown'} [Shift Delay: ${row.delays.breakdown.toFixed(1)}h]`;

    if (activeBds && activeBds.length > 0) {
      await serviceClient
        .from('breakdowns')
        .update({
          reason: breakdownReason,
        })
        .eq('id', activeBds[0]!.id);
    } else if (row.endsOnBreakdown) {
      const fleetIdentifier = row.serialNumber || row.machineName;
      await serviceClient.from('breakdowns').insert({
        department_id: row.departmentId,
        fleet_id: fleetIdentifier,
        machine_name: row.machineName,
        machine_type: row.machineType,
        reason: breakdownReason,
        date_in: row.shiftDate,
        time_in: new Date().toTimeString().slice(0, 8),
        status: 'active',
        shared_with_departments: ['control-room', 'engineering'],
      });
    }
  }

  // 5. Synchronize comment to engineering_notes when a non-standard delay or breakdown is logged
  if (trimmedComment.length > 0 && commentCheck.hasNonStandardDelay) {
    await serviceClient.from('engineering_notes').insert({
      department_id: row.departmentId,
      note_date: row.shiftDate,
      shift_type: row.shiftType,
      issue_type: row.delays.breakdown > 0 ? 'mechanical' : 'other',
      severity: row.endsOnBreakdown || row.delays.breakdown > 0 ? 'high' : 'low',
      machine_id: row.machineId,
      description: `[Overview Ledger · ${row.machineName}] ${trimmedComment}`,
      action_taken: `Delays: ${commentCheck.activeDelayLabels.join(', ')}`,
      requires_follow_up: row.endsOnBreakdown,
      status: 'open',
    });
  }

  await cacheInvalidateTags([
    'table:machine_operations',
    'table:delay_entries',
    'table:breakdowns',
    'table:engineering_notes',
  ]);
  revalidatePath('/control-room/engineering-notes');
  revalidatePath('/control-room/machine-operations');
  revalidatePath('/control-room');

  return {
    success: true,
    machineOperationId,
  };
}

export async function bookOutMachineCarryOverBreakdown(payload: unknown) {
  const supabase = await createServerSupabaseClient();
  const principal = await getAuthenticatedEmployee(supabase);
  if (!principal) {
    throw new AuthError('Unauthorized', {
      context: { action: 'bookOutMachineCarryOverBreakdown' },
    });
  }

  const parsed = bookOutCarryOverBreakdownSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ValidationError('Invalid breakdown book-out payload', {
      context: { issues: parsed.error.issues },
    });
  }

  const { machineId, machineName, serialNumber, shiftDate, repairNotes } = parsed.data;
  const fleetKeys = [serialNumber, machineName, machineId].filter((v): v is string =>
    Boolean(v?.trim())
  );

  const serviceClient = createServiceRoleClient();
  const nowTime = new Date().toTimeString().slice(0, 8);

  const { error } = await serviceClient
    .from('breakdowns')
    .update({
      status: 'completed',
      date_out: shiftDate,
      time_out: nowTime,
      repair_notes: repairNotes?.trim() || 'Booked out from Control Room Engineering Overview',
    })
    .in('fleet_id', fleetKeys)
    .eq('status', 'active')
    .is('deleted_at', null);

  if (error) {
    throw new DatabaseError('Failed to book out breakdown', {
      operation: 'update',
      table: 'breakdowns',
      context: { error: error.message },
    });
  }

  await cacheInvalidateTags(['table:breakdowns', 'table:engineering_notes']);
  revalidatePath('/control-room/engineering-notes');
  revalidatePath('/control-room/machine-operations');
  revalidatePath('/control-room');

  return { success: true };
}
