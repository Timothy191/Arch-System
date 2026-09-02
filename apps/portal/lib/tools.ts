import { createReadReplicaClient } from "@repo/supabase/read-replica";
import { PRODUCTIVITY_TOOLS } from "@repo/departments/data-access";
import { cachedRSC } from "@/lib/server-cache";
import { withCache } from "@/lib/cache-utils";
import { CacheCategory } from "@repo/redis";

interface Tool {
  id: string;
  name: string;
  displayName: string;
  description: string;
  icon: string;
  color: string;
}

interface ExternalTool {
  name: string;
  displayName: string;
  url: string;
  description: string;
  icon: string;
  color: string;
}

/**
 * Fetch productivity tools from database.
 * Falls back to PRODUCTIVITY_TOOLS constant if database query fails.
 */
export async function getTools(cookieList?: Array<{ name: string; value: string }>): Promise<Tool[]> {
  return cachedRSC(
    ["hub", "tools"],
    async () => {
      return withCache(
        async () => {
          const db = await createReadReplicaClient(cookieList);

          const { data, error } = await db
            .from("tools")
            .select("id, name, display_name, description, icon, color")
            .eq("active", true)
            .order("sort_order", { ascending: true });

          if (error) {
            // eslint-disable-next-line no-console
            console.warn("Failed to fetch tools from database, falling back to constant:", error);
            return PRODUCTIVITY_TOOLS.map((t, i) => ({
              id: String(i),
              name: t.name,
              displayName: t.displayName,
              description: t.description,
              icon: t.icon,
              color: t.color,
            }));
          }

          if (!data || data.length === 0) {
            return PRODUCTIVITY_TOOLS.map((t, i) => ({
              id: String(i),
              name: t.name,
              displayName: t.displayName,
              description: t.description,
              icon: t.icon,
              color: t.color,
            }));
          }

          return data.map((t) => ({
            id: t.id,
            name: t.name,
            displayName: t.display_name,
            description: t.description,
            icon: t.icon,
            color: t.color,
          }));
        },
        {
          category: CacheCategory.METRICS,
          keyParts: ["hub", "tools"],
          tags: ["table:tools"],
        }
      );
    },
    {
      revalidate: 3600,
      tags: ["table:tools"],
    }
  );
}

/**
 * External tool configurations.
 * Override URLs via environment variables:
 *   N8N_URL=http://localhost:5678
 *   FLOWISE_URL=http://localhost:3001
 *
 * (Flowise runs on port 3001 in docker-compose.tools.yml;
 *  port 3000 is reserved for the Next.js dev server.)
 */
export const EXTERNAL_TOOLS: ExternalTool[] = [
  {
    name: "flowise",
    displayName: "Flowise",
    url: process.env.FLOWISE_URL ?? "http://localhost:3001",
    description: "Visual AI workflow builder — drag-and-drop LangChain agents and LLM pipelines",
    icon: "Bot",
    color: "#3ecf8e",
  },
];
