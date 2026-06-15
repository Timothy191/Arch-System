import { getDepartmentContext } from "~/lib/dept-context";
import { createServerSupabaseClient } from "@repo/supabase/server";
import { GlassCard } from "@repo/ui/GlassCard";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/ui/table";
import { ShieldOff, Clock } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AccessLogsPage() {
  const { deptId } = await getDepartmentContext({
    department: "access-control",
  });

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return (
      <div className="space-y-6">
        <p className="text-[var(--text-muted)]">
          Please log in to view access logs.
        </p>
      </div>
    );
  }

  const { data: logs } = await supabase
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
    )
    .eq("department_id", deptId)
    .order("scanned_at", { ascending: false })
    .limit(100);

  const resolvedLogs = (logs || []).map((log: any) => {
    const badge = log.badge as any;
    let entityName = "Unknown";
    let entityType: string = badge?.entity_type ?? "Unknown";

    if (badge?.personnel) {
      entityName = `${badge.personnel.first_name} ${badge.personnel.surname}`;
      entityType = "Employee";
    } else if (badge?.visitor) {
      entityName = `${badge.visitor.first_name} ${badge.visitor.surname}`;
      entityType = "Visitor";
    }

    let status = log.access_granted ? "Granted" : "Denied";
    if (!log.access_granted && log.denial_reason) {
      if (
        log.denial_reason.includes("Expired") ||
        log.denial_reason.includes("expired")
      ) {
        status = "Expired Credential";
      } else if (log.denial_reason.includes("Tailgate")) {
        status = "Tailgate Alert";
      }
    }

    return {
      id: log.id,
      timestamp: log.scanned_at,
      entityName,
      entityType,
      qrCodeId: badge?.qr_code ?? "N/A",
      zone: log.gate_location,
      accessMethod: log.access_type ?? "QR Scan",
      status,
      direction: log.direction,
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[var(--text-heading)]">
            Access Logs
          </h2>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Recent scan events across all entry points for this department.
          </p>
        </div>
      </div>

      <GlassCard className="p-0 overflow-hidden">
        <div className="p-4 border-b border-[var(--border-default)] bg-[var(--bg-secondary)]/50 flex justify-between items-center">
          <h3 className="font-semibold text-[var(--text-heading)] flex items-center">
            <Clock className="w-4 h-4 mr-2 text-[var(--text-muted)]" />
            Recent Events
          </h3>
          <span className="text-xs text-[var(--text-muted)]">
            {resolvedLogs.length} events
          </span>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="border-b border-[var(--border-default)] hover:bg-transparent">
              <TableHead className="text-[var(--text-muted)]">Time</TableHead>
              <TableHead className="text-[var(--text-muted)]">Entity</TableHead>
              <TableHead className="text-[var(--text-muted)]">Type</TableHead>
              <TableHead className="text-[var(--text-muted)]">
                QR Code
              </TableHead>
              <TableHead className="text-[var(--text-muted)]">Zone</TableHead>
              <TableHead className="text-[var(--text-muted)]">
                Direction
              </TableHead>
              <TableHead className="text-right text-[var(--text-muted)]">
                Status
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {resolvedLogs.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center py-8 text-[var(--text-muted)]"
                >
                  No access logs found for this department.
                </TableCell>
              </TableRow>
            )}
            {resolvedLogs.map((log) => (
              <TableRow
                key={log.id}
                className="border-b border-[var(--border-default)]/50 hover:bg-[var(--bg-tertiary)] transition-colors"
              >
                <TableCell className="font-mono text-sm text-[var(--text-secondary)]">
                  {new Date(log.timestamp).toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                    hour12: false,
                  })}
                </TableCell>
                <TableCell className="font-medium text-[var(--text-heading)]">
                  {log.entityName}
                </TableCell>
                <TableCell className="text-[var(--text-secondary)] capitalize">
                  {log.entityType}
                </TableCell>
                <TableCell className="font-mono text-sm text-[var(--accent-blue)]">
                  {log.qrCodeId}
                </TableCell>
                <TableCell className="text-[var(--text-secondary)]">
                  {log.zone}
                </TableCell>
                <TableCell className="text-[var(--text-secondary)]">
                  {log.direction}
                </TableCell>
                <TableCell className="text-right">
                  {log.status === "Granted" ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full border bg-emerald-50/70 border-emerald-200/50 text-emerald-700">
                      <span className="badge-pulse-dot bg-emerald-500" />
                      Granted
                    </span>
                  ) : log.status === "Denied" ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full border bg-red-50/70 border-red-200/50 text-red-700">
                      <ShieldOff className="w-3 h-3" />
                      Denied
                    </span>
                  ) : log.status === "Expired Credential" ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full border bg-amber-50/70 border-amber-200/50 text-amber-700">
                      <Clock className="w-3 h-3" />
                      Expired
                    </span>
                  ) : (
                    <span className="text-xs text-[var(--text-muted)] font-mono">
                      {log.status}
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </GlassCard>
    </div>
  );
}
