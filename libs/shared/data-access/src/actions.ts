"use server";

import { createServerSupabaseClient } from "@repo/supabase/server";
import { cacheInvalidateTags } from "@repo/redis";
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
    try {
      const nextCache = require("next/cache");
      if (typeof nextCache.updateTag === "function") {
        nextCache.updateTag(tag);
      } else {
        (revalidateTag as any)(tag, "max");
      }
    } catch {
      // Outside request context
    }
  }

  try {
    await cacheInvalidateTags(tags);
  } catch {
    // Gracefully handle Redis offline
  }
  
  return { success: true };
}
