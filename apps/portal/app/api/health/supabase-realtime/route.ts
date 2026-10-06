import { type NextRequest, NextResponse } from 'next/server';

const PROBE_TIMEOUT_MS = 3000;

function getRealtimeProbeUrl():
  | { url: URL; error: null }
  | { url: null; error: 'configuration_missing' | 'configuration_invalid' } {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const apiKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !apiKey) return { url: null, error: 'configuration_missing' };

  try {
    const url = new URL('/realtime/v1/websocket', supabaseUrl);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.searchParams.set('apikey', apiKey);
    url.searchParams.set('vsn', '1.0.0');
    url.searchParams.set('log_level', 'error');
    return { url, error: null };
  } catch {
    return { url: null, error: 'configuration_invalid' };
  }
}

type ProbeResult = 'healthy' | 'connection_failed' | 'timeout';

function probeRealtime(url: URL): Promise<ProbeResult> {
  return new Promise((resolve) => {
    const socket = new WebSocket(url);
    let settled = false;

    const finish = (result: ProbeResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      socket.removeEventListener('open', onOpen);
      socket.removeEventListener('error', onFailure);
      socket.removeEventListener('close', onFailure);
      try {
        socket.close();
      } finally {
        resolve(result);
      }
    };
    const onOpen = () => finish('healthy');
    const onFailure = () => finish('connection_failed');
    const timeout = setTimeout(() => finish('timeout'), PROBE_TIMEOUT_MS);

    socket.addEventListener('open', onOpen, { once: true });
    socket.addEventListener('error', onFailure, { once: true });
    socket.addEventListener('close', onFailure, { once: true });
  });
}

export async function GET(_req?: NextRequest) {
  const startedAt = Date.now();
  const configuration = getRealtimeProbeUrl();
  let result: ProbeResult | 'configuration_missing' | 'configuration_invalid' =
    configuration.error ?? 'connection_failed';
  if (configuration.url) {
    try {
      result = await probeRealtime(configuration.url);
    } catch {
      result = 'connection_failed';
    }
  }
  const healthy = result === 'healthy';

  return NextResponse.json(
    {
      status: healthy ? 'healthy' : 'degraded',
      realtime_healthy: healthy,
      reason: healthy ? null : `realtime_${result}`,
      latencyMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    },
    {
      status: healthy ? 200 : 503,
      headers: { 'Cache-Control': 'no-store' },
    }
  );
}
