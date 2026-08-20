"use server";

import { cacheGet, cacheSet } from "@repo/redis/cache";
import { createServerSupabaseClient } from "@repo/supabase/server";
import { DEPARTMENTS } from "@repo/departments/data-access";

/**
 * Pre-warm department UUID cache for all departments.
 * This eliminates the cache miss → DB query latency on first visit.
 * Called from the parent layout to warm cache before rendering.
 */
export async function prewarmDepartmentCache() {
  const supabase = await createServerSupabaseClient();

  // Warm cache for all departments in parallel
  await Promise.all(
    DEPARTMENTS.map(async (dept) => {
      const cacheKey = `dept:uuid:${dept.name}`;
      const cached = await cacheGet<string>(cacheKey);

      if (!cached) {
        try {
          const { data: department } = await supabase
            .from("departments")
            .select("id")
            .eq("name", dept.name)
            .single();

          if (department) {
            await cacheSet(cacheKey, department.id, 3600); // 1 hour TTL
          }
        } catch {
          // Silently fail - cache will be populated on-demand
        }
      }
    }),
  );
}
