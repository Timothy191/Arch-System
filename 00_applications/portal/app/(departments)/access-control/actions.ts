"use server";

import { cacheInvalidateTags, CacheCategory } from "@repo/redis";
import { createServerSupabaseClient } from "@repo/supabase/server";
import { revalidatePath } from "next/cache";
import { AuthError, DatabaseError, ForbiddenError } from "@/lib/errors/error-classes";
import { withCache } from "@/lib/cache-utils";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface AccessControlMetrics {
  activeQrCodes: number;
  expiringSoon: number;
  deniedToday: number;
  accessEventsToday: number;
  expiredAssigned: number;
  entityCoverage: number;
}

interface AccessActivityEntry {
  id: string;
  entityName: string;
  entityType: string;
  zone: string;
  status: "Granted" | "Denied" | "Expired Credential" | "Tailgate Alert";
  time: string;
  qrId: string;
}

interface EntityBadgeStatus {
  type: string;
  total: number;
  active: number;
  expiring: number;
  expired: number;
}

export interface HourlyAccessPoint {
  hour: string;
  granted: number;
  denied: number;
}

export interface BadgeStatusDistribution {
  name: string;
  value: number;
  fill: string;
}

/* ------------------------------------------------------------------ */
/*  Auth helper                                                        */
/* ------------------------------------------------------------------ */

async function assertAccessControlRole() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new AuthError("Unauthorized");

  const { data: employee } = await supabase
    .from("employees")
    .select("role, department_id")
    .eq("auth_id", user.id)
    .single();

  if (!employee || !["admin", "access_control"].includes(employee.role)) {
    throw new ForbiddenError("Forbidden: access_control or admin role required", {
      resource: "access_control",
      action: "assert_role",
    });
  }

  return { supabase, user, employee };
}

/* ------------------------------------------------------------------ */
/*  1. KPI Metrics                                                     */
/* ------------------------------------------------------------------ */

export async function getAccessControlMetrics(deptId: string): Promise<AccessControlMetrics> {
  return withCache(
    async () => {
      const { supabase } = await assertAccessControlRole();

      const { data, error } = await supabase.rpc("get_access_control_metrics_jsonb", {
        p_department_id: deptId,
      });

      if (error) {
        throw new DatabaseError("Failed to load access control metrics", {
          operation: "rpc",
          context: { error: error.message },
        });
      }

      const metrics = (data as Record<string, unknown>)?.metrics as
        | Record<string, number>
        | undefined;

      const activeQrCodes = metrics?.active_qr_codes ?? 0;
      const totalEntities = metrics?.total_entities ?? 0;
      const entityCoverage =
        totalEntities && activeQrCodes ? Math.round((activeQrCodes / totalEntities) * 100) : 0;

      return {
        activeQrCodes,
        expiringSoon: metrics?.expiring_soon ?? 0,
        deniedToday: metrics?.denied_today ?? 0,
        accessEventsToday: metrics?.access_events_today ?? 0,
        expiredAssigned: metrics?.expired_assigned ?? 0,
        entityCoverage,
      };
    },
    {
      category: CacheCategory.METRICS,
      keyParts: ["access-control", deptId, "metrics"],
      tags: [`dept:${deptId}`, "table:badges", "table:access_logs", "table:personnel"],
    },
  );
}

/* ------------------------------------------------------------------ */
/*  2. Recent Activity Feed                                            */
/* ------------------------------------------------------------------ */

interface AccessLogWithBadge {
  id: string;
  scanned_at: string;
  gate_location: string;
  access_granted: boolean;
  denial_reason: string | null;
  badge: {
    qr_code: string;
    entity_type: string;
    personnel: { first_name: string; surname: string } | null;
    visitor: { first_name: string; surname: string } | null;
  };
}

export async function getRecentAccessActivity(
  deptId: string,
  limit = 8,
): Promise<AccessActivityEntry[]> {
  const { supabase } = await assertAccessControlRole();

  const { data: logs } = await supabase
    .from("access_logs")
    .select(
      `
      id,
      scanned_at,
      gate_location,
      access_granted,
      denial_reason,
      badge:badges!inner(qr_code, entity_type, personnel:personnel_id(first_name, surname), visitor:visitor_id(name))
    `,
    )
    .eq("department_id", deptId)
    .order("scanned_at", { ascending: false })
    .limit(limit);

  if (!logs) return [];

  return (logs as unknown as AccessLogWithBadge[]).map((log) => {
    const { badge } = log;
    let entityName = "Unknown";
    let entityType = badge?.entity_type ?? "Unknown";

    if (badge?.personnel) {
      entityName = `${badge.personnel.first_name} ${badge.personnel.surname}`;
      entityType = "Employee";
    } else if (badge?.visitor) {
      entityName = `${badge.visitor.first_name} ${badge.visitor.surname}`;
      entityType = "Visitor";
    }

    let status: AccessActivityEntry["status"] = "Granted";
    if (!log.access_granted) {
      status =
        log.denial_reason?.includes("Expired") || log.denial_reason?.includes("expired")
          ? "Expired Credential"
          : log.denial_reason?.includes("Tailgate")
            ? "Tailgate Alert"
            : "Denied";
    }

    return {
      id: log.id,
      entityName,
      entityType,
      zone: log.gate_location,
      status,
      time: new Date(log.scanned_at).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }),
      qrId: badge?.qr_code ?? "N/A",
    };
  });
}

/* ------------------------------------------------------------------ */
/*  3. Entity Badge Status                                             */
/* ------------------------------------------------------------------ */

export async function getEntityBadgeStatus(deptId: string): Promise<EntityBadgeStatus[]> {
  return withCache(
    async () => {
      const { supabase } = await assertAccessControlRole();

      const { data, error } = await supabase.rpc("get_access_control_metrics_jsonb", {
        p_department_id: deptId,
      });

      if (error) {
        throw new DatabaseError("Failed to load entity badge status", {
          operation: "rpc",
          context: { error: error.message },
        });
      }

      const status = (data as Record<string, unknown>)?.entity_badge_status as
        | Record<
            string,
            {
              total?: number;
              active?: number;
              expiring?: number;
              expired?: number;
            }
          >
        | undefined;

      return [
        {
          type: "Employees",
          total: status?.employees?.total ?? 0,
          active: status?.employees?.active ?? 0,
          expiring: status?.employees?.expiring ?? 0,
          expired: status?.employees?.expired ?? 0,
        },
        {
          type: "Vehicles",
          total: status?.vehicles?.total ?? 0,
          active: status?.vehicles?.active ?? 0,
          expiring: status?.vehicles?.expiring ?? 0,
          expired: status?.vehicles?.expired ?? 0,
        },
        {
          type: "Equipment",
          total: status?.equipment?.total ?? 0,
          active: status?.equipment?.active ?? 0,
          expiring: status?.equipment?.expiring ?? 0,
          expired: status?.equipment?.expired ?? 0,
        },
      ];
    },
    {
      category: CacheCategory.METRICS,
      keyParts: ["access-control", deptId, "badge-status"],
      tags: [`dept:${deptId}`, "table:badges", "table:personnel", "table:fleet", "table:equipment"],
    },
  );
}

/* ------------------------------------------------------------------ */
/*  4. Hourly Access Stats                                             */
/* ------------------------------------------------------------------ */

export async function getHourlyAccessStats(
  deptId: string,
  date?: string,
): Promise<HourlyAccessPoint[]> {
  const { supabase } = await assertAccessControlRole();

  const targetDate = date ?? new Date().toISOString().split("T")[0];
  const start = `${targetDate}T00:00:00Z`;
  const end = `${targetDate}T23:59:59Z`;

  const { data: logs } = await supabase
    .from("access_logs")
    .select("scanned_at, access_granted")
    .eq("department_id", deptId)
    .gte("scanned_at", start)
    .lte("scanned_at", end);

  // Aggregate into hourly buckets
  const hours = Array.from({ length: 24 }, (_, i) => ({
    hour: `${String(i).padStart(2, "0")}:00`,
    granted: 0,
    denied: 0,
  }));

  if (!logs) return hours;

  for (const log of logs) {
    const h = new Date(log.scanned_at).getUTCHours();
    if (log.access_granted) {
      hours[h]!.granted++;
    } else {
      hours[h]!.denied++;
    }
  }

  return hours;
}

/* ------------------------------------------------------------------ */
/*  5. Badge Status Distribution                                       */
/* ------------------------------------------------------------------ */

export async function getBadgeStatusDistribution(
  deptId: string,
): Promise<BadgeStatusDistribution[]> {
  return withCache(
    async () => {
      const { supabase } = await assertAccessControlRole();

      const { data, error } = await supabase.rpc("get_access_control_metrics_jsonb", {
        p_department_id: deptId,
      });

      if (error) {
        throw new DatabaseError("Failed to load badge status distribution", {
          operation: "rpc",
          context: { error: error.message },
        });
      }

      const dist = (data as Record<string, unknown>)?.badge_status_distribution as
        | Record<string, number>
        | undefined;

      return [
        { name: "Active", value: dist?.active ?? 0, fill: "var(--success)" },
        {
          name: "Expiring Soon",
          value: dist?.expiring_soon ?? 0,
          fill: "var(--warning)",
        },
        { name: "Expired", value: dist?.expired ?? 0, fill: "var(--danger)" },
        {
          name: "Revoked",
          value: dist?.revoked ?? 0,
          fill: "var(--muted-foreground)",
        },
      ];
    },
    {
      category: CacheCategory.METRICS,
      keyParts: ["access-control", deptId, "distribution"],
      tags: [`dept:${deptId}`, "table:badges"],
    },
  );
}

/* ------------------------------------------------------------------ */
/*  6. Badge CRUD Actions                                              */
/* ------------------------------------------------------------------ */

async function _revokeBadge(badgeId: string): Promise<{ success: boolean; error?: string }> {
  const { supabase, employee } = await assertAccessControlRole();

  const { error } = await supabase
    .from("badges")
    .update({ is_active: false, revoked_at: new Date().toISOString() })
    .eq("id", badgeId);

  if (error) {
    return { success: false, error: error.message };
  }

  await cacheInvalidateTags(["table:badges", `dept:${employee.department_id}`]);
  revalidatePath("/access-control/badges");
  return { success: true };
}

export async function getBadgesForDepartment(deptId: string, page = 1, pageSize = 50) {
  const { supabase } = await assertAccessControlRole();

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const {
    data: badges,
    count,
    error,
  } = await supabase
    .from("badges")
    .select(
      `
      id,
      qr_code,
      entity_type,
      is_active,
      issued_at,
      expires_at,
      personnel:personnel_id(first_name, surname),
      visitor:visitor_id(first_name, surname),
      fleet:fleet_id(fleet_code, vehicle_type),
      equipment:equipment_id(equip_code, equipment_type)
    `,
      { count: "exact" },
    )
    .eq("department_id", deptId)
    .order("issued_at", { ascending: false })
    .range(from, to);

  if (error) {
    throw new DatabaseError("Failed to load badges", {
      operation: "select",
      context: { error: error.message },
    });
  }

  return { badges: badges ?? [], totalCount: count ?? 0 };
}

export async function getVisitorsForDepartment(deptId: string, page = 1, pageSize = 50) {
  const { supabase } = await assertAccessControlRole();

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const {
    data: visitors,
    count,
    error,
  } = await supabase
    .from("visitors")
    .select(
      `
      id,
      first_name,
      surname,
      id_number,
      company,
      visiting,
      reason_for_entry,
      check_in_time,
      check_out_time,
      status
    `,
      { count: "exact" },
    )
    .eq("department_id", deptId)
    .order("check_in_time", { ascending: false })
    .range(from, to);

  if (error) {
    throw new DatabaseError("Failed to load visitors", {
      operation: "select",
      context: { error: error.message },
    });
  }

  return { visitors: visitors ?? [], totalCount: count ?? 0 };
}

export async function registerVisitor(formData: FormData) {
  const { supabase, employee } = await assertAccessControlRole();

  const firstName = formData.get("first_name") as string;
  const surname = formData.get("surname") as string;
  const company = formData.get("company") as string;
  const reason = formData.get("reason") as string;

  const { data: visitor, error } = await supabase
    .from("visitors")
    .insert({
      first_name: firstName,
      surname,
      company,
      reason_for_entry: reason,
      department_id: employee.department_id,
      status: "Checked In",
      check_in_time: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    throw new DatabaseError("Failed to register visitor", {
      operation: "insert",
      context: { error: error.message },
    });
  }

  // Also issue a temporary badge
  const qrCode = `TEMP-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  const { error: badgeError } = await supabase.from("badges").insert({
    qr_code: qrCode,
    entity_type: "Visitor",
    visitor_id: visitor.id,
    department_id: employee.department_id,
    is_active: true,
    issued_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(), // 8 hours
  });

  if (badgeError) {
    // Failed to issue badge, but visitor was registered.
    // In production, we should log this to a proper observability system.
  }

  revalidatePath("/access-control/visitors");
  return { success: true };
}

export async function getAccessLogsForDepartment(deptId: string, page = 1, pageSize = 50) {
  const { supabase } = await assertAccessControlRole();

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const {
    data: logs,
    count,
    error,
  } = await supabase
    .from("access_logs")
    .select(
      `
      id,
      scanned_at,
      gate_location,
      access_granted,
      denial_reason,
      access_type,
      direction,
      badge:badges!inner(qr_code, entity_type, personnel:personnel_id(first_name, surname), visitor:visitor_id(first_name, surname))
    `,
      { count: "exact" },
    )
    .eq("department_id", deptId)
    .order("scanned_at", { ascending: false })
    .range(from, to);

  if (error) {
    throw new DatabaseError("Failed to load access logs", {
      operation: "select",
      context: { error: error.message },
    });
  }

  return { logs: logs ?? [], totalCount: count ?? 0 };
}
