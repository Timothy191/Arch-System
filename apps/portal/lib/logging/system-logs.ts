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

import type { CreateSystemLogEntry, SystemLogSource } from '@repo/contract';
import { serverLogger } from '@repo/logger';
import { createServiceRoleClient } from '@repo/supabase/service-role';

export interface RecordSystemLogInput extends CreateSystemLogEntry {
  employeeId?: string | null;
  departmentId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export async function recordSystemLog(input: RecordSystemLogInput): Promise<void> {
  // Skip silently when no Supabase backend is configured (local dev, tests) —
  // missing telemetry infrastructure is not itself a warn-worthy event.
  const hasBackend =
    (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    (process.env.SUPABASE_SECRET_KEY ??
      process.env.SUPABASE_SERVICE_ROLE_KEY ??
      process.env.SUPABASE_SERVICE_KEY);
  if (!hasBackend) return;

  try {
    const serviceRole = createServiceRoleClient();
    const { error } = await serviceRole.from('system_logs').insert({
      level: input.level,
      source: input.source,
      category: input.category,
      message: input.message.slice(0, 2000),
      stack: input.stack ?? null,
      context: input.context ?? {},
      url: input.url ?? null,
      method: input.method ?? null,
      employee_id: input.employeeId ?? null,
      department_id: input.departmentId ?? null,
      ip_address: input.ipAddress ?? null,
      user_agent: input.userAgent ?? null,
    });

    if (error) {
      serverLogger.warn(
        { err: error.message, source: input.source, category: input.category },
        'Failed to persist system log entry'
      );
    }
  } catch (persistError) {
    serverLogger.warn(
      {
        err: persistError instanceof Error ? persistError.message : String(persistError),
        source: input.source,
      },
      'System log persistence unavailable'
    );
  }
}

/**
 * Convenience wrapper for caught errors: extracts message/stack and records
 * them under the given source/category.
 */
export async function recordCaughtError(
  error: unknown,
  meta: {
    source: SystemLogSource;
    category?: string;
    url?: string;
    method?: string;
    context?: Record<string, unknown>;
    employeeId?: string | null;
    departmentId?: string | null;
    ipAddress?: string | null;
    userAgent?: string | null;
  }
): Promise<void> {
  const isError = error instanceof Error;
  const plain = (error ?? {}) as Record<string, unknown>;
  await recordSystemLog({
    level: 'error',
    source: meta.source,
    category: meta.category ?? 'runtime',
    message: isError ? error.message : String(plain.message ?? error),
    stack: isError ? error.stack : (plain.stack as string | undefined),
    context: { ...(meta.context ?? {}), errorName: isError ? error.name : undefined },
    url: meta.url,
    method: meta.method,
    employeeId: meta.employeeId,
    departmentId: meta.departmentId,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });
}
