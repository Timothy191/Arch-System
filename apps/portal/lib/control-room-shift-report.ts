"use server";

import { createServerSupabaseClient } from "@repo/supabase/server";
import { createServiceRoleClient } from "@repo/supabase/service-role";
import { controlRoomShiftReportSchema } from "@repo/contract/schemas/control-room.schema";
import type { ControlRoomShiftReportInput } from "@repo/contract/types/control-room.types";
import { logAuditEvent } from "./audit";
import { AuthError, DatabaseError } from "@/lib/errors/error-classes";
import { logError } from "@/lib/errors/error-logger";

// AGENT-TRACE: Lookup key for a shift report — (department, date, shift) is the
// natural key enforced by the UNIQUE constraint on control_room_shift_reports.
const shiftReportLookupSchema = controlRoomShiftReportSchema.pick({
  departmentId: true,
  date: true,
  shift: true,
});

interface ShiftReportRecord {
  id: string;
  departmentId: string;
  date: string;
  shift: "day" | "night";
  operatorName: string;
  alarmResponseAvgSeconds: number;
  incidentAckAvgSeconds: number;
  systemUptimePercent: number;
  missedIncidentsCount: number;
  summaryNotes: string | null;
  checklistItems: ControlRoomShiftReportInput["checklistItems"];
  completedChecklistCount: number;
  totalChecklistCount: number;
  supervisorSignature: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Persist a control room shift closeout report. One report per
 * (department, date, shift) — an existing report is updated in place so the
 * operator can revise a closeout before the shift is locked.
 */
export async function submitShiftReport(
  input: ControlRoomShiftReportInput,
): Promise<{ success: true; reportId: string }> {
  // AGENT-TRACE: Validate the full report payload at the boundary — the schema
  // mirrors the table columns so a valid payload maps 1:1 to a row.
  const validated = controlRoomShiftReportSchema.parse(input);

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new AuthError("Unauthorized: valid session required", {
      context: { operation: "submitShiftReport" },
    });
  }

  const { data: employee } = await supabase
    .from("employees")
    .select("id")
    .eq("auth_id", user.id)
    .maybeSingle();
  if (!employee) {
    throw new AuthError("Unauthorized: employee record not found", {
      context: { operation: "submitShiftReport" },
    });
  }

  const serviceClient = createServiceRoleClient();

  // AGENT-TRACE: Select-then-insert-or-update (not .upsert()) so created_by is
  // preserved on revision — .upsert() would overwrite the original author.
  const { data: existing } = await serviceClient
    .from("control_room_shift_reports")
    .select("id")
    .eq("department_id", validated.departmentId)
    .eq("report_date", validated.date)
    .eq("shift_type", validated.shift)
    .maybeSingle();

  const payload = {
    department_id: validated.departmentId,
    report_date: validated.date,
    shift_type: validated.shift,
    operator_name: validated.operatorName,
    alarm_response_avg_seconds: validated.alarmResponseAvgSeconds,
    incident_ack_avg_seconds: validated.incidentAckAvgSeconds,
    system_uptime_percent: validated.systemUptimePercent,
    missed_incidents_count: validated.missedIncidentsCount,
    summary_notes: validated.summaryNotes,
    checklist_items: validated.checklistItems ?? [],
    completed_checklist_count: validated.completedChecklistCount,
    total_checklist_count: validated.totalChecklistCount,
    supervisor_signature: validated.supervisorSignature ?? null,
  };

  let reportId: string;
  if (existing) {
    const { data, error } = await serviceClient
      .from("control_room_shift_reports")
      .update(payload)
      .eq("id", existing.id)
      .select("id")
      .single();
    if (error) {
      await logError(new Error(error.message), { action: "submitShiftReport:update" });
      throw new DatabaseError("Failed to update shift report", { cause: error });
    }
    reportId = data.id;
  } else {
    const { data, error } = await serviceClient
      .from("control_room_shift_reports")
      .insert({ ...payload, created_by: employee.id })
      .select("id")
      .single();
    if (error) {
      await logError(new Error(error.message), { action: "submitShiftReport:insert" });
      throw new DatabaseError("Failed to save shift report", { cause: error });
    }
    reportId = data.id;
  }

  await logAuditEvent({
    action: existing ? "update" : "insert",
    tableName: "control_room_shift_reports",
    recordId: reportId,
    departmentId: validated.departmentId,
  });

  return { success: true, reportId };
}

/**
 * Load an existing shift report for (department, date, shift), or null if the
 * operator has not yet submitted one. Used to restore checklist state on mount.
 */
export async function getShiftReport(
  departmentId: string,
  date: string,
  shift: "day" | "night",
): Promise<ShiftReportRecord | null> {
  const validated = shiftReportLookupSchema.parse({ departmentId, date, shift });

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new AuthError("Unauthorized: valid session required", {
      context: { operation: "getShiftReport" },
    });
  }

  const { data: report, error } = await supabase
    .from("control_room_shift_reports")
    .select("*")
    .eq("department_id", validated.departmentId)
    .eq("report_date", validated.date)
    .eq("shift_type", validated.shift)
    .maybeSingle();

  if (error) {
    await logError(new Error(error.message), { action: "getShiftReport:select" });
    throw new DatabaseError("Failed to load shift report", { cause: error });
  }
  if (!report) return null;

  return {
    id: report.id,
    departmentId: report.department_id,
    date: report.report_date,
    shift: report.shift_type,
    operatorName: report.operator_name,
    alarmResponseAvgSeconds: Number(report.alarm_response_avg_seconds),
    incidentAckAvgSeconds: Number(report.incident_ack_avg_seconds),
    systemUptimePercent: Number(report.system_uptime_percent),
    missedIncidentsCount: report.missed_incidents_count,
    summaryNotes: report.summary_notes,
    checklistItems: report.checklist_items,
    completedChecklistCount: report.completed_checklist_count,
    totalChecklistCount: report.total_checklist_count,
    supervisorSignature: report.supervisor_signature,
    createdAt: report.created_at,
    updatedAt: report.updated_at,
  };
}
