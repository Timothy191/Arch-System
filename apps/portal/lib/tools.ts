import { createReadReplicaClient } from "@repo/supabase/read-replica";
import { PRODUCTIVITY_TOOLS } from "~/lib/departments";

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
export async function getTools(): Promise<Tool[]> {
  const db = await createReadReplicaClient();

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
}

/**
 * External tool configurations for the department Tools page.
 * Productivity integrations (n8n, Flowise, etc.) live outside this monorepo.
 */
export const EXTERNAL_TOOLS: ExternalTool[] = [
  {
    name: "supabase",
    displayName: "Supabase Studio",
    url: "http://localhost:54323",
    description: "Self-hosted Supabase dashboard for database management & migrations",
    icon: "Database",
    color: "violet",
  },
];
