'use client';

import { useEffect } from 'react';

type ClientPerfTier = 'high' | 'balanced' | 'lite';

interface NetworkConnectionLike {
  readonly saveData?: boolean;
  readonly effectiveType?: string;
  readonly downlink?: number;
}

type HardwareAwareNavigator = Navigator & {
  readonly deviceMemory?: number;
  readonly connection?: NetworkConnectionLike;
};

type IdleCapableWindow = Window & {
  readonly requestIdleCallback?: (
    callback: () => void,
    options?: { readonly timeout: number }
  ) => number;
  readonly cancelIdleCallback?: (handle: number) => void;
};

const MEDIA_CACHE_NAME = 'arch-portal-media-v1';
const HIGH_TIER_MIN_CORES = 8;
const HIGH_TIER_MIN_MEMORY_GB = 8;
const HIGH_TIER_MIN_DOWNLINK_MBPS = 5;
const LITE_TIER_MAX_CORES = 2;
const LITE_TIER_MAX_MEMORY_GB = 2;
const DEFAULT_CPU_CORES = 4;
const DEFAULT_MEMORY_GB = 4;
const DEFAULT_DOWNLINK_MBPS = 10;
const HIGH_TIER_CONCURRENCY = 4;
const BALANCED_TIER_CONCURRENCY = 2;
const IDLE_WARMUP_TIMEOUT_MS = 2500;
const FALLBACK_WARMUP_DELAY_MS = 1800;
const HTTP_OK_STATUS = 200;

const DEPARTMENT_WEBP_ASSETS: readonly string[] = [
  '/background/global-background-poster.webp',
  '/images/departments/overview.webp',
  '/images/departments/admin.webp',
  '/images/departments/access-control.webp',
  '/images/departments/production.webp',
  '/images/departments/drilling.webp',
  '/images/departments/plant-processing.webp',
  '/images/departments/plant-inventory.webp',
  '/images/departments/engineering.webp',
  '/images/departments/control-room.webp',
  '/images/departments/availability-utilization.webp',
  '/images/departments/database.webp',
];

const HIGH_TIER_PREVIEW_VIDEOS: readonly string[] = [
  '/images/departments/overview.mp4',
  '/images/departments/control-room.mp4',
  '/images/departments/production.mp4',
  '/images/departments/drilling.mp4',
];

function isConstrainedConnection(connection?: NetworkConnectionLike): boolean {
  if (!connection) return false;
  if (connection.saveData) return true;
  const networkType = connection.effectiveType;
  return networkType === 'slow-2g' || networkType === '2g' || networkType === '3g';
}

function detectClientSystemTier(): ClientPerfTier {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return 'balanced';
  }

  const prefersReducedMotion =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const nav = navigator as HardwareAwareNavigator;
  const cpuCores = nav.hardwareConcurrency ?? DEFAULT_CPU_CORES;
  const memoryGb = nav.deviceMemory ?? DEFAULT_MEMORY_GB;
  const downlinkMbps = nav.connection?.downlink ?? DEFAULT_DOWNLINK_MBPS;

  if (
    prefersReducedMotion ||
    isConstrainedConnection(nav.connection) ||
    cpuCores <= LITE_TIER_MAX_CORES ||
    memoryGb <= LITE_TIER_MAX_MEMORY_GB
  ) {
    return 'lite';
  }

  if (
    cpuCores >= HIGH_TIER_MIN_CORES &&
    memoryGb >= HIGH_TIER_MIN_MEMORY_GB &&
    downlinkMbps >= HIGH_TIER_MIN_DOWNLINK_MBPS
  ) {
    return 'high';
  }

  return 'balanced';
}

async function cacheAndDecodeImage(assetUrl: string): Promise<void> {
  try {
    if ('caches' in window) {
      const mediaCache = await caches.open(MEDIA_CACHE_NAME);
      const cachedMatch = await mediaCache.match(assetUrl);
      if (!cachedMatch) {
        const response = await fetch(assetUrl, {
          credentials: 'same-origin',
          priority: 'low',
        } as RequestInit);
        if (response.status === HTTP_OK_STATUS) {
          await mediaCache.put(assetUrl, response.clone());
        }
      }
    }

    if (typeof Image !== 'undefined') {
      const predecodedImg = new Image();
      predecodedImg.decoding = 'async';
      predecodedImg.src = assetUrl;
      if (typeof predecodedImg.decode === 'function') {
        await predecodedImg.decode().catch(() => {});
      }
    }
  } catch {
    // Best-effort background warmup; ignore offline or aborted fetch errors
  }
}

async function warmAssetsWithConcurrency(
  urls: readonly string[],
  concurrencyLimit: number
): Promise<void> {
  let cursorIndex = 0;

  async function runWorker(): Promise<void> {
    while (cursorIndex < urls.length) {
      const targetUrl = urls[cursorIndex];
      cursorIndex += 1;
      if (targetUrl) {
        await cacheAndDecodeImage(targetUrl);
      }
    }
  }

  const workerCount = Math.min(concurrencyLimit, urls.length);
  const workers = Array.from({ length: workerCount }, () => runWorker());
  await Promise.all(workers);
}

async function warmHighTierVideoPreviews(videoUrls: readonly string[]): Promise<void> {
  for (const videoUrl of videoUrls) {
    try {
      await fetch(videoUrl, {
        credentials: 'same-origin',
        priority: 'low',
      } as RequestInit);
    } catch {
      // Best-effort browser HTTP disk-cache warmup
    }
  }
}

function notifyServiceWorkerPrewarm(urls: readonly string[]): void {
  if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) {
    return;
  }
  navigator.serviceWorker.controller.postMessage({
    type: 'ARCH_PREWARM_ASSETS',
    urls,
  });
}

export function ServiceWorkerRegister() {
  useEffect(() => {
    const perfTier = detectClientSystemTier();
    document.documentElement.dataset.perfTier = perfTier;

    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          registration.update().catch(() => {});
        })
        .catch(() => {});
    }

    if (perfTier === 'lite') {
      return;
    }

    const startAdaptiveAssetWarmup = () => {
      const concurrency = perfTier === 'high' ? HIGH_TIER_CONCURRENCY : BALANCED_TIER_CONCURRENCY;
      notifyServiceWorkerPrewarm(DEPARTMENT_WEBP_ASSETS);
      void warmAssetsWithConcurrency(DEPARTMENT_WEBP_ASSETS, concurrency).then(() => {
        if (perfTier === 'high') {
          void warmHighTierVideoPreviews(HIGH_TIER_PREVIEW_VIDEOS);
        }
      });
    };

    const idleWin = window as IdleCapableWindow;
    if (typeof idleWin.requestIdleCallback === 'function') {
      const idleHandle = idleWin.requestIdleCallback(startAdaptiveAssetWarmup, {
        timeout: IDLE_WARMUP_TIMEOUT_MS,
      });
      return () => {
        idleWin.cancelIdleCallback?.(idleHandle);
      };
    }

    const fallbackTimer = setTimeout(startAdaptiveAssetWarmup, FALLBACK_WARMUP_DELAY_MS);
    return () => clearTimeout(fallbackTimer);
  }, []);

  return null;
}
