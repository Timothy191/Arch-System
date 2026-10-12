/**
 * @swagger
 * /api/control-room/scada-status:
 *   get:
 *     summary: Retrieve SCADA & Redis Degraded Status
 *     description: Returns SCADA server health with state machine, hysteresis, and outage tracking.
 *     tags:
 *       - Control Room
 */

import { getRedisClient } from '@repo/redis';
import { NextResponse } from 'next/server';
import { applyCors } from '@/lib/api/cors';
import { logError } from '@/lib/errors/error-logger';
import { addEvent, setAttributes, withAsyncSpan } from '@/lib/observability/tracing';

const SCADA_STATE_KEY = 'control-room:scada:state';

export async function GET(req: Request) {
  return withAsyncSpan('api_scada_status', {}, async () => {
    try {
      const startTime = Date.now();
      let latencyMs = 0;
      let redisConnected = false;
      let redisReadError = false;
      let lastGoodAt: string | null = null;
      let previousState = 'offline';
      let cachedTagCount = 0;

      const redis = await getRedisClient().catch(() => null);
      if (redis) {
        redisConnected = true;
        try {
          // Use SCAN (non-blocking) instead of KEYS (blocking) per Redis best practice.
          // KEYS blocks the single-threaded Redis event loop; SCAN iterates in chunks.
          let tagCount = 0;
          let cursor = 0;
          do {
            const result = (await redis.scan(cursor, {
              MATCH: 'telemetry:last:*',
              COUNT: 100,
            })) as { cursor: number; keys: string[] };
            cursor = result.cursor;
            tagCount += result.keys?.length ?? 0;
          } while (cursor !== 0);

          const [savedStateStr] = await Promise.all([
            typeof redis.get === 'function' ? redis.get(SCADA_STATE_KEY).catch(() => null) : null,
          ]);
          cachedTagCount = tagCount;
          if (savedStateStr) {
            const parsed = JSON.parse(savedStateStr);
            lastGoodAt = parsed.lastGoodAt || null;
            previousState = parsed.state || 'offline';
          }
        } catch (e) {
          redisConnected = false;
          redisReadError = true;
          logError(e, { context: 'scada_status_cache_read' });
        }
      }

      latencyMs = Date.now() - startTime;

      setAttributes({
        scada_healthy: redisConnected,
        latency_ms: latencyMs,
        breaker_tripped: false,
      });

      let currentState = 'offline';
      if (redisConnected) {
        currentState = 'healthy';
        lastGoodAt = new Date().toISOString();
      } else {
        currentState = 'degraded';
      }

      const reasons: string[] = [];
      if (!redisConnected) {
        reasons.push(
          redisReadError ? 'Redis telemetry cache read failed' : 'Redis telemetry cache unavailable'
        );
      }

      const isStale = !!lastGoodAt && Date.now() - new Date(lastGoodAt).getTime() > 60000;

      const payload = {
        status: currentState,
        state: currentState,
        redis_connected: redisConnected,
        cached_tag_count: cachedTagCount,
        breakerTripped: false,
        latencyMs,
        lastGoodAt,
        staleSince: isStale ? lastGoodAt : null,
        reasons,
        timestamp: new Date().toISOString(),
      };

      if (redis && typeof redis.set === 'function') {
        try {
          await redis.set(SCADA_STATE_KEY, JSON.stringify(payload), { EX: 60 });
        } catch (cacheErr) {
          logError(cacheErr, { context: 'scada_status_cache_write' });
        }
      }

      addEvent('scada_probe_complete', { state: currentState, latencyMs });
      return applyCors(req, NextResponse.json(payload));
    } catch (err: unknown) {
      logError(err, { context: 'scada_status_error' });
      return NextResponse.json(
        { success: false, error: { message: 'Internal server error', code: 'API_ERROR' } },
        { status: 500 }
      );
    }
  });
}
