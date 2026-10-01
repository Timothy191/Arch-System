'use server';

import { updateMachineSiteSchema } from '@repo/contract/schemas/form.schema';
import { getAuthenticatedEmployee } from '@repo/supabase';
import { createServiceRoleClient } from '@repo/supabase/service-role';

export async function updateMachineSite(machineId: string, siteId: string | null) {
  // AGENT-TRACE: Validate input parameters with @repo/contract schema
  const validated = updateMachineSiteSchema.parse({ machineId, siteId });

  // Always validate the user at the top
  const principal = await getAuthenticatedEmployee();
  if (!principal?.employee) {
    throw new Error('Unauthorized');
  }

  // Update machine's site_id using service role client to bypass admin-only update RLS
  const serviceClient = createServiceRoleClient();
  const { error } = await serviceClient
    .from('machines')
    .update({ site_id: validated.siteId })
    .eq('id', validated.machineId);

  if (error) {
    throw error;
  }

  return { success: true };
}
