// packages/redis/src/cluster.ts
// Cluster slot co-location validator. MOVED/ASK redirect following is out of
// scope for the REST transport; callers must co-locate multi-key ops.
export function extractSlotTag(key: string): string {
  const match = key.match(/\{([^}]+)\}/);
  return match ? (match[1] as string) : key;
}

export function assertSameSlot(keys: readonly string[]): boolean {
  if (keys.length === 0) return true;
  const firstTag = extractSlotTag(keys[0] as string);
  for (const key of keys) {
    if (extractSlotTag(key) !== firstTag) {
      throw new Error(
        `Keys do not share a cluster slot: "${keys[0]}" vs "${key}" (use hash tags {tag})`
      );
    }
  }
  return true;
}

export interface ClusterRedirect {
  kind: 'MOVED' | 'ASK';
  slot: number;
  host: string;
  port: number;
  address: string;
}

const REDIRECT_REGEX = /\b(MOVED|ASK)\s+(\d+)\s+([^:\s]+):(\d+)\b/;

export function parseClusterRedirect(errorOrReply: unknown): ClusterRedirect | null {
  const message =
    errorOrReply instanceof Error
      ? errorOrReply.message
      : typeof errorOrReply === 'string'
        ? errorOrReply
        : errorOrReply && typeof errorOrReply === 'object' && 'message' in errorOrReply
          ? String((errorOrReply as { message: unknown }).message)
          : null;

  if (!message) return null;
  const match = REDIRECT_REGEX.exec(message);
  if (!match) return null;

  const kind = match[1] as 'MOVED' | 'ASK';
  const slot = Number.parseInt(match[2] as string, 10);
  const host = match[3] as string;
  const port = Number.parseInt(match[4] as string, 10);

  return {
    kind,
    slot,
    host,
    port,
    address: `${host}:${port}`,
  };
}

export interface ClusterRedirectExecutionOptions<T> {
  executeNodeCommand: (context: {
    redirect?: ClusterRedirect;
    requiresAsking: boolean;
    attempt: number;
  }) => Promise<T>;
  maxRedirects?: number;
}

const DEFAULT_MAX_CLUSTER_REDIRECTS = 5;

export async function executeWithClusterRedirect<T>(
  options: ClusterRedirectExecutionOptions<T>
): Promise<T> {
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_CLUSTER_REDIRECTS;
  let currentRedirect: ClusterRedirect | undefined;
  let requiresAsking = false;

  for (let attempt = 0; attempt <= maxRedirects; attempt++) {
    try {
      return await options.executeNodeCommand({
        redirect: currentRedirect,
        requiresAsking,
        attempt,
      });
    } catch (errorOrReply) {
      const redirect = parseClusterRedirect(errorOrReply);
      if (!redirect) {
        throw errorOrReply;
      }
      if (attempt >= maxRedirects) {
        throw new Error('Cluster redirect limit exceeded');
      }
      currentRedirect = redirect;
      requiresAsking = redirect.kind === 'ASK';
    }
  }

  throw new Error('Cluster redirect limit exceeded');
}
