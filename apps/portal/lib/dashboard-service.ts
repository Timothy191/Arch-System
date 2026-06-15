"use server";

import { createServerSupabaseClient } from "@repo/supabase/server";
import { cacheWrap } from "@repo/redis";
import { AuthError, DatabaseError } from "@/lib/errors/error-classes";
import { withSpan } from "@repo/supabase";
import { logError } from "@/lib/errors/error-logger";

interface MonolithizedDashboardPayload {
  department_id: string;
  daily_logs: Array<{
    id: string;
    log_date: string;
    shift: "day" | "night";
    notes: string | null;
    sync_status: "pending" | "synced" | "failed";
    idempotency_key: string;
    last_synced_at: string;
  }>;
  breakdowns: Array<{
    id: string;
    fleet_id: string;
    machine_type: string;
    date_in: string;
    date_out: string | null;
    reason: string;
    status: "active" | "completed";
    sync_status: "pending" | "synced" | "failed";
    idempotency_key: string;
    last_synced_at: string;
  }>;
  safety_incidents: Array<{
    id: string;
    incident_date: string;
    shift_type: "day" | "night";
    incident_type: "near-miss" | "incident" | "lost-time" | "equipment-damage";
    description: string;
    status: "open" | "under-investigation" | "resolved" | "closed";
    sync_status: "pending" | "synced" | "failed";
    idempotency_key: string;
    last_synced_at: string;
  }>;
}

async function fetchDashboard(
  departmentId: string,
): Promise<MonolithizedDashboardPayload> {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    logError(new Error("Unauthorized: valid session required"), {
      context: "dashboard_rpc",
    });
    throw new AuthError("Unauthorized: valid session required", {
      context: { operation: "getMonolithizedDashboard" },
    });
  }

  const { data, error } = await supabase.rpc(
    "get_monolithized_department_dashboard_payload",
    { dept_id: departmentId },
  );

  if (error) {
    logError(new Error(error.message), { context: "dashboard_rpc" });
    throw new DatabaseError("Failed to query dashboard data", {
      operation: "query",
      context: { error: error.message },
    });
  }

  return data as unknown as MonolithizedDashboardPayload;
}

/**
 * Get highly optimized, monolithized department dashboard data payload.
 * Auth is resolved once per call (outside the cache); the RPC itself is
 * cached for 15 seconds per department.
 */
export async function getMonolithizedDashboard(
  departmentId: string,
): Promise<MonolithizedDashboardPayload> {
  const cacheKey = `dept:dashboard:monolith:${departmentId}`;

  return withSpan(
    "dashboard.getMonolithizedDashboard",
    async () =>
      cacheWrap<MonolithizedDashboardPayload>(
        cacheKey,
        async () => fetchDashboard(departmentId),
        15,
      ),
    { departmentId },
  );
}
