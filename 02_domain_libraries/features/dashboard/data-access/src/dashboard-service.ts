"use server";

import { createServerSupabaseClient } from "@repo/supabase/server";
import { cacheWrap } from "@repo/redis";
import { AuthError, DatabaseError } from "@repo/errors";
import { withSpan } from "@repo/supabase";
import { serverLogger } from "@repo/logger";

import { MonolithizedDashboardPayload } from "./types";

async function fetchDashboard(departmentId: string): Promise<MonolithizedDashboardPayload> {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    serverLogger.error({
      err: new Error("Unauthorized: valid session required"),
      context: "dashboard_rpc",
    });
    throw new AuthError("Unauthorized: valid session required", {
      context: { operation: "getMonolithizedDashboard" },
    });
  }

  const { data, error } = await supabase.rpc("get_monolithized_department_dashboard_payload", {
    dept_id: departmentId,
  });

  if (error) {
    serverLogger.error({ err: new Error(error.message), context: "dashboard_rpc" });
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
