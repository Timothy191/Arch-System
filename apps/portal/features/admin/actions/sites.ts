"use server";

import { cacheInvalidateTags } from "@repo/redis";
import { createServerSupabaseClient } from "@repo/supabase/server";
import { revalidatePath } from "next/cache";
import { adminAddSiteSchema, adminUpdateSiteSchema } from "@repo/contract/schemas/admin.schema";

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

export async function adminAddSite(rawInput: {
  name: string;
  site_code: string;
  active?: boolean;
}) {
  const parseResult = adminAddSiteSchema.safeParse(rawInput);
  if (!parseResult.success) {
    return { error: parseResult.error.issues[0]?.message || "Invalid site data" };
  }
  const data = parseResult.data;

  const auth = await assertAdmin();
  if ("error" in auth) return { error: auth.error };

  const { supabase } = auth;

  const name = data.name.trim();
  const siteCode = data.site_code.trim().toUpperCase();

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
  rawInput: {
    name?: string;
    site_code?: string;
    active?: boolean;
  },
) {
  const parseResult = adminUpdateSiteSchema.safeParse(rawInput);
  if (!parseResult.success) {
    return { error: parseResult.error.issues[0]?.message || "Invalid site data" };
  }
  const data = parseResult.data;

  const auth = await assertAdmin();
  if ("error" in auth) return { error: auth.error };

  const { supabase } = auth;

  const name = data.name?.trim();
  const siteCode = data.site_code?.trim().toUpperCase();
  if (name !== undefined && !name) return { error: "Site name cannot be empty." };
  if (siteCode !== undefined && !siteCode) return { error: "Site code cannot be empty." };

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
