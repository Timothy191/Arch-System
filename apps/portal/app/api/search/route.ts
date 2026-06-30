import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, getUserSafely } from "@repo/supabase/server";
import { normalizeSearchQuery, searchArch } from "~/lib/search/query";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const query = normalizeSearchQuery(request.nextUrl.searchParams.get("q") ?? "");

  if (query.length < 2) {
    return NextResponse.json({ query, results: [] });
  }

  const supabase = await createServerSupabaseClient();
  const user = await getUserSafely(supabase);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = await searchArch(supabase, query);

  return NextResponse.json({ query, results });
}
