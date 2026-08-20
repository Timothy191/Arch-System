"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@repo/supabase/server";
import { drillOperationSchema, type DrillOperationInput } from "@repo/contract";

export interface ActionResult<T = unknown> {
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
      .upsert(upsertData as any, {
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
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Unexpected server error during drill operation upsert",
    };
  }
}

// AGENT-TRACE: Server Action to fetch drill operations for a specific date and department
export async function getDrillOperationsAction({
  departmentId,
  date,
}: {
  departmentId: string;
  date: string;
}): Promise<ActionResult> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    const { data, error } = await supabase
      .from("drill_operations")
      .select("*")
      .eq("department_id", departmentId)
      .eq("operation_date", date)
      .order("operation_date", { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to fetch drill operations" };
  }
}

// AGENT-TRACE: Server Action to execute archival of drill operations older than 30 days
export async function archiveStaleDrillOperationsAction(): Promise<ActionResult> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    const { error } = await supabase.rpc("archive_old_drill_operations");

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/drilling");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Archival operation failed" };
  }
}
