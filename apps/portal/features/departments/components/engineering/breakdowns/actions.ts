"use server";

import { cacheInvalidateTags } from "@repo/redis";
import { createServerSupabaseClient } from "@repo/supabase/server";
import { revalidatePath } from "next/cache";
import { logAuditEvent } from "@/lib/audit";
import { AuthError, DatabaseError } from "@/lib/errors/error-classes";
import { logError } from "@/lib/errors/error-logger";
import {
  createBreakdownSchema,
  bookOutSchema,
  directCheckoutSchema,
} from "@repo/contract/schemas/form.schema";
import type { CreateBreakdownInput, BookOutInput, DirectCheckoutInput } from "./types";

const BookOutSchema = bookOutSchema;
const DirectCheckoutSchema = directCheckoutSchema;
export async function createBreakdown(departmentId: string, rawInput: CreateBreakdownInput) {
  const input = createBreakdownSchema.parse(rawInput);
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new AuthError("Unauthorized", {
      context: { action: "createBreakdown" },
    });
  }

  const { error } = await supabase.from("breakdowns").insert({
    department_id: departmentId,
    fleet_id: input.fleet_id.toUpperCase(),
    machine_name: input.machine_name || input.fleet_id.toUpperCase(),
    machine_type: input.machine_type,
    date_in: input.date_in,
    time_in: input.time_in,
    reason: input.reason,
    status: "active",
    missing_book_in: false,
    created_by: user.id,
  });

  if (error) {
    throw new DatabaseError("Failed to create breakdown", {
      operation: "insert",
      table: "breakdowns",
      context: { error: error.message },
    });
  }

  await logAuditEvent({
    action: "insert",
    tableName: "breakdowns",
    newData: { fleet_id: input.fleet_id.toUpperCase(), reason: input.reason },
    departmentId,
  });

  await cacheInvalidateTags(["table:breakdowns"]);
  revalidatePath("/engineering/breakdowns");
  revalidatePath("/control-room/engineering-notes");
  return { success: true };
}

export async function bookOutBreakdown(breakdownId: string, rawInput: BookOutInput) {
  const input = BookOutSchema.parse(rawInput);
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    logError(new Error("Unauthorized"), { context: "bookOutBreakdown" });
    throw new AuthError("Unauthorized", {
      context: { action: "bookOutBreakdown" },
    });
  }

  const { data: before } = await supabase
    .from("breakdowns")
    .select("status, date_out, time_out, repair_notes")
    .eq("id", breakdownId)
    .single();

  const { error } = await supabase
    .from("breakdowns")
    .update({
      date_out: input.date_out,
      time_out: input.time_out,
      repair_notes: input.repair_notes || null,
      status: "completed",
      completed_by: user.id,
    })
    .eq("id", breakdownId);

  if (error) {
    throw new DatabaseError("Failed to book out breakdown", {
      operation: "update",
      table: "breakdowns",
      context: { error: error.message },
    });
  }

  await logAuditEvent({
    action: "update",
    tableName: "breakdowns",
    recordId: breakdownId,
    oldData: before ?? undefined,
    newData: {
      status: "completed",
      date_out: input.date_out,
      time_out: input.time_out,
      repair_notes: input.repair_notes || null,
    },
  });

  await cacheInvalidateTags(["table:breakdowns"]);
  revalidatePath("/engineering/breakdowns");
  revalidatePath("/control-room/engineering-notes");
  return { success: true };
}

export async function directCheckout(departmentId: string, rawInput: DirectCheckoutInput) {
  const input = DirectCheckoutSchema.parse(rawInput);
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    logError(new Error("Unauthorized"), { context: "directCheckout" });
    throw new AuthError("Unauthorized", {
      context: { action: "directCheckout" },
    });
  }

  const { error } = await supabase.from("breakdowns").insert({
    department_id: departmentId,
    fleet_id: input.fleet_id.toUpperCase(),
    machine_type: input.machine_type,
    date_in: input.date_out,
    time_in: input.time_out,
    date_out: input.date_out,
    time_out: input.time_out,
    reason: input.reason,
    repair_notes: input.repair_notes || null,
    status: "completed",
    missing_book_in: true,
    created_by: user.id,
    completed_by: user.id,
  });

  if (error) {
    throw new DatabaseError("Failed to create breakdown (direct checkout)", {
      operation: "insert",
      table: "breakdowns",
      context: { error: error.message },
    });
  }

  await logAuditEvent({
    action: "insert",
    tableName: "breakdowns",
    newData: {
      fleet_id: input.fleet_id.toUpperCase(),
      reason: input.reason,
      status: "completed",
    },
    departmentId,
  });

  await cacheInvalidateTags(["table:breakdowns"]);
  revalidatePath("/engineering/breakdowns");
  revalidatePath("/control-room/engineering-notes");
  return { success: true };
}

export async function softDeleteBreakdown(breakdownId: string) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    logError(new Error("Unauthorized"), { context: "softDeleteBreakdown" });
    throw new AuthError("Unauthorized", {
      context: { action: "softDeleteBreakdown" },
    });
  }

  const { data: before } = await supabase
    .from("breakdowns")
    .select("status, fleet_id, deleted_at")
    .eq("id", breakdownId)
    .single();

  const { error } = await supabase
    .from("breakdowns")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", breakdownId);

  if (error) {
    throw new DatabaseError("Failed to delete breakdown", {
      operation: "update",
      table: "breakdowns",
      context: { error: error.message },
    });
  }

  await logAuditEvent({
    action: "delete",
    tableName: "breakdowns",
    recordId: breakdownId,
    oldData: before ?? undefined,
    newData: { deleted_at: new Date().toISOString() },
  });

  await cacheInvalidateTags(["table:breakdowns"]);
  revalidatePath("/engineering/breakdowns");
  revalidatePath("/control-room/engineering-notes");
  return { success: true };
}
