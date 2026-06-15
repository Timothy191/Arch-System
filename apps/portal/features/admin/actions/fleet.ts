"use server";

import { cacheInvalidateTags } from "@repo/redis";
import { createServerSupabaseClient } from "@repo/supabase/server";
import { revalidatePath, revalidateTag } from "next/cache";

async function assertAdmin() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized", status: 401 as const };

  const { data: employee } = await supabase
    .from("employees")
    .select("id, role")
    .eq("auth_id", user.id)
    .single();

  if (!employee || employee.role !== "admin") {
    return { error: "Forbidden: admin role required", status: 403 as const };
  }

  return { supabase, employee };
}

export async function adminAddMachine(data: {
  name: string;
  machine_type: string;
  serial_number?: string;
  bin_factor?: number | null;
  department_id: string;
  site_id?: string | null;
  active?: boolean;
  report_exempt?: boolean;
}) {
  const auth = await assertAdmin();
  if ("error" in auth) return { error: auth.error };

  const { supabase } = auth;

  if (!data.name?.trim()) return { error: "Machine name is required." };
  if (!data.machine_type?.trim()) return { error: "Machine type is required." };
  if (!data.department_id) return { error: "Department is required." };

  const { error } = await supabase.from("machines").insert({
    name: data.name.trim(),
    machine_type: data.machine_type.trim(),
    serial_number: data.serial_number?.trim() || null,
    bin_factor: data.bin_factor ?? null,
    department_id: data.department_id,
    site_id: data.site_id || null,
    active: data.active ?? true,
    report_exempt: data.report_exempt ?? false,
  });

  if (error) return { error: "Failed to add machine" };

  await cacheInvalidateTags(["table:fleet", "table:equipment"]);
  try {
    revalidateTag("table:machines", "max");
  } catch {
    // Ignore if not in request context (e.g., during tests)
  }
  revalidatePath("/admin");
  return { success: true };
}

export async function adminUpdateMachine(
  id: string,
  data: {
    name?: string;
    machine_type?: string;
    serial_number?: string | null;
    bin_factor?: number | null;
    department_id?: string;
    site_id?: string | null;
    active?: boolean;
    report_exempt?: boolean;
  },
) {
  const auth = await assertAdmin();
  if ("error" in auth) return { error: auth.error };

  const { supabase } = auth;

  const name = data.name?.trim();
  const machineType = data.machine_type?.trim();
  if (name !== undefined && !name)
    return { error: "Machine name cannot be empty." };
  if (machineType !== undefined && !machineType)
    return { error: "Machine type cannot be empty." };

  const { error } = await supabase
    .from("machines")
    .update({
      ...data,
      name,
      machine_type: machineType,
      serial_number: data.serial_number?.trim() || null,
    })
    .eq("id", id);

  if (error) return { error: "Failed to update machine" };

  await cacheInvalidateTags(["table:fleet", "table:equipment"]);
  try {
    revalidateTag("table:machines", "max");
  } catch {
    // Ignore if not in request context (e.g., during tests)
  }
  revalidatePath("/admin");
  return { success: true };
}
