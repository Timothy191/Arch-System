import { NextResponse } from "next/server";
import { createServerSupabaseClient, getUserSafely } from "@repo/supabase/server";
import { getAgentPublicConfig } from "~/lib/agent/config";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const user = await getUserSafely(supabase);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(getAgentPublicConfig());
}
