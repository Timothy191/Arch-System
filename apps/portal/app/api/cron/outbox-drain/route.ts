/**
 * @swagger
 * /api/cron/outbox-drain:
 *   post:
 *     summary: Drain the SCADA Outbox
 *     description: Iterates through the control_room_outbox queue to apply degraded writes with exponential backoff and DLQ logic.
 */

import { createServerSupabaseClient } from '@repo/supabase/server';
import { NextResponse } from 'next/server';
import { logError } from '@/lib/errors/error-logger';
import { addEvent, withAsyncSpan } from '@/lib/observability/tracing';

export async function POST(req: Request) {
  return withAsyncSpan('cron_outbox_drain', {}, async () => {
    try {
      // Security: Validate cron secret
      const authHeader = req.headers.get('Authorization');
      if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const supabase = await createServerSupabaseClient();

      // Fetch pending outbox items (max 50 to prevent timeout)
      const { data: pending, error } = await supabase
        .from('control_room_outbox')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(50);

      if (error) throw new Error(error.message);

      if (!pending || pending.length === 0) {
        return NextResponse.json({ status: 'ok', processed: 0 });
      }

      let processedCount = 0;
      let dlqCount = 0;

      for (const item of pending) {
        const nextAttempt = new Date(item.next_attempt_at).getTime();
        if (Date.now() < nextAttempt) continue; // Exponential backoff not yet expired

        try {
          // Attempt the SCADA write (Simulated here)
          const fuxaUrl = process.env.NEXT_PUBLIC_FUXA_URL || 'http://localhost:1881';
          const res = await fetch(`${fuxaUrl}/api/${item.target_entity}`, {
            method: item.operation,
            body: JSON.stringify(item.payload),
            headers: { 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(2000),
          });

          if (!res.ok) throw new Error(`SCADA rejected write: ${res.status}`);

          // Success: Mark completed
          await supabase
            .from('control_room_outbox')
            .update({ status: 'completed', processed_at: new Date().toISOString() })
            .eq('id', item.id);

          processedCount++;
        } catch (writeErr: any) {
          logError(writeErr, { context: 'outbox_drain_item_fail', id: item.id });

          const newAttempts = item.attempts + 1;
          const status = newAttempts >= 5 ? 'failed' : 'pending';
          if (status === 'failed') dlqCount++;

          // Exponential backoff: 2s, 4s, 8s, 16s...
          const backoffDelay = 2 ** newAttempts * 1000;
          const nextAttemptTime = new Date(Date.now() + backoffDelay).toISOString();

          await supabase
            .from('control_room_outbox')
            .update({
              status,
              attempts: newAttempts,
              last_error: writeErr.message,
              next_attempt_at: nextAttemptTime,
            })
            .eq('id', item.id);
        }
      }

      addEvent('outbox_drain_complete', { processed: processedCount, failed: dlqCount });
      return NextResponse.json({ status: 'ok', processed: processedCount, failed: dlqCount });
    } catch (err: any) {
      logError(err, { context: 'cron_outbox_drain_fatal' });
      return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
  });
}
