"use server";

import { createServerSupabaseClient } from "@repo/supabase/server";
import { AuthError, ForbiddenError, DatabaseError } from "@/lib/errors/error-classes";
import { revalidatePath } from "next/cache";

async function assertAdminRole() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new AuthError("Unauthorized");

  const { data: employee } = await supabase
    .from("employees")
    .select("role")
    .eq("auth_id", user.id)
    .single();

  if (!employee || employee.role !== "admin") {
    throw new ForbiddenError("Forbidden: admin role required");
  }

  return { supabase, user, employee };
}

export async function uploadCardTemplate(formData: FormData) {
  const { supabase } = await assertAdminRole();

  const name = formData.get("name") as string;
  const file = formData.get("background") as File;
  const isDefault = formData.get("isDefault") === "true";

  if (!name || !file) {
    throw new Error("Name and background file are required");
  }

  // Upload the file to storage bucket
  const fileExt = file.name.split(".").pop();
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from("card-templates")
    .upload(fileName, file);

  if (uploadError) {
    throw new Error(`Failed to upload background: ${uploadError.message}`);
  }

  const { data: publicUrlData } = supabase.storage.from("card-templates").getPublicUrl(fileName);

  const backgroundUrl = publicUrlData.publicUrl;

  if (isDefault) {
    // Unset current default
    await supabase
      .from("card_templates")
      .update({ is_default: false })
      .neq("id", "00000000-0000-0000-0000-000000000000"); // Match all
  }

  const { error: dbError } = await supabase.from("card_templates").insert({
    name,
    background: backgroundUrl,
    is_default: isDefault,
  });

  if (dbError) {
    throw new DatabaseError("Failed to save card template", { cause: dbError });
  }

  revalidatePath("/admin");
  revalidatePath("/access-card-actions/card-actions");
}
