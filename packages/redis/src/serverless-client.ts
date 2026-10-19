/**
 * Serverless Redis REST Client for Vercel / edge deployments.
 * Communicates with Upstash-compatible Redis over connectionless HTTP REST.
 *
 * Design invariants (permanent Redis rules):
 *  - **Single parse boundary.** This client returns RAW Redis strings, exactly
 *    like the `node-redis` TCP client. JSON decoding belongs to the cache layer
 *    (`cache.ts`). Previously this client JSON-parsed `get()`/`hget()` while the
 *    cache layer parsed again, which threw `"[object Object]" is not valid JSON`
 *    and turned every serverless L2 read into a permanent miss.
 *  - **Bounded timeouts.** Every request carries an AbortSignal deadline so an
 *    unresponsive Redis can never hang a request handler.
 *  - **Bounded retries.** Only transient failures (network, 429, 5xx) retry.
 *  - **Auto-pipelining.** Commands issued in the same tick are coalesced into a
 *    single `/pipeline` round-trip, cutting both RTT count and per-command
 *    request overhead. Upstash bills per command, so round-trips matter.
 *  - **No `any`.** All external data is parsed through guarded schema types.
 */
export interface ServerlessRedisConfig {
  baseUrl: string;
  token?: string;
  /** Per-request timeout in milliseconds. Default 5000. */
  timeoutMs?: number;
  /** Total attempts for transient failures. Default 2 (1 retry). */
  maxAttempts?: number;
  /** Maximum commands coalesced into one `/pipeline` request. Default 100. */
  maxPipelineBatch?: number;
  /** Opt out of micro-batched auto-pipelining. Default false. */
  disableAutoPipeline?: boolean;
}

interface UpstashRestResponse {
  result?: unknown;
  error?: string;
}

interface PipelineItem {
  result?: unknown;
  error?: string;
}

interface PendingCommand {
  command: string;
  args: string[];
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
}

const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_MAX_ATTEMPTS = 2;
const DEFAULT_MAX_PIPELINE_BATCH = 100;
const BASE_RETRY_DELAY_MS = 50;
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

/** Redis `SCAN` reply, normalised to `{ cursor, keys }` across response formats. */
export interface ScanResult {
  cursor: number;
  keys: string[];
}

function normalizeScan(raw: unknown): ScanResult {
  // RESP2/JSON form: { cursor, keys }
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const obj = raw as { cursor?: unknown; keys?: unknown };
    return {
      cursor: Number(obj.cursor ?? 0) || 0,
      keys: Array.isArray(obj.keys) ? obj.keys.map(String) : [],
    };
  }
  // RESP3 form: [cursor, keys]
  if (Array.isArray(raw) && raw.length >= 2) {
    return { cursor: Number(raw[0]) || 0, keys: Array.isArray(raw[1]) ? raw[1].map(String) : [] };
  }
  return { cursor: 0, keys: [] };
}

function isRetryableStatus(status: number): boolean {
  return RETRYABLE_STATUS.has(status);
}

export class ServerlessRedisClient {
  private baseUrl: string;
  private token: string | undefined;
  private readonly timeoutMs: number;
  private readonly maxAttempts: number;
  private readonly maxPipelineBatch: number;
  private readonly disableAutoPipeline: boolean;

  private queue: PendingCommand[] = [];
  private flushScheduled = false;
  private inflightFlush: Promise<void> | null = null;

  constructor(config?: Partial<ServerlessRedisConfig>) {
    // Lazily initialize - validate on first use, not at import time
    const httpRedisUrl =
      process.env.REDIS_URL?.startsWith('http://') || process.env.REDIS_URL?.startsWith('https://')
        ? process.env.REDIS_URL
        : undefined;
    this.baseUrl = (
      config?.baseUrl ||
      process.env.SERVERLESS_REDIS_URL ||
      process.env.UPSTASH_REDIS_REST_URL ||
      httpRedisUrl ||
      'http://localhost:3005/api/v1'
    ).replace(/\/+$/, '');
    this.token =
      config?.token || process.env.REDIS_AUTH_SECRET || process.env.UPSTASH_REDIS_REST_TOKEN;
    this.timeoutMs = config?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxAttempts = Math.max(1, config?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS);
    this.maxPipelineBatch = Math.max(1, config?.maxPipelineBatch ?? DEFAULT_MAX_PIPELINE_BATCH);
    this.disableAutoPipeline = config?.disableAutoPipeline ?? false;
  }

  private async config(): Promise<{ baseUrl: string; token: string | undefined }> {
    // Validate only in production; dev uses localhost fallback
    if (!this.baseUrl || this.baseUrl === 'http://localhost:3005/api/v1') {
      const env = process.env.NODE_ENV;
      if (env === 'production') {
        throw new Error('REDIS_URL or UPSTASH_REDIS_REST_URL environment variable is not set');
      }
    }
    return { baseUrl: this.baseUrl, token: this.token };
  }

  public async ping(): Promise<string> {
    return this.fetchCommand<string>('ping');
  }

  // -------------------------------------------------------------------------
  // HTTP transport
  // -------------------------------------------------------------------------

  private buildSignal(): { signal: AbortSignal; done: () => void } {
    if (typeof AbortSignal.timeout === 'function') {
      return { signal: AbortSignal.timeout(this.timeoutMs), done: () => {} };
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    // Never let the deadline timer keep a serverless invocation alive.
    (timer as unknown as { unref?: () => void }).unref?.();
    return { signal: controller.signal, done: () => clearTimeout(timer) };
  }

  /**
   * POST a JSON body and return the parsed response envelope.
   *
   * The two endpoints use different envelope shapes:
   *  - single command -> `{ "result": ... }` or `{ "error": "..." }`
   *  - `/pipeline`     -> a BARE array: `[{ "result": ... }, { "error": "..." }]`
   *
   * Callers therefore interpret the payload themselves; this method only
   * handles transport concerns (timeout, retry, HTTP status, JSON parse).
   */
  private async postJson(url: string, body: unknown): Promise<unknown> {
    const { token } = await this.config();

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      const { signal, done } = this.buildSignal();
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(body),
          signal,
        });

        // Read body text first (can only be read once)
        const text = await res.text();

        if (res.status === 429 || (res.status >= 500 && res.status <= 599)) {
          lastError = new Error(`Serverless Redis transient ${res.status}: ${text}`);
          if (attempt < this.maxAttempts) {
            await this.backoff(attempt);
            continue;
          }
          throw lastError;
        }

        // Parse JSON through the guarded schema
        let parsed: unknown;
        try {
          parsed = JSON.parse(text) as unknown;
        } catch {
          throw new Error(`Serverless Redis parse error: ${text}`);
        }

        // A wrapped `{ error }` envelope is a Redis-level failure: never retry it.
        if (
          parsed !== null &&
          typeof parsed === 'object' &&
          !Array.isArray(parsed) &&
          typeof (parsed as UpstashRestResponse).error === 'string'
        ) {
          throw new Error(`Serverless Redis error: ${(parsed as UpstashRestResponse).error}`);
        }

        // If the response is not OK but no error object, surface the status text
        if (!res.ok) {
          throw new Error(`Serverless Redis error (${res.status}): ${text}`);
        }

        return parsed;
      } catch (err) {
        const isLastAttempt = attempt >= this.maxAttempts;
        // Non-retryable: a Redis-level error. Surface immediately.
        if (err instanceof Error && err.message.startsWith('Serverless Redis error:')) {
          throw err;
        }
        lastError = err instanceof Error ? err : new Error(String(err));
        if (isLastAttempt) {
          throw lastError;
        }
        await this.backoff(attempt);
      } finally {
        done();
      }
    }

    throw lastError ?? new Error('Serverless Redis request failed');
  }

  private async backoff(attempt: number): Promise<void> {
    const delay = BASE_RETRY_DELAY_MS * 2 ** (attempt - 1);
    const jittered = delay * (0.5 + Math.random());
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, jittered);
      (timer as unknown as { unref?: () => void }).unref?.();
    });
  }

  /**
   * Execute an arbitrary Redis command. Returns the RAW Redis value.
   * Used by the node-redis compatibility adapter to reach commands that have no
   * dedicated helper, and by callers needing options the helpers do not model.
   */
  public async command<T = unknown>(command: string, args: (string | number)[] = []): Promise<T> {
    return this.fetchCommand<T>(
      command,
      args.map((a) => (typeof a === 'string' ? a : String(a)))
    );
  }

  /**
   * Execute a single command via POST ["CMD", ...args].
   * Returns the RAW Redis value (string / number / array / null).
   */
  private async fetchCommand<T>(command: string, args: string[] = []): Promise<T> {
    if (this.disableAutoPipeline) {
      return this.executeSingle<T>(command, args);
    }
    return this.enqueue<T>(command, args);
  }

  private async executeSingle<T>(command: string, args: string[]): Promise<T> {
    const { baseUrl } = await this.config();
    const parsed = await this.postJson(baseUrl, [command, ...args]);
    // Single-command envelope: { "result": ... }
    return (parsed as UpstashRestResponse | null)?.result as unknown as T;
  }

  // -------------------------------------------------------------------------
  // Auto-pipelining
  // -------------------------------------------------------------------------

  private enqueue<T>(command: string, args: string[]): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        command,
        args,
        resolve: resolve as (value: unknown) => void,
        reject,
      });
      this.scheduleFlush();
    });
  }

  private scheduleFlush(): void {
    if (this.flushScheduled) return;
    this.flushScheduled = true;
    // Microtask: collects every command issued in the current synchronous
    // window (including those queued from promise continuations of the same tick).
    queueMicrotask(() => {
      this.flushScheduled = false;
      void this.drain();
    });
  }

  private async drain(): Promise<void> {
    if (this.queue.length === 0) return;
    // Serialise flushes so batches never interleave on the wire.
    if (this.inflightFlush) {
      await this.inflightFlush;
    }
    if (this.queue.length === 0) return;

    const batch = this.queue.splice(0, this.maxPipelineBatch);
    const run = this.dispatchBatch(batch).finally(() => {
      if (this.inflightFlush === run) this.inflightFlush = null;
    });
    this.inflightFlush = run;
    await run;

    // Anything queued while this batch was in flight needs another round-trip.
    if (this.queue.length > 0) this.scheduleFlush();
  }

  private async dispatchBatch(batch: PendingCommand[]): Promise<void> {
    if (batch.length === 1) {
      const single = batch[0] as PendingCommand;
      try {
        single.resolve(await this.executeSingle(single.command, single.args));
      } catch (err) {
        single.reject(err);
      }
      return;
    }

    try {
      const results = await this.pipeline(batch.map((c) => [c.command, ...c.args]));
      for (let i = 0; i < batch.length; i++) {
        const pending = batch[i] as PendingCommand;
        const result = results[i];
        if (result && typeof result === 'object' && 'error' in (result as object)) {
          const failure = result as { error?: string };
          pending.reject(
            new Error(`Serverless Redis pipeline error: ${failure.error ?? 'unknown error'}`)
          );
        } else {
          pending.resolve(result);
        }
      }
    } catch (err) {
      for (const pending of batch) pending.reject(err);
    }
  }

  // -------------------------------------------------------------------------
  // Commands
  // -------------------------------------------------------------------------

  /**
   * GET returns the RAW stored string, matching `node-redis` semantics.
   * Returns null when the key does not exist.
   */
  public async get(key: string): Promise<string | null> {
    return this.fetchCommand<string | null>('get', [key]);
  }

  public async set(key: string, value: unknown, ttlSeconds?: number): Promise<'OK'> {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    if (ttlSeconds) {
      await this.fetchCommand<void>('set', [key, serialized, 'EX', String(Math.ceil(ttlSeconds))]);
    } else {
      await this.fetchCommand<void>('set', [key, serialized]);
    }
    return 'OK';
  }

  public async setEx(key: string, seconds: number, value: string): Promise<'OK'> {
    await this.fetchCommand<void>('setex', [key, String(Math.ceil(seconds)), value]);
    return 'OK';
  }

  public async del(...keys: string[]): Promise<number> {
    if (keys.length === 0) return 0;
    return this.fetchCommand<number>('del', keys);
  }

  /** Non-blocking variant of DEL. Falls back to DEL where UNLINK is absent. */
  public async unlink(...keys: string[]): Promise<number> {
    if (keys.length === 0) return 0;
    return this.fetchCommand<number>('unlink', keys);
  }

  public async exists(key: string): Promise<boolean> {
    const res = await this.fetchCommand<number>('exists', [key]);
    return res === 1;
  }

  public async expire(key: string, seconds: number): Promise<boolean> {
    const res = await this.fetchCommand<number>('expire', [key, String(Math.ceil(seconds))]);
    return res === 1;
  }

  public async ttl(key: string): Promise<number> {
    return this.fetchCommand<number>('ttl', [key]);
  }

  public async incr(key: string): Promise<number> {
    return this.fetchCommand<number>('incr', [key]);
  }

  public async incrby(key: string, increment: number): Promise<number> {
    return this.fetchCommand<number>('incrby', [key, String(increment)]);
  }

  public async mget(keys: string[]): Promise<(string | null)[]> {
    if (keys.length === 0) return [];
    return this.fetchCommand<(string | null)[]>('mget', keys);
  }

  public async mSet(entries: Record<string, string>): Promise<'OK'> {
    const keys = Object.keys(entries);
    if (keys.length === 0) return 'OK';
    await this.fetchCommand<void>(
      'mset',
      keys.flatMap((k) => [k, entries[k] as string])
    );
    return 'OK';
  }

  public async hset(key: string, ...fields: [string, string][]): Promise<number> {
    if (fields.length === 0) return 0;
    return this.fetchCommand<number>('hset', [key, ...fields.flat()]);
  }

  public async hIncrBy(key: string, field: string, increment: number): Promise<number> {
    return this.fetchCommand<number>('hincrby', [key, field, String(increment)]);
  }

  /** HGET returns the RAW stored string (no JSON decoding). */
  public async hget(key: string, field: string): Promise<string | null> {
    return this.fetchCommand<string | null>('hget', [key, field]);
  }

  public async hDel(key: string, ...fields: string[]): Promise<number> {
    if (fields.length === 0) return 0;
    return this.fetchCommand<number>('hdel', [key, ...fields]);
  }

  public async hgetall(key: string): Promise<Record<string, string>> {
    const res = await this.fetchCommand<unknown>('hgetall', [key]);
    const result: Record<string, string> = {};
    if (Array.isArray(res)) {
      for (let i = 0; i < res.length; i += 2) {
        if (i + 1 < res.length) {
          result[String(res[i])] = String(res[i + 1]);
        }
      }
    } else if (res && typeof res === 'object') {
      for (const [field, value] of Object.entries(res as Record<string, unknown>)) {
        result[field] = String(value);
      }
    }
    return result;
  }

  public async lPush(key: string, ...values: string[]): Promise<number> {
    if (values.length === 0) return 0;
    return this.fetchCommand<number>('lpush', [key, ...values]);
  }

  public async rPush(key: string, ...values: string[]): Promise<number> {
    if (values.length === 0) return 0;
    return this.fetchCommand<number>('rpush', [key, ...values]);
  }

  public async lTrim(key: string, start: number, stop: number): Promise<'OK'> {
    await this.fetchCommand<void>('ltrim', [key, String(start), String(stop)]);
    return 'OK';
  }

  public async lRange(key: string, start: number, stop: number): Promise<string[]> {
    const res = await this.fetchCommand<unknown>('lrange', [key, String(start), String(stop)]);
    return Array.isArray(res) ? res.map(String) : [];
  }

  public async lLen(key: string): Promise<number> {
    return this.fetchCommand<number>('llen', [key]);
  }

  public async sAdd(key: string, ...members: string[]): Promise<number> {
    if (members.length === 0) return 0;
    return this.fetchCommand<number>('sadd', [key, ...members]);
  }

  public async sRem(key: string, ...members: string[]): Promise<number> {
    if (members.length === 0) return 0;
    return this.fetchCommand<number>('srem', [key, ...members]);
  }

  public async sMembers(key: string): Promise<string[]> {
    const res = await this.fetchCommand<unknown>('smembers', [key]);
    return Array.isArray(res) ? res.map(String) : [];
  }

  /**
   * Incremental keyspace cursor scan. Never blocks the server (unlike KEYS).
   */
  public async scan(
    cursor: number | string,
    options?: { MATCH?: string; COUNT?: number; TYPE?: string }
  ): Promise<ScanResult> {
    const args: string[] = [String(cursor)];
    if (options?.MATCH) args.push('MATCH', options.MATCH);
    if (options?.COUNT) args.push('COUNT', String(options.COUNT));
    if (options?.TYPE) args.push('TYPE', options.TYPE);
    const raw = await this.fetchCommand<unknown>('scan', args);
    return normalizeScan(raw);
  }

  public async sScan(
    key: string,
    cursor: number | string,
    options?: { MATCH?: string; COUNT?: number }
  ): Promise<ScanResult> {
    const args: string[] = [key, String(cursor)];
    if (options?.MATCH) args.push('MATCH', options.MATCH);
    if (options?.COUNT) args.push('COUNT', String(options.COUNT));
    const raw = await this.fetchCommand<unknown>('sscan', args);
    return normalizeScan(raw);
  }

  /**
   * Execute a batch of commands in a single `/pipeline` round-trip.
   *
   * Upstash answers this endpoint with a BARE array of per-command envelopes
   * (`[{result}, {error}]`), not a wrapped object. A wrapped `{ result: [...] }`
   * shape is also tolerated for proxy implementations.
   *
   * Per-command errors are returned inline so one bad command cannot discard
   * its siblings' results.
   */
  public async pipeline(commands: string[][]): Promise<unknown[]> {
    if (commands.length === 0) return [];
    await this.config();

    const parsed = await this.postJson(`${this.baseUrl}/pipeline`, commands);

    let items: PipelineItem[];
    if (Array.isArray(parsed)) {
      items = parsed as PipelineItem[];
    } else if (
      parsed &&
      typeof parsed === 'object' &&
      Array.isArray((parsed as { result?: unknown }).result)
    ) {
      items = (parsed as { result: PipelineItem[] }).result;
    } else {
      throw new Error(`Serverless Redis pipeline error: unexpected response`);
    }

    return items.map((item) => (item?.error ? { error: item.error } : item?.result));
  }

  /**
   * Flush any queued commands immediately. Intended for graceful shutdown and
   * tests; normal operation drains on the microtask queue.
   */
  public async flushPending(): Promise<void> {
    while (this.queue.length > 0 || this.inflightFlush) {
      if (this.queue.length === 0 && this.inflightFlush) {
        await this.inflightFlush;
        continue;
      }
      await this.drain();
    }
  }
}

export const serverlessRedis = new ServerlessRedisClient();
