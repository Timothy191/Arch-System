"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@repo/supabase/server";
import { drillOperationSchema } from "@repo/contract/schemas/drill.schema";
import type { DrillOperationInput } from "@repo/contract/schemas/drill.schema";

interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// AGENT-TRACE: Server Action to validate and upsert drill operations daily shift log
export async function upsertDrillOperationAction(
  rawInput: DrillOperationInput,
): Promise<ActionResult> {
  try {
    const parseResult = drillOperationSchema.safeParse(rawInput);
    if (!parseResult.success) {
      const errorMsg = parseResult.error.issues
        ? parseResult.error.issues.map((e: { message: string }) => e.message).join(", ")
        : parseResult.error.message || "Invalid payload";
      return { success: false, error: `Validation error: ${errorMsg}` };
    }

    const payload = parseResult.data;
    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Unauthorized access" };
    }

    const { data: employee } = await supabase
      .from("employees")
      .select("department_id, is_admin")
      .eq("id", user.id)
      .maybeSingle();

    // Verify employee access if not global admin
    if (employee && !employee.is_admin && employee.department_id !== payload.department_id) {
      return { success: false, error: "Forbidden: Department access denied" };
    }

    const upsertData = {
      ...payload,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
      ...(payload.id ? {} : { created_by: user.id }),
    };

    const { data, error } = await supabase
      .from("drill_operations")
      .upsert(upsertData as unknown as Record<string, unknown>, {
        onConflict: "machine_id,operation_date,shift_type",
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message || "Failed to save drill operation" };
    }

    revalidatePath("/drilling");
    revalidatePath("/drilling/drilling-operations");

    return { success: true, data };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unexpected server error during drill operation upsert";
    return {
      success: false,
      error: message,
    };
  }
}
