import {
  APIError,
  AuthError,
  FetchTimeoutError,
  ForbiddenError,
  NetworkError,
  NotFoundError,
  RateLimitError,
  ValidationError,
} from "@repo/errors";
import { offlineStorage, type QueuedFetchRequest } from "./offline-storage";

export interface FetchClientOptions {
  /**
   * Base URL to prepended to relative request paths.
   */
  baseURL?: string;
  /**
   * Default timeout per request in milliseconds.
   * @default 10000 (10 seconds)
   */
  timeoutMs?: number;
  /**
   * Maximum number of retry attempts for transient failures.
   * @default 3
   */
  maxRetries?: number;
  /**
   * Initial backoff delay in milliseconds.
   * @default 300
   */
  initialDelayMs?: number;
  /**
   * Maximum backoff delay in milliseconds.
   * @default 5000
   */
  maxDelayMs?: number;
  /**
   * Backoff multiplier per attempt.
   * @default 2
   */
  backoffFactor?: number;
  /**
   * Enable full jitter for backoff calculations to avoid thundering herds.
   * @default true
   */
  jitter?: boolean;
  /**
   * HTTP status codes that trigger a retry.
   * @default [408, 429, 502, 503, 504]
   */
  retryStatusCodes?: number[];
  /**
   * Enable retries for non-idempotent methods (POST, PATCH).
   * @default false
   */
  retryOnPost?: boolean;
  /**
   * Automatically flush offline queue on browser 'online' event.
   * @default true
   */
  autoFlushOffline?: boolean;
  /**
   * Request / Response interceptors.
   */
  interceptors?: {
    onRequest?: (url: string, init: RequestInit) => RequestInit | Promise<RequestInit>;
    onResponse?: (response: Response) => Response | Promise<Response>;
  };
}

export interface RequestOptions extends RequestInit {
  timeoutMs?: number;
  maxRetries?: number;
  retryOnPost?: boolean;
  parseJson?: boolean;
  offlineQueue?: boolean;
  offlineCache?: boolean;
  idempotencyKey?: string;
  description?: string;
}

const IDEMPOTENT_METHODS = new Set(["GET", "HEAD", "PUT", "DELETE", "OPTIONS"]);
const DEFAULT_RETRY_STATUSES = new Set([408, 429, 502, 503, 504]);

export class FetchClient {
  private config: Required<Omit<FetchClientOptions, "baseURL" | "interceptors">> & {
    baseURL?: string;
    retryStatusCodesSet: Set<number>;
    interceptors: FetchClientOptions["interceptors"];
  };
  private isFlushingQueue = false;

  constructor(options: FetchClientOptions = {}) {
    this.config = {
      baseURL: options.baseURL,
      timeoutMs: options.timeoutMs ?? 10000,
      maxRetries: options.maxRetries ?? 3,
      initialDelayMs: options.initialDelayMs ?? 300,
      maxDelayMs: options.maxDelayMs ?? 5000,
      backoffFactor: options.backoffFactor ?? 2,
      jitter: options.jitter ?? true,
      retryStatusCodes: options.retryStatusCodes ?? Array.from(DEFAULT_RETRY_STATUSES),
      retryStatusCodesSet: new Set(options.retryStatusCodes ?? Array.from(DEFAULT_RETRY_STATUSES)),
      retryOnPost: options.retryOnPost ?? false,
      autoFlushOffline: options.autoFlushOffline ?? true,
      interceptors: options.interceptors,
    };

    if (
      this.config.autoFlushOffline &&
      typeof window !== "undefined" &&
      typeof window.addEventListener === "function"
    ) {
      window.addEventListener("online", () => {
        this.flushOfflineQueue().catch(() => {});
      });
    }
  }

  private resolveUrl(path: string): string {
    if (!this.config.baseURL || /^https?:\/\//i.test(path)) {
      return path;
    }
    const base = this.config.baseURL.replace(/\/+$/, "");
    const target = path.replace(/^\/+/, "");
    return `${base}/${target}`;
  }

  private calculateBackoffDelay(attempt: number): number {
    const rawDelay = this.config.initialDelayMs * Math.pow(this.config.backoffFactor, attempt);
    const cappedDelay = Math.min(rawDelay, this.config.maxDelayMs);
    if (!this.config.jitter) {
      return cappedDelay;
    }
    return Math.floor(Math.random() * cappedDelay);
  }

  private isRetryable(
    error: unknown,
    response: Response | null,
    method: string,
    retryOnPostOverride?: boolean,
  ): boolean {
    const isIdempotent = IDEMPOTENT_METHODS.has(method.toUpperCase());
    const allowRetry = isIdempotent || (retryOnPostOverride ?? this.config.retryOnPost);

    if (!allowRetry) {
      return false;
    }

    if (response) {
      return this.config.retryStatusCodesSet.has(response.status);
    }

    if (error instanceof FetchTimeoutError || error instanceof NetworkError) {
      return true;
    }

    if (error instanceof TypeError && error.message.includes("fetch")) {
      return true;
    }

    return false;
  }

  public async fetch(url: string, options: RequestOptions = {}): Promise<Response> {
    const fullUrl = this.resolveUrl(url);
    const method = (options.method || "GET").toUpperCase();
    const timeoutMs = options.timeoutMs ?? this.config.timeoutMs;
    const maxRetries = options.maxRetries ?? this.config.maxRetries;

    let attempt = 0;

    while (attempt <= maxRetries) {
      const controller = new AbortController();
      let timedOut = false;

      const timer = setTimeout(() => {
        timedOut = true;
        controller.abort("TIMEOUT");
      }, timeoutMs);

      const externalSignal = options.signal;
      const onExternalAbort = () => controller.abort(externalSignal?.reason);

      if (externalSignal) {
        if (externalSignal.aborted) {
          controller.abort(externalSignal.reason);
        } else {
          externalSignal.addEventListener("abort", onExternalAbort);
        }
      }

      let requestInit: RequestInit = {
        ...options,
        method,
        signal: controller.signal,
      };

      if (this.config.interceptors?.onRequest) {
        requestInit = await this.config.interceptors.onRequest(fullUrl, requestInit);
      }

      let response: Response | null = null;
      let caughtError: unknown = null;

      try {
        response = await fetch(fullUrl, requestInit);
        clearTimeout(timer);

        if (externalSignal) {
          externalSignal.removeEventListener("abort", onExternalAbort);
        }

        if (this.config.interceptors?.onResponse) {
          response = await this.config.interceptors.onResponse(response);
        }

        if (response.ok) {
          return response;
        }

        const error = await this.parseHttpError(response, fullUrl, method);

        if (
          attempt < maxRetries &&
          this.isRetryable(error, response, method, options.retryOnPost)
        ) {
          attempt++;
          const delay = this.calculateBackoffDelay(attempt);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        throw error;
      } catch (err) {
        clearTimeout(timer);
        if (externalSignal) {
          externalSignal.removeEventListener("abort", onExternalAbort);
        }

        if (timedOut) {
          caughtError = new FetchTimeoutError(`Request timed out after ${timeoutMs}ms`, {
            timeoutMs,
            url: fullUrl,
            method,
            cause: err instanceof Error ? err : undefined,
          });
        } else if (err instanceof TypeError && err.message.includes("fetch")) {
          caughtError = new NetworkError(
            `Network error when requesting ${fullUrl}: ${err.message}`,
            { url: fullUrl, method, cause: err },
          );
        } else {
          caughtError = err;
        }

        if (
          attempt < maxRetries &&
          this.isRetryable(caughtError, response, method, options.retryOnPost)
        ) {
          attempt++;
          const delay = this.calculateBackoffDelay(attempt);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        // Handle offline queueing for mutations when requested or network error occurs
        if (
          options.offlineQueue &&
          (caughtError instanceof NetworkError || caughtError instanceof FetchTimeoutError) &&
          method !== "GET"
        ) {
          const idempotencyKey = options.idempotencyKey || crypto.randomUUID();
          let bodyStr: string | undefined;
          if (typeof options.body === "string") {
            bodyStr = options.body;
          }

          const headersObj: Record<string, string> = {
            "X-Idempotency-Key": idempotencyKey,
          };
          if (options.headers) {
            const h = new Headers(options.headers);
            h.forEach((v, k) => {
              headersObj[k] = v;
            });
          }

          await offlineStorage.enqueue({
            idempotencyKey,
            url: fullUrl,
            method,
            headers: headersObj,
            body: bodyStr,
            description: options.description || `${method} ${url}`,
          });

          throw new NetworkError(
            `Connection lost. Request enqueued offline for replay (${idempotencyKey})`,
            { url: fullUrl, method, enqueued: true, idempotencyKey },
          );
        }

        throw caughtError;
      }
    }

    throw new NetworkError(`Request failed after ${maxRetries} retry attempts`, {
      url: fullUrl,
      method,
    });
  }

  private async parseHttpError(response: Response, url: string, method: string): Promise<APIError> {
    let body: any = null;
    let message = `HTTP ${response.status} ${response.statusText}`;

    try {
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        body = await response.json();
        if (body && typeof body === "object" && body.message) {
          message = body.message;
        }
      } else {
        const text = await response.text();
        if (text) message = text;
      }
    } catch {
      // Ignore body parsing failures for error response
    }

    const context = { url, method, body, status: response.status };

    switch (response.status) {
      case 400:
        return new ValidationError(message, { context });
      case 401:
        return new AuthError(message, { context });
      case 403:
        return new ForbiddenError(message, { context });
      case 404:
        return new NotFoundError(message, { context });
      case 429:
        return new RateLimitError(message, { context });
      default:
        return new APIError(message, { statusCode: response.status, context });
    }
  }

  public async request<T = unknown>(url: string, options: RequestOptions = {}): Promise<T> {
    const isGet = (options.method || "GET").toUpperCase() === "GET";
    const cacheKey = `GET:${this.resolveUrl(url)}`;

    try {
      const res = await this.fetch(url, options);
      if (options.parseJson === false) {
        const text = (await res.text()) as unknown as T;
        if (isGet && options.offlineCache) {
          await offlineStorage.cacheResponse(cacheKey, text);
        }
        return text;
      }
      const data = (await res.json()) as T;
      if (isGet && options.offlineCache) {
        await offlineStorage.cacheResponse(cacheKey, data);
      }
      return data;
    } catch (err) {
      if (
        isGet &&
        (options.offlineCache || err instanceof NetworkError || err instanceof FetchTimeoutError)
      ) {
        const cached = await offlineStorage.getCachedResponse<T>(cacheKey);
        if (cached !== null) {
          return cached;
        }
      }
      throw err;
    }
  }

  public async get<T = unknown>(url: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(url, { ...options, method: "GET" });
  }

  public async post<T = unknown>(
    url: string,
    body?: unknown,
    options?: RequestOptions,
  ): Promise<T> {
    const isJsonBody = body !== undefined && !(body instanceof FormData) && !(body instanceof Blob);
    const headers = new Headers(options?.headers);
    if (isJsonBody && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    return this.request<T>(url, {
      ...options,
      method: "POST",
      headers,
      body: isJsonBody ? JSON.stringify(body) : (body as BodyInit | null),
    });
  }

  public async put<T = unknown>(url: string, body?: unknown, options?: RequestOptions): Promise<T> {
    const isJsonBody = body !== undefined && !(body instanceof FormData) && !(body instanceof Blob);
    const headers = new Headers(options?.headers);
    if (isJsonBody && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    return this.request<T>(url, {
      ...options,
      method: "PUT",
      headers,
      body: isJsonBody ? JSON.stringify(body) : (body as BodyInit | null),
    });
  }

  public async patch<T = unknown>(
    url: string,
    body?: unknown,
    options?: RequestOptions,
  ): Promise<T> {
    const isJsonBody = body !== undefined && !(body instanceof FormData) && !(body instanceof Blob);
    const headers = new Headers(options?.headers);
    if (isJsonBody && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    return this.request<T>(url, {
      ...options,
      method: "PATCH",
      headers,
      body: isJsonBody ? JSON.stringify(body) : (body as BodyInit | null),
    });
  }

  public async delete<T = unknown>(url: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(url, { ...options, method: "DELETE" });
  }

  public async flushOfflineQueue(): Promise<{ synced: number; failed: number }> {
    if (this.isFlushingQueue) return { synced: 0, failed: 0 };
    this.isFlushingQueue = true;

    let synced = 0;
    let failed = 0;

    try {
      const pending = await offlineStorage.getPending();
      for (const req of pending) {
        if (!req.id) continue;
        try {
          await offlineStorage.updateStatus(req.id, "processing");
          const headers = new Headers(req.headers);
          if (!headers.has("X-Idempotency-Key")) {
            headers.set("X-Idempotency-Key", req.idempotencyKey);
          }

          const res = await this.fetch(req.url, {
            method: req.method,
            headers,
            body: req.body,
            maxRetries: 1,
            offlineQueue: false,
          });

          if (res.ok) {
            await offlineStorage.remove(req.id);
            synced++;
          } else {
            await offlineStorage.updateStatus(req.id, "failed", `HTTP ${res.status}`);
            failed++;
          }
        } catch (err: any) {
          await offlineStorage.updateStatus(req.id, "failed", err?.message || "Replay failed");
          failed++;
        }
      }
    } finally {
      this.isFlushingQueue = false;
    }

    return { synced, failed };
  }
}

export function createFetchClient(options?: FetchClientOptions): FetchClient {
  return new FetchClient(options);
}

export const fetchClient = new FetchClient();
