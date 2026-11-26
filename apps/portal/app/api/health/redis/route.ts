import {
  detectCapabilities,
  getCacheStats,
  getRedisClient,
  isServerlessRedis,
  searchAvailability,
  type VectorIndexStats,
  vectorIndexStats,
} from '@repo/redis';
import { getAuthenticatedEmployee } from '@repo/supabase';
import { type NextRequest, NextResponse } from 'next/server';

const HTTP_OK = 200;
const HTTP_SERVICE_UNAVAILABLE = 503;
const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
} as const;

async function isAuthenticatedAdmin(): Promise<boolean> {
  try {
    if (typeof getAuthenticatedEmployee !== 'function') {
      return false;
    }
    const principal = await getAuthenticatedEmployee();
    return principal?.employee?.role === 'admin';
  } catch {
    return false;
  }
}

export async function GET(_req: NextRequest | Request) {
  const startedAt = Date.now();
  let isDegraded = false;

  try {
    const redis = await getRedisClient();
    if (!redis?.isOpen) {
      isDegraded = true;
    } else {
      await redis.ping();
    }
  } catch {
    isDegraded = true;
  }

  const isServerless = typeof isServerlessRedis === 'function' ? isServerlessRedis() : false;
  const status = isDegraded ? 'degraded' : 'healthy';
  const mode = isServerless ? 'serverless-rest' : 'tcp';
  const timestamp = new Date().toISOString();
  const responseStatus = isDegraded ? HTTP_SERVICE_UNAVAILABLE : HTTP_OK;

  const isAdmin = await isAuthenticatedAdmin();
  if (!isAdmin) {
    return NextResponse.json(
      {
        status,
        mode,
        timestamp,
      },
      {
        status: responseStatus,
        headers: NO_STORE_HEADERS,
      }
    );
  }

  let cacheStats = null;
  try {
    if (typeof getCacheStats === 'function') {
      cacheStats = await getCacheStats();
    }
  } catch {
    // Non-fatal in health check
  }

  let capabilities = null;
  try {
    if (typeof detectCapabilities === 'function') {
      capabilities = await detectCapabilities();
    }
  } catch {
    // Non-fatal in health check
  }

  let vectorSearch: Awaited<ReturnType<typeof searchAvailability>> = {
    available: false,
    reason: 'unreachable',
  };
  let vectorIndexes: VectorIndexStats[] = [];
  try {
    if (typeof searchAvailability === 'function') {
      vectorSearch = await searchAvailability();
      if (vectorSearch.available && typeof vectorIndexStats === 'function') {
        vectorIndexes = await Promise.all([
          vectorIndexStats('arch:vector:mining'),
          vectorIndexStats('arch:vector:documents'),
        ]);
      }
    }
  } catch {
    // Non-fatal in health check
  }

  return NextResponse.json(
    {
      status,
      engine: capabilities?.redisVersion ? `redis-${capabilities.redisVersion}` : 'redis-7.x',
      mode,
      latencyMs: Date.now() - startedAt,
      cacheStats,
      capabilities,
      vectorSearch,
      vectorIndexes,
      timestamp,
    },
    {
      status: responseStatus,
      headers: NO_STORE_HEADERS,
    }
  );
}
