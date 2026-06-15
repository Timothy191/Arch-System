import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@repo/supabase/server";
import { EXTERNAL_TOOLS } from "~/lib/tools";
import { cacheWrap } from "@repo/redis";

export const dynamic = "force-dynamic";

interface ToolStatus {
  name: string;
  displayName: string;
  url: string;
  description: string;
  icon: string;
  color: string;
  status: "online" | "offline" | "unknown";
  responseTime?: number;
}

async function checkToolHealth(
  tool: (typeof EXTERNAL_TOOLS)[number],
): Promise<ToolStatus> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(tool.url, {
      method: "HEAD",
      signal: controller.signal,
    });

    clearTimeout(timeout);

    return {
      ...tool,
      status: response.ok ? "online" : "offline",
      responseTime: Date.now() - start,
    };
  } catch {
    return {
      ...tool,
      status: "offline",
      responseTime: Date.now() - start,
    };
  }
}

export async function GET(_request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const statuses = await cacheWrap(
    "tools:status",
    async () => {
      return await Promise.all(EXTERNAL_TOOLS.map(checkToolHealth));
    },
    60, // Cache for 60 seconds
  );

  return NextResponse.json({ tools: statuses });
}
