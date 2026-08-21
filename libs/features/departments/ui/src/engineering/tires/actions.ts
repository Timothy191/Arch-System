"use server";

import { cacheInvalidateTags } from "@repo/redis";
import { createServerSupabaseClient } from "@repo/supabase/server";
import { revalidatePath } from "next/cache";
import { logAuditEvent } from "@repo/shared/data-access";
import { AuthError, DatabaseError, ValidationError } from "@repo/errors";
import { serverLogger } from "@repo/logger";
import {
  logTireInspectionSchema,
  createTireSchema,
  replaceTireSchema,
} from "@repo/contract/schemas/tire-management.schema";
import type {
  LogTireInspectionInput,
  CreateTireInput,
  ReplaceTireInput,
} from "@repo/contract/types/tire-management.types";

export async function logTireInspection(input: LogTireInspectionInput) {
  const parsed = logTireInspectionSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError("Invalid inspection payload", {
      details: parsed.error.issues,
    });
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    serverLogger.error({ err: new Error("Unauthorized"), context: "logTireInspection" });
    throw new AuthError("Unauthorized", {
      context: { action: "logTireInspection" },
    });
  }

  const { data, error } = await supabase
    .from("tire_inspections")
    .insert({
      tire_id: parsed.data.tire_id,
      inspection_date: parsed.data.inspection_date,
      tread_depth_mm: parsed.data.tread_depth_mm,
      pressure_psi: parsed.data.pressure_psi,
      condition_status: parsed.data.condition_status,
      notes: parsed.data.notes || null,
    })
    .select()
    .single();

  if (error) {
    serverLogger.error({
      err: new Error(error.message),
      context: "logTireInspection",
      details: error,
    });
    throw new DatabaseError("Failed to record tire inspection", {
      operation: "insert",
      table: "tire_inspections",
      context: { error: error.message },
    });
  }

  await Promise.all([
    logAuditEvent({
      action: "insert",
      tableName: "tire_inspections",
      recordId: data?.id,
      newData: parsed.data,
    }),
    cacheInvalidateTags(["table:tire_inspections", "table:tires"]),
  ]);

  revalidatePath("/engineering/tire-management");
  revalidatePath("/engineering");
  return { success: true, data };
}

export async function installTire(input: CreateTireInput) {
  const parsed = createTireSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError("Invalid tire registration payload", {
      details: parsed.error.issues,
    });
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    serverLogger.error({ err: new Error("Unauthorized"), context: "installTire" });
    throw new AuthError("Unauthorized", {
      context: { action: "installTire" },
    });
  }

  const { data, error } = await supabase
    .from("tires")
    .insert({
      serial_number: parsed.data.serial_number.toUpperCase().trim(),
      brand: parsed.data.brand.trim(),
      size: parsed.data.size.trim(),
      machine_id: parsed.data.machine_id || null,
      position: parsed.data.position,
      status: parsed.data.status,
      installed_at: parsed.data.installed_at,
      installed_hours: parsed.data.installed_hours,
    })
    .select()
    .single();

  if (error) {
    serverLogger.error({
      err: new Error(error.message),
      context: "installTire",
      details: error,
    });
    throw new DatabaseError("Failed to register tire", {
      operation: "insert",
      table: "tires",
      context: { error: error.message },
    });
  }

  await Promise.all([
    logAuditEvent({
      action: "insert",
      tableName: "tires",
      recordId: data?.id,
      newData: parsed.data,
    }),
    cacheInvalidateTags(["table:tires"]),
  ]);

  revalidatePath("/engineering/tire-management");
  revalidatePath("/engineering");
  return { success: true, data };
}

export async function replaceTire(input: ReplaceTireInput) {
  const parsed = replaceTireSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError("Invalid tire replacement payload", {
      details: parsed.error.issues,
    });
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    serverLogger.error({ err: new Error("Unauthorized"), context: "replaceTire" });
    throw new AuthError("Unauthorized", {
      context: { action: "replaceTire" },
    });
  }

  // 1. Decommission old tire
  const { error: scrapError } = await supabase
    .from("tires")
    .update({
      status: "scrapped",
      removed_at: parsed.data.removed_at,
      removed_hours: parsed.data.removed_hours,
      scrapped_reason: parsed.data.scrapped_reason,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.old_tire_id);

  if (scrapError) {
    throw new DatabaseError("Failed to decommission old tire", {
      operation: "update",
      table: "tires",
      context: { error: scrapError.message },
    });
  }

  let newTireData = null;
  // 2. Optionally install new replacement tire
  if (parsed.data.new_tire) {
    const { data: created, error: createError } = await supabase
      .from("tires")
      .insert({
        serial_number: parsed.data.new_tire.serial_number.toUpperCase().trim(),
        brand: parsed.data.new_tire.brand.trim(),
        size: parsed.data.new_tire.size.trim(),
        machine_id: parsed.data.new_tire.machine_id || null,
        position: parsed.data.new_tire.position,
        status: parsed.data.new_tire.status || "installed",
        installed_at: parsed.data.new_tire.installed_at,
        installed_hours: parsed.data.new_tire.installed_hours || 0,
      })
      .select()
      .single();

    if (createError) {
      throw new DatabaseError("Failed to install replacement tire", {
        operation: "insert",
        table: "tires",
        context: { error: createError.message },
      });
    }
    newTireData = created;
  }

  await Promise.all([
    logAuditEvent({
      action: "update",
      tableName: "tires",
      recordId: parsed.data.old_tire_id,
      newData: {
        status: "scrapped",
        scrapped_reason: parsed.data.scrapped_reason,
        new_tire_id: newTireData?.id,
      },
    }),
    cacheInvalidateTags(["table:tires"]),
  ]);

  revalidatePath("/engineering/tire-management");
  revalidatePath("/engineering");
  return { success: true, newTire: newTireData };
}

export async function getTireWearHistory(tireId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("tire_inspections")
    .select(
      "id, inspection_date, tread_depth_mm, pressure_psi, condition_status, notes, created_at",
    )
    .eq("tire_id", tireId)
    .order("inspection_date", { ascending: true });

  if (error) {
    throw new DatabaseError("Failed to fetch tire inspections", {
      operation: "select",
      table: "tire_inspections",
      context: { error: error.message },
    });
  }

  return data || [];
}
