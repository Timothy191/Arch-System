/**
 * Resilient, Optional n8n Integration Utilities
 *
 * In accordance with Arch-System resiliency standards, all n8n integrations
 * are strictly OPTIONAL. If n8n is offline, unconfigured, unreachable, or
 * experiences runtime errors, these functions absorb the failure, optionally
 * execute a local fallback handler, and allow the system backend to continue
 * operating normally.
 */

export interface N8nHealthOptions {
  url?: string;
  timeoutMs?: number;
}

export interface N8nHealthResult {
  status: 'healthy' | 'degraded' | 'unavailable';
  optional: true;
  latencyMs: number;
  url: string;
  statusCode: number | null;
  error?: string;
}

export interface TriggerN8nOptions<TResponse> {
  baseUrl?: string;
  apiKey?: string;
  timeoutMs?: number;
  fallback?: () => Promise<TResponse> | TResponse;
}

export interface TriggerN8nResult<TResponse> {
  success: boolean;
  executed: boolean;
  skipped: boolean;
  source: 'n8n' | 'fallback' | 'none';
  data?: TResponse;
  statusCode?: number;
  error?: string;
}

export interface OptionalActionResult<T> {
  success: boolean;
  source: 'n8n' | 'fallback';
  data: T;
  error?: string;
}

/**
 * Returns the resolved base URL for the n8n automation engine.
 */
export function getN8nBaseUrl(overrideUrl?: string): string {
  if (overrideUrl && overrideUrl.trim().length > 0) {
    return overrideUrl.replace(/\/+$/, '');
  }

  const envUrl =
    process.env.N8N_URL || process.env.NEXT_PUBLIC_N8N_URL || 'http://192.168.1.79:5678';

  return envUrl.replace(/\/+$/, '');
}

/**
 * Checks if an n8n endpoint URL or environment configuration is present.
 */
export function isN8nConfigured(): boolean {
  const url = process.env.N8N_URL || process.env.NEXT_PUBLIC_N8N_URL;
  return typeof url === 'string' && url.trim().length > 0;
}

/**
 * Probes the n8n service health endpoint without throwing.
 * Always returns optional: true.
 */
export async function checkN8nHealth(options: N8nHealthOptions = {}): Promise<N8nHealthResult> {
  const startTime = Date.now();
  const url = getN8nBaseUrl(options.url);
  const healthEndpoint = `${url}/healthz`;
  const timeoutMs = options.timeoutMs ?? 2500;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(healthEndpoint, {
      method: 'GET',
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));

    const latencyMs = Date.now() - startTime;

    if (response.ok) {
      return {
        status: 'healthy',
        optional: true,
        latencyMs,
        url,
        statusCode: response.status,
      };
    }

    return {
      status: 'degraded',
      optional: true,
      latencyMs,
      url,
      statusCode: response.status,
      error: `n8n returned HTTP status ${response.status}`,
    };
  } catch (err: unknown) {
    const latencyMs = Date.now() - startTime;
    const errorMessage = err instanceof Error ? err.message : 'n8n connection failed or timed out';

    return {
      status: 'unavailable',
      optional: true,
      latencyMs,
      url,
      statusCode: null,
      error: errorMessage,
    };
  }
}

/**
 * Dispatches an event payload or triggers an n8n workflow.
 *
 * If n8n is unreachable, times out, or fails:
 * - Does NOT throw.
 * - Executes the provided fallback handler if present.
 * - Returns a structured result so the backend continues normal operations.
 */
export async function triggerN8nWorkflow<TPayload, TResponse = unknown>(
  endpointOrWebhookPath: string,
  payload: TPayload,
  options: TriggerN8nOptions<TResponse> = {}
): Promise<TriggerN8nResult<TResponse>> {
  const baseUrl = getN8nBaseUrl(options.baseUrl);
  const timeoutMs = options.timeoutMs ?? 3000;
  const apiKey = options.apiKey || process.env.N8N_API_KEY;

  // Construct target URL
  const targetUrl =
    endpointOrWebhookPath.startsWith('http://') || endpointOrWebhookPath.startsWith('https://')
      ? endpointOrWebhookPath
      : `${baseUrl}/${endpointOrWebhookPath.replace(/^\/+/, '')}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    if (apiKey) {
      headers['X-N8N-API-KEY'] = apiKey;
    }

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));

    if (!response.ok) {
      throw new Error(`n8n responded with status ${response.status}`);
    }

    let responseData: TResponse;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      responseData = (await response.json()) as TResponse;
    } else {
      responseData = (await response.text()) as unknown as TResponse;
    }

    return {
      success: true,
      executed: true,
      skipped: false,
      source: 'n8n',
      data: responseData,
      statusCode: response.status,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'n8n workflow dispatch failed';

    // Non-blocking fallback execution
    if (options.fallback) {
      try {
        const fallbackData = await options.fallback();
        return {
          success: true,
          executed: false,
          skipped: true,
          source: 'fallback',
          data: fallbackData,
          error: errorMsg,
        };
      } catch (fallbackErr: unknown) {
        const fallbackMsg =
          fallbackErr instanceof Error ? fallbackErr.message : 'Fallback handler threw an error';
        return {
          success: false,
          executed: false,
          skipped: true,
          source: 'fallback',
          error: `${errorMsg}; Fallback failed: ${fallbackMsg}`,
        };
      }
    }

    // No fallback provided: safely absorb and report skipped
    return {
      success: false,
      executed: false,
      skipped: true,
      source: 'none',
      error: errorMsg,
    };
  }
}

/**
 * Wraps an asynchronous action targeting n8n with an optional fallback.
 * If the primary action throws, the fallback is executed, ensuring normal backend operation.
 */
export async function executeOptionalN8nAction<T>(
  action: () => Promise<T>,
  fallback: () => Promise<T> | T
): Promise<OptionalActionResult<T>> {
  try {
    const result = await action();
    return {
      success: true,
      source: 'n8n',
      data: result,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'n8n action execution failed';
    const fallbackResult = await fallback();
    return {
      success: true,
      source: 'fallback',
      data: fallbackResult,
      error: errorMsg,
    };
  }
}
