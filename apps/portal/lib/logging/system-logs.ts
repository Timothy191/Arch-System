/**
 * Server-side system log persistence.
 *
 * Writes validated entries into public.system_logs via the service role.
 * This module must only be imported from server contexts (route handlers,
 * instrumentation, server actions) — it depends on service-role credentials.
 *
 * `recordSystemLog` never throws: telemetry must not take down the request
 * that produced it.
 */

import type { CreateSystemLogEntry } from '@repo/contract';
import { serverLogger } from '@repo/logger';
import { createServiceRoleClient } from '@repo/supabase/service-role';
import * as React from 'react';

type ReactWithTaint = {
  experimental_taintObjectReference?: (message: string, object: object) => void;
};

function taintServiceClient<T extends object>(client: T): T {
  const reactTaint = React as unknown as ReactWithTaint;
  if (typeof reactTaint.experimental_taintObjectReference === 'function') {
    try {
      reactTaint.experimental_taintObjectReference(
        'Do not pass a Supabase service-role client to a Client Component.',
        client
      );
    } catch {
      // taint not available in this runtime; ignore
    }
  }
  return client;
}

/**
 * Maps optional camelCase identity fields from the entry to snake_case
 * DB columns. These are derived server-side but may be provided by
 * callers (e.g. API routes with authenticated sessions).
 */
function mapIdentityFields(
  entry: CreateSystemLogEntry & {
    employeeId?: string | null;
    departmentId?: string | null;
  }
): {
  employee_id: string | null;
  department_id: string | null;
} {
  const employeeId = entry.employeeId ?? null;
  const departmentId = entry.departmentId ?? null;
  return { employee_id: employeeId, department_id: departmentId };
}

export async function recordSystemLog(
  entry: CreateSystemLogEntry & {
    traceId?: string;
    requestId?: string;
    employeeId?: string | null;
    departmentId?: string | null;
    ipAddress?: string | null;
  }
): Promise<void> {
  try {
    const supabase = taintServiceClient(createServiceRoleClient());

    // Map identity fields (employee_id, department_id) from the entry.
    // These are derived server-side but may be supplied by callers with
    // authenticated sessions. If not provided, they default to null in the DB.
    const { employee_id, department_id } = mapIdentityFields(entry);

    // Build the insert payload mapping camelCase to snake_case.
    // Identity fields (employee_id, department_id, ip_address, user_agent)
    // are derived server-side and are intentionally NOT client-settable.
    // They are set here from the entry if provided, otherwise null.
    const payload: Record<string, unknown> = {
      level: entry.level,
      source: entry.source,
      category: entry.category ?? 'general',
      message: entry.message,
      stack: entry.stack ?? null,
      context: entry.context ?? {},
      url: entry.url ?? null,
      method: entry.method ?? null,
      employee_id,
      department_id,
      ip_address: entry.ipAddress ?? null,
      user_agent: null,
      resolved: false,
      resolved_at: null,
      resolved_by: null,
      created_at: new Date().toISOString(),
    };

    // Inject traceId and requestId if provided
    if (entry.traceId !== undefined) {
      payload.trace_id = entry.traceId;
    }
    if (entry.requestId !== undefined) {
      payload.request_id = entry.requestId;
    }

    const { error } = await supabase.from('system_logs').insert(payload);

    if (error) {
      // Telemetry must not crash the request that produced the error
      await serverLogger.error(
        { context: 'system_log_insert_failed' },
        `system_log_insert_failed: ${error.message}`
      );
    }
  } catch (err) {
    // Never throw from telemetry
    try {
      await serverLogger.error(
        { context: 'record_system_log_unexpected_error' },
        `record_system_log_unexpected_error: ${err instanceof Error ? err.message : String(err)}`
      );
    } catch {
      // best-effort only
    }
  }
}
