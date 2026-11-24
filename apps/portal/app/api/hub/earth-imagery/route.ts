import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { FixedWindowStrategy, MemoryStore, RateLimiter } from '@repo/rate-limiter';
import { getAuthenticatedEmployee } from '@repo/supabase';
import { NextResponse } from 'next/server';

type EarthImageryLayer = 'viirs' | 'blue-marble';

interface CachedEarthImagery {
  readonly bytes: Uint8Array;
  readonly fetchedAtMs: number;
  readonly source: 'nasa-gibs' | 'fallback';
}

const HTTP_OK = 200;
const HTTP_BAD_REQUEST = 400;
const HTTP_UNAUTHORIZED = 401;
const HTTP_TOO_MANY_REQUESTS = 429;
const HTTP_SERVICE_UNAVAILABLE = 503;

const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW_MS = 60_000;
const IMAGERY_TIMEOUT_MS = 8_000;
const MIN_VALID_IMAGERY_BYTES = 10_000;
const CACHE_TTL_SECONDS = 3_600;
const CACHE_TTL_MS = CACHE_TTL_SECONDS * 1_000;
const CACHE_CONTROL_HEADER = `public, max-age=${CACHE_TTL_SECONDS}, s-maxage=${CACHE_TTL_SECONDS}, stale-while-revalidate=${CACHE_TTL_SECONDS * 2}`;

const GIBS_WMS_BASE_URL = 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi';
const GIBS_LAYER_MAP: Readonly<Record<EarthImageryLayer, string>> = {
  'blue-marble': 'BlueMarble_ShadedRelief_Bathymetry',
  viirs: 'BlueMarble_ShadedRelief_Bathymetry,VIIRS_SNPP_CorrectedReflectance_TrueColor',
};

const earthImageryLimiter = new RateLimiter({
  store: new MemoryStore(),
  strategy: new FixedWindowStrategy(),
  limit: RATE_LIMIT_MAX,
  windowMs: RATE_LIMIT_WINDOW_MS,
  keyPrefix: 'ratelimit:hub_earth_imagery:',
});

const imageryMemoryCache = new Map<EarthImageryLayer, CachedEarthImagery>();

function resolveActorId(principal: unknown): string {
  const record = principal as {
    id?: string;
    user?: { id?: string };
    employee?: { id?: string } | null;
  };
  return record.user?.id ?? record.employee?.id ?? record.id ?? 'unknown';
}

function parseRequestedLayer(rawLayer: string | null): EarthImageryLayer | null {
  if (!rawLayer) return 'viirs';
  if (rawLayer === 'viirs' || rawLayer === 'blue-marble') return rawLayer;
  return null;
}

function buildGibsWmsUrl(layer: EarthImageryLayer): string {
  const params = new URLSearchParams({
    SERVICE: 'WMS',
    REQUEST: 'GetMap',
    VERSION: '1.3.0',
    LAYERS: GIBS_LAYER_MAP[layer],
    STYLES: '',
    CRS: 'EPSG:4326',
    BBOX: '-90,-180,90,180',
    WIDTH: '1024',
    HEIGHT: '512',
    FORMAT: 'image/jpeg',
  });
  return `${GIBS_WMS_BASE_URL}?${params.toString()}`;
}

async function fetchLiveSatelliteBytes(layer: EarthImageryLayer): Promise<Uint8Array | null> {
  try {
    const response = await fetch(buildGibsWmsUrl(layer), {
      headers: { Accept: 'image/jpeg' },
      signal: AbortSignal.timeout(IMAGERY_TIMEOUT_MS),
      next: { revalidate: CACHE_TTL_SECONDS },
    });

    if (!response.ok) return null;
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.toLowerCase().startsWith('image/')) return null;

    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength < MIN_VALID_IMAGERY_BYTES) return null;

    return new Uint8Array(arrayBuffer);
  } catch {
    return null;
  }
}

async function readBundledEarthFallback(): Promise<Uint8Array | null> {
  const candidatePaths = [
    path.resolve(process.cwd(), 'public', 'images', 'earth-blue-marble.jpg'),
    path.resolve(process.cwd(), 'apps', 'portal', 'public', 'images', 'earth-blue-marble.jpg'),
  ];

  for (const candidatePath of candidatePaths) {
    try {
      const fileBuffer = await readFile(candidatePath);
      if (fileBuffer.byteLength > 0) {
        return new Uint8Array(fileBuffer);
      }
    } catch {
      // Try next workspace root resolution
    }
  }
  return null;
}

function buildImageResponse(entry: CachedEarthImagery): Response {
  const bodyBuffer = Uint8Array.from(entry.bytes).buffer;
  return new Response(bodyBuffer, {
    status: HTTP_OK,
    headers: {
      'Content-Type': 'image/jpeg',
      'Cache-Control': CACHE_CONTROL_HEADER,
      'X-Earth-Imagery-Source': entry.source,
    },
  });
}

export async function GET(request: Request) {
  const principal = await getAuthenticatedEmployee().catch(() => null);
  if (!principal) {
    return NextResponse.json(
      { error: 'Unauthorized', code: 'UNAUTHORIZED' },
      { status: HTTP_UNAUTHORIZED }
    );
  }

  const rateLimit = await earthImageryLimiter.check(resolveActorId(principal));
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', code: 'RATE_LIMITED' },
      { status: HTTP_TOO_MANY_REQUESTS }
    );
  }

  const { searchParams } = new URL(request.url);
  const layer = parseRequestedLayer(searchParams.get('layer'));
  if (!layer) {
    return NextResponse.json(
      { error: 'Invalid imagery layer parameter', code: 'INVALID_REQUEST' },
      { status: HTTP_BAD_REQUEST }
    );
  }

  const nowMs = Date.now();
  const cached = imageryMemoryCache.get(layer);
  if (cached && nowMs - cached.fetchedAtMs < CACHE_TTL_MS) {
    return buildImageResponse(cached);
  }

  const liveBytes = await fetchLiveSatelliteBytes(layer);
  if (liveBytes) {
    const freshEntry: CachedEarthImagery = {
      bytes: liveBytes,
      fetchedAtMs: nowMs,
      source: 'nasa-gibs',
    };
    imageryMemoryCache.set(layer, freshEntry);
    return buildImageResponse(freshEntry);
  }

  const fallbackBytes = await readBundledEarthFallback();
  if (!fallbackBytes) {
    return NextResponse.json(
      { error: 'Earth satellite imagery unavailable', code: 'IMAGERY_UNAVAILABLE' },
      { status: HTTP_SERVICE_UNAVAILABLE }
    );
  }

  const fallbackEntry: CachedEarthImagery = {
    bytes: fallbackBytes,
    fetchedAtMs: nowMs,
    source: 'fallback',
  };
  imageryMemoryCache.set(layer, fallbackEntry);
  return buildImageResponse(fallbackEntry);
}
