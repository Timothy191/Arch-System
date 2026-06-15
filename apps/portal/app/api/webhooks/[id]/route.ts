import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@repo/supabase/server";
import { revalidatePath } from "next/cache";
import { withRateLimit } from "@/lib/api/rate-limit-middleware";
import { validateBody } from "@/lib/api/response";
import { applyCors } from "@/lib/api/cors";
import { updateWebhookSchema } from "@repo/contract";

export const dynamic = "force-dynamic";

async function handlePutWebhook(
  request: NextRequest,
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

  const parsed = await validateBody(request, updateWebhookSchema);
  if (parsed instanceof NextResponse) return parsed;
  const { url, description, event_types, active } = parsed.data;

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

  // Check if user has permission to update this webhook
  if (employee.role !== "admin") {
    if (
      existingWebhook.department_id !== employee.department_id &&
      !employee.accessible_departments?.includes(existingWebhook.department_id)
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const { data: webhook, error } = await supabase
    .from("webhook_endpoints")
    .update({
      ...(url !== undefined && { url }),
      ...(description !== undefined && { description }),
      ...(event_types !== undefined && { event_types }),
      ...(active !== undefined && { active }),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Failed to update webhook" },
      { status: 500 },
    );
  }

  revalidatePath("/admin/tools");
  revalidatePath("/(departments)/[department]/tools");

  return NextResponse.json({ webhook });
}

// PUT /api/webhooks/[id] - Update a webhook endpoint
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const response = await withRateLimit(request, () =>
    handlePutWebhook(request, { params }),
  );
  return applyCors(request, response);
}

async function handleDeleteWebhook(
  request: NextRequest,
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

  // Check if user has permission to delete this webhook
  if (employee.role !== "admin") {
    if (
      existingWebhook.department_id !== employee.department_id &&
      !employee.accessible_departments?.includes(existingWebhook.department_id)
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // Soft delete
  const { error } = await supabase
    .from("webhook_endpoints")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    return NextResponse.json(
      { error: "Failed to delete webhook" },
      { status: 500 },
    );
  }

  revalidatePath("/admin/tools");
  revalidatePath("/(departments)/[department]/tools");

  return NextResponse.json({ success: true });
}

// DELETE /api/webhooks/[id] - Delete a webhook endpoint
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const response = await withRateLimit(request, () =>
    handleDeleteWebhook(request, { params }),
  );
  return applyCors(request, response);
}
