import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@repo/supabase/server";
import { getShiftCompleteness } from "@/lib/shift-completeness";

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const deptId = searchParams.get("deptId");
  const deptSlug = searchParams.get("deptSlug");
  const date = searchParams.get("date");
  const shift = searchParams.get("shift") as "day" | "night" | null;

  if (!deptId || !deptSlug || !date || !shift) {
    return NextResponse.json(
      { error: "Missing required params: deptId, deptSlug, date, shift" },
      { status: 400 },
    );
  }

  const completeness = await getShiftCompleteness(
    supabase,
    deptId,
    deptSlug,
    date,
    shift,
  );

  return NextResponse.json(completeness);
}
