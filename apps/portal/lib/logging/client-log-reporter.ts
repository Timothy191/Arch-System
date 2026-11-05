/**
 * Client-side reporter for system logs.
 *
 * Posts structured entries to POST /api/logs so browser runtime errors,
 * CSP violations surfaced client-side, and circuit-breaker events land in
 * public.system_logs for the Administration "System Logs" console.
 *
 * Safe to call from any client component: no-ops during SSR, never throws,
 * and uses keepalive so reports survive page unload.
 */

import type { CreateSystemLogEntry } from '@repo/contract';

const LOGS_ENDPOINT = '/api/logs';

export function reportClientLog(entry: CreateSystemLogEntry): void {
  if (typeof window === 'undefined') return;

  try {
    void fetch(LOGS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
      keepalive: true,
    }).catch(() => {
      // Telemetry must never surface errors to the user.
    });
  } catch {
    // Serialization or fetch construction failed — ignore.
  }
}
