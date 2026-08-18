"use server";

import { createServerSupabaseClient } from "@repo/supabase/server";
import { createServiceRoleClient } from "@repo/supabase/service-role";
import { updateMachineSiteSchema } from "@repo/contract";

export async function updateMachineSite(machineId: string, siteId: string | null) {
  // AGENT-TRACE: Validate input parameters with @repo/contract schema
  const validated = updateMachineSiteSchema.parse({ machineId, siteId });

  // Always validate the user at the top
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  // Validate that the employee exists and has a role
  const { data: employee } = await supabase
    .from("employees")
    .select("role, department_id")
    .eq("auth_id", user.id)
    .single();

  if (!employee) {
    throw new Error("Unauthorized");
  }

  // Update machine's site_id using service role client to bypass admin-only update RLS
  const serviceClient = createServiceRoleClient();
  const { error } = await serviceClient
    .from("machines")
    .update({ site_id: validated.siteId })
    .eq("id", validated.machineId);

  if (error) {
    throw error;
  }

  return { success: true };
}
