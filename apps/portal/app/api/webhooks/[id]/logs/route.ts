import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@repo/supabase/server";
import { withRateLimit } from "@/lib/api/rate-limit-middleware";

export const dynamic = "force-dynamic";

async function handleGetLogs(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get user's department and role
  const { data: employee } = await supabase
    .from("employees")
    .select("department_id, role, accessible_departments")
    .eq("auth_id", user.id)
    .single();

  if (!employee) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }

  // Get the webhook to check ownership
  const { data: existingWebhook } = await supabase
    .from("webhook_endpoints")
    .select("*")
    .eq("id", id)
    .single();

  if (!existingWebhook) {
    return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
  }

  // Check if user has permission to view logs for this webhook
  if (employee.role !== "admin") {
    if (
      existingWebhook.department_id !== employee.department_id &&
      !employee.accessible_departments?.includes(existingWebhook.department_id)
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // Get delivery logs
  const { data: logs, error } = await supabase
    .from("webhook_delivery_logs")
    .select("*")
    .eq("webhook_endpoint_id", id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json(
      { error: "Database query failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({ logs });
}

// GET /api/webhooks/[id]/logs - Get delivery logs for a webhook
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withRateLimit(request, () => handleGetLogs(request, { params }));
}
