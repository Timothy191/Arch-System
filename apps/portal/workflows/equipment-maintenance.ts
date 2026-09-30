import { createServiceRoleClient } from '@repo/supabase/service-role';
import { FatalError, sleep } from 'workflow';
import { logError } from '@/lib/errors/error-logger';

// Step 1: Notify engineering
async function notifyEngineering(equipmentId: string, description: string) {
  'use step';
  console.log(
    `[Alert] Equipment ${equipmentId} reported broken: ${description}. Notifying Engineering...`
  );

  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from('app_notifications')
    .insert({
      title: 'Equipment Breakdown',
      message: `Equipment ${equipmentId} reported broken: ${description}`,
      priority: 'high',
      department: 'engineering',
    })
    .catch(() => ({ error: null })); // Fire and forget fallback if table differs

  if (error) {
    logError(error, { context: 'notify_engineering_workflow' });
  }

  return { notifiedAt: new Date().toISOString() };
}

// Step 2: Escalate to supervisor
async function escalateToSupervisor(equipmentId: string) {
  'use step';
  console.log(
    `[Escalation] Equipment ${equipmentId} is still down after 24 hours. Escalating to Supervisor...`
  );

  const supabase = createServiceRoleClient();
  await supabase
    .from('app_notifications')
    .insert({
      title: 'Equipment Escalation',
      message: `Equipment ${equipmentId} has been down for over 24 hours without resolution.`,
      priority: 'critical',
      department: 'management',
    })
    .catch(() => ({}));

  return { escalatedAt: new Date().toISOString() };
}

// Step 3: Check equipment status
async function checkEquipmentStatus(equipmentId: string) {
  'use step';
  const supabase = createServiceRoleClient();
  const { data: fleet, error } = await supabase
    .from('fleet')
    .select('status')
    .eq('id', equipmentId)
    .single();

  if (error) {
    throw new FatalError(`Failed to check equipment status: ${error.message}`);
  }

  return { status: fleet?.status || 'unknown' };
}

export async function handleEquipmentBreakdown(equipmentId: string, description: string) {
  'use workflow';

  // 1. Initial notification
  await notifyEngineering(equipmentId, description);

  // 2. Wait for 24 hours to give them time to fix it
  await sleep('24h');

  // 3. Check if it's still broken
  const statusCheck = await checkEquipmentStatus(equipmentId);

  // 4. If still broken, escalate
  if (statusCheck.status === 'breakdown' || statusCheck.status === 'maintenance') {
    await escalateToSupervisor(equipmentId);
  }

  return { status: 'completed', equipmentId };
}
