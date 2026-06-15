"use server";

import { cacheInvalidateTags } from "@repo/redis";
import { createServerSupabaseClient } from "@repo/supabase/server";
import { revalidateTag } from "next/cache";
import { AuthError } from "@/lib/errors/error-classes";

type AuditAction = "insert" | "update" | "delete";

interface AuditLogInput {
  action: AuditAction;
  tableName: string;
  recordId?: string;
  oldData?: Record<string, unknown>;
  newData?: Record<string, unknown>;
  departmentId?: string;
}

export async function logAuditEvent(input: AuditLogInput) {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new AuthError("Unauthorized: valid session required", {
      context: { operation: "logAuditEvent" },
    });
  }

  const { data: employee } = await supabase
    .from("employees")
    .select("id")
    .eq("auth_id", user.id)
    .maybeSingle();

  await supabase.from("audit_logs").insert({
    action: input.action,
    table_name: input.tableName,
    record_id: input.recordId,
    old_data: input.oldData,
    new_data: input.newData,
    performed_by: employee?.id ?? null,
    department_id: input.departmentId ?? null,
  });

  if (input.tableName) {
    cacheInvalidateTags([`table:${input.tableName}`]).catch(() => {});
    try {
      revalidateTag(`table:${input.tableName}`, "max");
    } catch {
      // Ignore if not in rendering/action context
    }
  }
}
