/**
 * n8n Automation Engine Client
 *
 * Provides typed access to external n8n workflows and webhooks.
 *
 * RESILIENCY GUARANTEE:
 * n8n is an optional external service. If the service is unreachable or unconfigured,
 * methods equipped with optional/fallback patterns guarantee that the system backend
 * will function normally without crashing or propagating unhandled errors.
 */

export interface N8nClientConfig {
  baseUrl?: string;
  apiKey?: string;
  defaultTimeoutMs?: number;
}

export interface N8nWebhookPayload {
  event: string;
  timestamp: string;
  data: Record<string, unknown>;
}

export interface N8nExecutionResponse<T = unknown> {
  success: boolean;
  executed: boolean;
  skipped: boolean;
  source: "n8n" | "fallback" | "none";
  data?: T;
  statusCode?: number;
  error?: string;
}

export class N8nClient {
  private baseUrl: string;
  private apiKey: string;
  private defaultTimeoutMs: number;

  constructor(config?: N8nClientConfig) {
    const rawUrl =
      config?.baseUrl ||
      process.env.N8N_URL ||
      process.env.NEXT_PUBLIC_N8N_URL ||
      "http://192.168.1.79:5678";

    this.baseUrl = rawUrl.replace(/\/+$/, "");
    this.apiKey = config?.apiKey || process.env.N8N_API_KEY || "";
    this.defaultTimeoutMs = config?.defaultTimeoutMs ?? 3000;
  }

  /**
   * Returns whether n8n endpoint is configured in environment.
   */
  isConfigured(): boolean {
    const url = process.env.N8N_URL || process.env.NEXT_PUBLIC_N8N_URL;
    return typeof url === "string" && url.trim().length > 0;
  }

  /**
   * Health check returning reachability status.
   */
  async checkHealth(timeoutMs = 2500): Promise<{
    status: "healthy" | "degraded" | "unavailable";
    optional: true;
    latencyMs: number;
    statusCode: number | null;
    error?: string;
  }> {
    const startTime = Date.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const res = await fetch(`${this.baseUrl}/healthz`, {
        method: "GET",
        signal: controller.signal,
      }).finally(() => clearTimeout(timeoutId));

      const latencyMs = Date.now() - startTime;
      if (res.ok) {
        return {
          status: "healthy",
          optional: true,
          latencyMs,
          statusCode: res.status,
        };
      }
      return {
        status: "degraded",
        optional: true,
        latencyMs,
        statusCode: res.status,
        error: `HTTP ${res.status}`,
      };
    } catch (err: unknown) {
      const latencyMs = Date.now() - startTime;
      return {
        status: "unavailable",
        optional: true,
        latencyMs,
        statusCode: null,
        error: err instanceof Error ? err.message : "Connection failed",
      };
    }
  }

  /**
   * Triggers an n8n webhook or workflow endpoint optionally.
   * If n8n fails or is unreachable, executes fallback if provided;
   * otherwise returns a skipped result so backend operations proceed uninterrupted.
   */
  async triggerOptional<T = unknown>(
    pathOrUrl: string,
    payload: unknown,
    options?: {
      fallback?: () => Promise<T> | T;
      timeoutMs?: number;
    }
  ): Promise<N8nExecutionResponse<T>> {
    const timeoutMs = options?.timeoutMs ?? this.defaultTimeoutMs;
    const targetUrl =
      pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")
        ? pathOrUrl
        : `${this.baseUrl}/${pathOrUrl.replace(/^\/+/, "")}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "application/json",
      };

      if (this.apiKey) {
        headers["X-N8N-API-KEY"] = this.apiKey;
      }

      const response = await fetch(targetUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      }).finally(() => clearTimeout(timeoutId));

      if (!response.ok) {
        throw new Error(`n8n responded with status ${response.status}`);
      }

      let data: T;
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        data = (await response.json()) as T;
      } else {
        data = (await response.text()) as unknown as T;
      }

      return {
        success: true,
        executed: true,
        skipped: false,
        source: "n8n",
        data,
        statusCode: response.status,
      };
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "n8n dispatch failed";

      if (options?.fallback) {
        try {
          const fallbackData = await options.fallback();
          return {
            success: true,
            executed: false,
            skipped: true,
            source: "fallback",
            data: fallbackData,
            error: errorMessage,
          };
        } catch (fbErr: unknown) {
          const fbMsg = fbErr instanceof Error ? fbErr.message : String(fbErr);
          return {
            success: false,
            executed: false,
            skipped: true,
            source: "fallback",
            error: `${errorMessage}; Fallback failed: ${fbMsg}`,
          };
        }
      }

      return {
        success: false,
        executed: false,
        skipped: true,
        source: "none",
        error: errorMessage,
      };
    }
  }
}

/**
 * Singleton client instance initialized with environment variables.
 */
export const n8nClient = new N8nClient();
