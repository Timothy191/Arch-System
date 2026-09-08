import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@repo/supabase/server";
import {
  createBreakdown,
  bookOutBreakdown,
  directCheckout,
} from "@/features/departments/components/engineering/breakdowns/actions";
import {
  createBreakdownSchema,
  bookOutSchema,
  directCheckoutSchema,
} from "@repo/contract/schemas/form.schema";
import { isAppError } from "@/lib/errors/error-classes";
import { logError } from "@/lib/errors/error-logger";

/**
 * POST /api/ai/actions
 * Backend for the Aria assistant sidecar.
 *
 * - `kind: "read"`  — Aria's read tools proxy here with the portal session
 *   cookie forwarded, so Supabase session/RLS apply. All reads are scoped to
 *   the signed-in employee's department.
 * - `kind: "write"` — Called by Aria's confirm card IN the portal (same
 *   origin), so this is the ONLY path that actually writes to the database.
 *   The model itself never writes; it only produces a draft.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    kind?: unknown;
    tool?: unknown;
    args?: unknown;
  } | null;

  if (!body || (body.kind !== "read" && body.kind !== "write")) {
    return NextResponse.json(
      { success: false, error: 'Expected { kind: "read" | "write", tool, args }' },
      { status: 400 },
    );
  }

  if (typeof body.tool !== "string" || body.tool.length === 0) {
    return NextResponse.json({ success: false, error: "Missing tool name" }, { status: 400 });
  }

  const args =
    body.args && typeof body.args === "object" ? (body.args as Record<string, unknown>) : {};

  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { data: employee } = await supabase
      .from("employees")
      .select("id, department_id")
      .eq("auth_id", user.id)
      .maybeSingle();
    if (!employee?.department_id) {
      return NextResponse.json(
        { success: false, error: "Employee record or department not found" },
        { status: 403 },
      );
    }

    if (body.kind === "read") {
      return handleRead(supabase, body.tool, employee.department_id);
    }

    return await handleWrite(body.tool, args, employee.department_id);
  } catch (error) {
    await logError(error, { context: "aria_actions_route" });
    if (isAppError(error)) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: 500 },
      );
    }
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to process request",
      },
      { status: 500 },
    );
  }
}

async function handleRead(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  tool: string,
  departmentId: string,
): Promise<NextResponse> {
  if (tool === "get_active_breakdowns") {
    const { data, error } = await supabase
      .from("breakdowns")
      .select("id, fleet_id, machine_name, machine_type, date_in, time_in, reason, status")
      .eq("department_id", departmentId)
      .eq("status", "active")
      .is("deleted_at", null)
      .order("date_in", { ascending: false })
      .limit(50);
    if (error) throw error;
    return NextResponse.json({ success: true, data: { breakdowns: data ?? [] } });
  }

  if (tool === "get_shift_summary") {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
      today.getDate(),
    ).padStart(2, "0")}`;

    const { data: activeBreakdowns, error: bdError } = await supabase
      .from("breakdowns")
      .select("fleet_id, machine_type, date_in, time_in, reason")
      .eq("department_id", departmentId)
      .eq("status", "active")
      .is("deleted_at", null)
      .order("date_in", { ascending: false })
      .limit(50);
    if (bdError) throw bdError;

    const { data: logs, error: logError } = await supabase
      .from("daily_logs")
      .select("id, shift, notes")
      .eq("department_id", departmentId)
      .eq("log_date", todayStr);
    if (logError) throw logError;

    const logIds = (logs ?? []).map((l) => l.id);
    let totalHours = 0;
    let machineCount = 0;
    if (logIds.length > 0) {
      const { data: hours, error: hoursError } = await supabase
        .from("machine_hours")
        .select("hours_worked")
        .in("daily_log_id", logIds);
      if (hoursError) throw hoursError;
      totalHours = (hours ?? []).reduce((sum, h) => sum + (h.hours_worked || 0), 0);
      machineCount = (hours ?? []).length;
    }

    const shifts = [...new Set((logs ?? []).map((l) => l.shift))].join("/") || "—";
    const breakdownCount = activeBreakdowns?.length ?? 0;

    return NextResponse.json({
      success: true,
      data: {
        summary:
          `${breakdownCount} active breakdown(s); ${machineCount} machine-hour record(s) totalling ` +
          `${totalHours.toFixed(1)}h for ${todayStr} (shift${shifts === "—" ? "" : "s"}: ${shifts}).`,
        today: todayStr,
        active_breakdowns: activeBreakdowns ?? [],
        total_machine_hours: totalHours,
        machine_hour_records: machineCount,
        shift: shifts,
      },
    });
  }

  return NextResponse.json(
    { success: false, error: `Unknown read tool: ${tool}` },
    { status: 400 },
  );
}

async function handleWrite(
  tool: string,
  args: Record<string, unknown>,
  departmentId: string,
): Promise<NextResponse> {
  if (tool === "create_breakdown") {
    const parsed = createBreakdownSchema.safeParse(args);
    if (!parsed.success) return invalidInput(parsed.error);
    const result = await createBreakdown(departmentId, parsed.data);
    return NextResponse.json({ success: true, data: result });
  }

  if (tool === "book_out_breakdown") {
    const breakdownId = typeof args.breakdown_id === "string" ? args.breakdown_id : "";
    if (!breakdownId) {
      return NextResponse.json(
        { success: false, error: "book_out_breakdown requires breakdown_id" },
        { status: 400 },
      );
    }
    const parsed = bookOutSchema.safeParse(args);
    if (!parsed.success) return invalidInput(parsed.error);
    const result = await bookOutBreakdown(breakdownId, parsed.data);
    return NextResponse.json({ success: true, data: result });
  }

  if (tool === "direct_checkout") {
    const parsed = directCheckoutSchema.safeParse(args);
    if (!parsed.success) return invalidInput(parsed.error);
    const result = await directCheckout(departmentId, parsed.data);
    return NextResponse.json({ success: true, data: result });
  }

  return NextResponse.json(
    { success: false, error: `Unknown write tool: ${tool}` },
    { status: 400 },
  );
}

function invalidInput(error: {
  issues: Array<{ path: PropertyKey[]; message: string }>;
}): NextResponse {
  const detail = error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
  return NextResponse.json(
    { success: false, error: detail ? `Invalid input — ${detail}` : "Invalid input" },
    { status: 400 },
  );
}
