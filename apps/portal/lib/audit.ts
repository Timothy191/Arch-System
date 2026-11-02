import { type AuditLogInput, logAuditEvent as persistAuditEvent } from '@repo/shared/data-access';
import { after } from 'next/server';

export async function logAuditEvent(input: AuditLogInput): Promise<void> {
  try {
    after(async () => {
      await persistAuditEvent(input);
    });
  } catch {
    // Fallback when called outside a Next.js request scope (e.g. Jest tests, background jobs)
    await persistAuditEvent(input);
  }
}
