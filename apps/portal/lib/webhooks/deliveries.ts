import crypto from 'node:crypto';
import { createServiceRoleClient } from '@repo/supabase/service-role';
import { logError } from '@/lib/errors/error-logger';
import { decryptWebhookSecret } from '@/lib/integrations/crypto';
import { assertSafeResolvedUrl } from '@/lib/integrations/ssrf-guard';

const MAX_WEBHOOK_RETRIES = 5;
const WEBHOOK_REQUEST_TIMEOUT_MS = 10_000;

type QueuedDelivery = {
  id: string;
  webhook_endpoint_id: string;
  event_type: string;
  payload: unknown;
  retry_count: number;
};

type WebhookEndpoint = {
  id: string;
  url: string;
  secret: string | null;
};

type DeliverySummary = {
  processed: number;
  succeeded: number;
  failed: number;
};

function signPayload(payload: unknown, secret: string): string {
  return crypto.createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex');
}

async function fetchEndpoint(supabase: ReturnType<typeof createServiceRoleClient>, id: string) {
  const { data, error } = await supabase
    .from('webhook_endpoints')
    .select('id, url, secret')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) {
    throw error;
  }
  return data as WebhookEndpoint | null;
}

async function dispatchDelivery(
  delivery: QueuedDelivery,
  endpoint: WebhookEndpoint
): Promise<{ responseStatus: number | null; responseBody: string | null; error: string | null }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (endpoint.secret) {
    const plaintextSecret = decryptWebhookSecret(endpoint.secret);
    headers['X-Webhook-Signature'] = signPayload(delivery.payload, plaintextSecret);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), WEBHOOK_REQUEST_TIMEOUT_MS);
  try {
    await assertSafeResolvedUrl(endpoint.url);
    const response = await fetch(endpoint.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(delivery.payload),
      redirect: 'manual',
      signal: controller.signal,
    });
    return {
      responseStatus: response.status,
      responseBody: await response.text(),
      error: response.ok ? null : `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      responseStatus: null,
      responseBody: null,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Processes queued webhook deliveries created by database triggers.
 * Exposed for the Vercel cron worker and the admin retry endpoint.
 */
export async function deliverQueuedWebhooks(limit = 50): Promise<DeliverySummary> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from('webhook_delivery_logs')
    .select('id, webhook_endpoint_id, event_type, payload, retry_count')
    .eq('success', false)
    .lt('retry_count', MAX_WEBHOOK_RETRIES)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    await logError(new Error(error.message), { context: 'webhook_dispatch_query_failed' });
    throw error;
  }

  const deliveries = (data ?? []) as QueuedDelivery[];
  const endpoints = new Map<string, WebhookEndpoint>();
  const summary: DeliverySummary = { processed: 0, succeeded: 0, failed: 0 };

  for (const delivery of deliveries) {
    summary.processed += 1;
    let endpoint: WebhookEndpoint | undefined = endpoints.get(delivery.webhook_endpoint_id);
    if (!endpoint) {
      const fetched = await fetchEndpoint(supabase, delivery.webhook_endpoint_id);
      if (!fetched) {
        summary.failed += 1;
        continue;
      }
      endpoint = fetched;
      endpoints.set(endpoint.id, endpoint);
    }

    const result = await dispatchDelivery(delivery, endpoint);
    const success = result.error === null && result.responseStatus !== null;
    const retryCount = (delivery.retry_count ?? 0) + 1;

    const { error: updateError } = await supabase
      .from('webhook_delivery_logs')
      .update({
        response_status: result.responseStatus,
        response_body: result.responseBody,
        delivered_at: new Date().toISOString(),
        retry_count: retryCount,
        success,
        error_message: result.error,
      })
      .eq('id', delivery.id);

    if (updateError) {
      await logError(new Error(updateError.message), { context: 'webhook_dispatch_update_failed' });
    }

    if (success) {
      summary.succeeded += 1;
    } else {
      summary.failed += 1;
    }
  }

  return summary;
}
