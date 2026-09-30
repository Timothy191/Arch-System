import { FatalError, sleep } from 'workflow';

// Step 1: Notify engineering
async function notifyEngineering(equipmentId: string, description: string) {
  'use step';
  console.log(
    `[Alert] Equipment ${equipmentId} reported broken: ${description}. Notifying Engineering...`
  );
  // In a real system, you would integrate Resend or SMS here
  return { notifiedAt: new Date().toISOString() };
}

// Step 2: Escalate to supervisor
async function escalateToSupervisor(equipmentId: string) {
  'use step';
  console.log(
    `[Escalation] Equipment ${equipmentId} is still down after 24 hours. Escalating to Supervisor...`
  );
  // Real system: send high-priority alert
  return { escalatedAt: new Date().toISOString() };
}

// Step 3: Check equipment status (simulated check)
async function checkEquipmentStatus(equipmentId: string) {
  'use step';
  // In a real system, query the database or SCADA for equipment status
  // For now, we assume it's still down for the sake of the workflow
  return { status: 'down' };
}

export async function handleEquipmentBreakdown(equipmentId: string, description: string) {
  'use workflow';

  // 1. Initial notification
  await notifyEngineering(equipmentId, description);

  // 2. Wait for 24 hours to give them time to fix it
  // Using a short duration in dev, but standard is "24h"
  await sleep('24h');

  // 3. Check if it's still broken
  const statusCheck = await checkEquipmentStatus(equipmentId);

  // 4. If still broken, escalate
  if (statusCheck.status === 'down') {
    await escalateToSupervisor(equipmentId);
  }

  console.log(`[Workflow Complete] Breakdown process for ${equipmentId} finished.`);
  return { status: 'completed', equipmentId };
}
