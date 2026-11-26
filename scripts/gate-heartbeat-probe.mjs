#!/usr/bin/env node

/**
 * CLI probe for posting perimeter gate heartbeats to `/api/access-control/gates/heartbeat`.
 * Usage:
 *   node scripts/gate-heartbeat-probe.mjs --url http://localhost:3000 --gate-id GATE-01-NORTH --once
 */

const DEFAULT_INTERVAL_MS = 30_000;

function parseArgs(argv) {
  const options = {
    url: 'http://localhost:3000',
    gateId: undefined,
    gateLocation: undefined,
    intervalMs: DEFAULT_INTERVAL_MS,
    once: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--url' && argv[i + 1]) {
      options.url = argv[i + 1];
      i += 1;
    } else if (arg === '--gate-id' && argv[i + 1]) {
      options.gateId = argv[i + 1];
      i += 1;
    } else if (arg === '--gate-location' && argv[i + 1]) {
      options.gateLocation = argv[i + 1];
      i += 1;
    } else if (arg === '--interval-ms' && argv[i + 1]) {
      const parsed = Number.parseInt(argv[i + 1], 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        options.intervalMs = parsed;
      }
      i += 1;
    } else if (arg === '--once') {
      options.once = true;
    }
  }

  return options;
}

async function sendHeartbeat(options, apiKey) {
  const targetUrl = `${options.url.replace(/\/$/, '')}/api/access-control/gates/heartbeat`;
  const payload = {
    ...(options.gateId ? { gateId: options.gateId } : {}),
    ...(options.gateLocation ? { gateLocation: options.gateLocation } : {}),
    timestamp: new Date().toISOString(),
  };

  const response = await fetch(targetUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  const body = await response.json().catch(() => ({}));
  const output = {
    ok: response.ok,
    status: response.status,
    timestamp: new Date().toISOString(),
    gateId: body?.gate?.id ?? options.gateId ?? null,
    gateLocation: body?.gate?.gate_location ?? options.gateLocation ?? null,
    error: body?.error ?? null,
  };

  console.log(JSON.stringify(output));
  return response.ok;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const apiKey = process.env.SCANNER_API_KEY?.trim() || process.env.CRON_SECRET?.trim() || '';

  if (!apiKey) {
    console.error(
      JSON.stringify({
        ok: false,
        error: 'SCANNER_API_KEY or CRON_SECRET environment variable is required',
      })
    );
    process.exit(1);
  }

  if (!options.gateId && !options.gateLocation) {
    console.error(
      JSON.stringify({
        ok: false,
        error: 'Either --gate-id or --gate-location must be provided',
      })
    );
    process.exit(1);
  }

  const ok = await sendHeartbeat(options, apiKey);
  if (options.once) {
    process.exit(ok ? 0 : 1);
  }

  setInterval(() => {
    void sendHeartbeat(options, apiKey);
  }, options.intervalMs);
}

main().catch((err) => {
  console.error(
    JSON.stringify({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    })
  );
  process.exit(1);
});
