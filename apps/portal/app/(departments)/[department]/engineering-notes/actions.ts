'use server';

import { AuthError, DatabaseError, ValidationError } from '@repo/errors';
import { cacheInvalidateTags } from '@repo/redis';
import { getAuthenticatedEmployee } from '@repo/supabase';
import { createServerSupabaseClient } from '@repo/supabase/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

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
