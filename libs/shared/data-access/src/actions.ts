"use server";

import { createServerSupabaseClient } from "@repo/supabase/server";
import { revalidateTag } from "next/cache";

export async function revalidateRSC(tags: string[]) {
  // Always validate the user at the top
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  for (const tag of tags) {
    revalidateTag(tag, "max");
  }
  return { success: true };
}
