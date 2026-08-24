import { createReadReplicaClient } from "@repo/supabase/read-replica";
import { cachedRSC } from "@/lib/server-cache";
import { withCache } from "@/lib/cache-utils";
import { CacheCategory } from "@repo/redis";

/**
 * Fetch the list of department names the given user can access.
 *
 * AGENT-TRACE: Shared between hub/layout.tsx and hub/page.tsx so both use the
 * same cached path (RSC cache + Redis cache) instead of the layout hitting the
 * read-replica uncached on every navigation.
 */
export async function getAccessibleDepartmentNames(
  userId: string,
  cookieList?: Array<{ name: string; value: string }>,
): Promise<string[]> {
  return cachedRSC(
    ["user", userId, "accessible-dept-names"],
    async () => {
      return withCache(
        async () => {
          const db = await createReadReplicaClient(cookieList);
          const { data: empData } = await db
            .from("employees")
            .select("accessible_departments")
            .eq("auth_id", userId)
            .single();

          const accessibleDeptIds = (empData?.accessible_departments ?? []) as string[];
          if (accessibleDeptIds.length === 0) return [];

          const { data: deptData } = await db
            .from("departments")
            .select("name")
            .in("id", accessibleDeptIds);

          return (deptData ?? []).map((d) => d.name);
        },
        {
          category: CacheCategory.AUTH,
          keyParts: ["user", userId, "accessible-dept-names"],
          tags: [`auth:${userId}`, "table:employees", "table:departments"],
        },
      );
    },
    {
      revalidate: 3600,
      tags: [`auth:${userId}`, "table:employees", "table:departments"],
    },
  );
}
