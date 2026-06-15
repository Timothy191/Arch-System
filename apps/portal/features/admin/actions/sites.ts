"use server";

import { cacheInvalidateTags } from "@repo/redis";
import { createServerSupabaseClient } from "@repo/supabase/server";
import { revalidatePath } from "next/cache";

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

export async function adminAddSite(data: {
  name: string;
  site_code: string;
  active?: boolean;
}) {
  const auth = await assertAdmin();
  if ("error" in auth) return { error: auth.error };

  const { supabase } = auth;

  const name = data.name.trim();
  const siteCode = data.site_code.trim().toUpperCase();
  if (!name) return { error: "Site name is required." };
  if (!siteCode) return { error: "Site code is required." };

  const { error } = await supabase.from("sites").insert({
    name,
    site_code: siteCode,
    active: data.active ?? true,
  });

  if (error) return { error: "Failed to add site" };

  await cacheInvalidateTags(["table:sites"]);
  revalidatePath("/admin");
  return { success: true };
}

export async function adminUpdateSite(
  id: string,
  data: {
    name?: string;
    site_code?: string;
    active?: boolean;
  },
) {
  const auth = await assertAdmin();
  if ("error" in auth) return { error: auth.error };

  const { supabase } = auth;

  const name = data.name?.trim();
  const siteCode = data.site_code?.trim().toUpperCase();
  if (name !== undefined && !name)
    return { error: "Site name cannot be empty." };
  if (siteCode !== undefined && !siteCode)
    return { error: "Site code cannot be empty." };

  const { error } = await supabase
    .from("sites")
    .update({
      ...data,
      name,
      site_code: siteCode,
    })
    .eq("id", id);

  if (error) return { error: "Failed to update site" };

  await cacheInvalidateTags(["table:sites"]);
  revalidatePath("/admin");
  return { success: true };
}
