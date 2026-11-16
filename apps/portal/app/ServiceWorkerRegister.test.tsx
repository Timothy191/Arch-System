/** @jest-environment jsdom */

import { render, waitFor } from '@testing-library/react';
import { ServiceWorkerRegister, shouldWarmPreviewVideos } from './ServiceWorkerRegister';

const EXPECTED_CARD_ASSETS_COUNT = 12;
const EXPECTED_PREVIEW_VIDEOS_COUNT = 4;
const HIGH_TIER_CORES = 8;
const HIGH_TIER_MEMORY_GB = 8;
const HIGH_TIER_DOWNLINK_MBPS = 10;
const HTTP_OK_STATUS = 200;
const IDLE_CALLBACK_HANDLE = 42;
const VIDEO_EXTENSION = '.mp4';
const CARD_BANNER_SUFFIX = '-card.webp';
const DEPARTMENT_IMAGES_PREFIX = '/images/departments/';

interface MockPropertyBackup {
  readonly target: object;
  readonly key: PropertyKey;
  readonly descriptor: PropertyDescriptor | undefined;
  readonly previousValue: unknown;
  readonly wasAssignedDirectly: boolean;
}

function setMockProperty(
  backups: MockPropertyBackup[],
  target: object,
  key: PropertyKey,
  value: unknown
): void {
  const descriptor = Object.getOwnPropertyDescriptor(target, key);
  if (descriptor && !descriptor.configurable && descriptor.writable) {
    backups.push({
      target,
      key,
      descriptor,
      previousValue: Reflect.get(target, key),
      wasAssignedDirectly: true,
    });
    Reflect.set(target, key, value);
    return;
  }

  backups.push({
    target,
    key,
    descriptor,
    previousValue: undefined,
    wasAssignedDirectly: false,
  });
  Object.defineProperty(target, key, {
    value,
    configurable: true,
    writable: true,
  });
}

function restoreMockProperties(backups: readonly MockPropertyBackup[]): void {
  for (let index = backups.length - 1; index >= 0; index -= 1) {
    const backup = backups[index];
    if (!backup) continue;
    if (backup.wasAssignedDirectly) {
      Reflect.set(backup.target, backup.key, backup.previousValue);
      continue;
    }
    if (backup.descriptor) {
      Object.defineProperty(backup.target, backup.key, backup.descriptor);
      continue;
    }
    Reflect.deleteProperty(backup.target, backup.key);
  }
}

async function flushAsyncTasks(): Promise<void> {
  await Promise.resolve();
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
}

function getFetchedUrls(fetchMock: jest.Mock): string[] {
  return fetchMock.mock.calls.map(([input]) => String(input));
}

describe('shouldWarmPreviewVideos', () => {
  it('returns true only for /hub and /hub/ subpaths', () => {
    expect(shouldWarmPreviewVideos('/hub')).toBe(true);
    expect(shouldWarmPreviewVideos('/hub/')).toBe(true);
    expect(shouldWarmPreviewVideos('/hub/analytics')).toBe(true);

    expect(shouldWarmPreviewVideos('/')).toBe(false);
    expect(shouldWarmPreviewVideos('/drilling')).toBe(false);
    expect(shouldWarmPreviewVideos('/control-room')).toBe(false);
    expect(shouldWarmPreviewVideos('/hub-settings')).toBe(false);
    expect(shouldWarmPreviewVideos('')).toBe(false);
  });
});

describe('ServiceWorkerRegister', () => {
  let backups: MockPropertyBackup[] = [];
  let fetchMock: jest.Mock;

  beforeEach(() => {
    backups = [];
    fetchMock = jest.fn(async () => ({
      status: HTTP_OK_STATUS,
      clone: () => ({ status: HTTP_OK_STATUS }),
    }));

    const cacheStoreMock = {
      match: jest.fn(async () => undefined),
      put: jest.fn(async () => undefined),
    };
    const cachesMock = {
      open: jest.fn(async () => cacheStoreMock),
    };
    const matchMediaMock = jest.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }));
    const requestIdleCallbackMock = jest.fn((callback: () => void) => {
      queueMicrotask(callback);
      return IDLE_CALLBACK_HANDLE;
    });
    const cancelIdleCallbackMock = jest.fn();

    setMockProperty(backups, globalThis, 'fetch', fetchMock);
    setMockProperty(backups, window, 'fetch', fetchMock);
    setMockProperty(backups, globalThis, 'caches', cachesMock);
    setMockProperty(backups, window, 'caches', cachesMock);
    setMockProperty(backups, window, 'matchMedia', matchMediaMock);
    setMockProperty(backups, window, 'requestIdleCallback', requestIdleCallbackMock);
    setMockProperty(backups, window, 'cancelIdleCallback', cancelIdleCallbackMock);
    setMockProperty(backups, navigator, 'hardwareConcurrency', HIGH_TIER_CORES);
    setMockProperty(backups, navigator, 'deviceMemory', HIGH_TIER_MEMORY_GB);
    setMockProperty(backups, navigator, 'connection', {
      saveData: false,
      effectiveType: '4g',
      downlink: HIGH_TIER_DOWNLINK_MBPS,
    });
    setMockProperty(backups, document, 'visibilityState', 'visible');
  });

  afterEach(() => {
    window.history.pushState({}, '', '/');
    restoreMockProperties(backups);
    jest.clearAllMocks();
  });

  it('warms light -card.webp banners and high-tier preview videos on /hub', async () => {
    window.history.pushState({}, '', '/hub');
    render(<ServiceWorkerRegister />);

    const expectedTotalRequests = EXPECTED_CARD_ASSETS_COUNT + EXPECTED_PREVIEW_VIDEOS_COUNT;
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(expectedTotalRequests);
    });

    const fetchedUrls = getFetchedUrls(fetchMock);
    const departmentImageUrls = fetchedUrls.filter(
      (url) => url.startsWith(DEPARTMENT_IMAGES_PREFIX) && !url.endsWith(VIDEO_EXTENSION)
    );
    const videoUrls = fetchedUrls.filter((url) => url.endsWith(VIDEO_EXTENSION));

    expect(fetchedUrls).toContain('/background/global-background-poster.webp');
    expect(departmentImageUrls).toHaveLength(EXPECTED_CARD_ASSETS_COUNT - 1);
    for (const imageUrl of departmentImageUrls) {
      expect(imageUrl.endsWith(CARD_BANNER_SUFFIX)).toBe(true);
    }
    expect(videoUrls).toEqual([
      '/images/departments/overview.mp4',
      '/images/departments/control-room.mp4',
      '/images/departments/production.mp4',
      '/images/departments/drilling.mp4',
    ]);
  });

  it('skips warming .mp4 preview videos on /drilling in high tier', async () => {
    window.history.pushState({}, '', '/drilling');
    render(<ServiceWorkerRegister />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(EXPECTED_CARD_ASSETS_COUNT);
    });
    await flushAsyncTasks();

    expect(fetchMock).toHaveBeenCalledTimes(EXPECTED_CARD_ASSETS_COUNT);
    const fetchedUrls = getFetchedUrls(fetchMock);
    expect(fetchedUrls.some((url) => url.endsWith(VIDEO_EXTENSION))).toBe(false);
  });

  it('skips warming .mp4 preview videos on /control-room in high tier', async () => {
    window.history.pushState({}, '', '/control-room');
    render(<ServiceWorkerRegister />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(EXPECTED_CARD_ASSETS_COUNT);
    });
    await flushAsyncTasks();

    expect(fetchMock).toHaveBeenCalledTimes(EXPECTED_CARD_ASSETS_COUNT);
    const fetchedUrls = getFetchedUrls(fetchMock);
    expect(fetchedUrls.some((url) => url.endsWith(VIDEO_EXTENSION))).toBe(false);
  });

  it('skips warming .mp4 preview videos on /hub when document is hidden', async () => {
    window.history.pushState({}, '', '/hub');
    setMockProperty(backups, document, 'visibilityState', 'hidden');
    render(<ServiceWorkerRegister />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(EXPECTED_CARD_ASSETS_COUNT);
    });
    await flushAsyncTasks();

    expect(fetchMock).toHaveBeenCalledTimes(EXPECTED_CARD_ASSETS_COUNT);
    const fetchedUrls = getFetchedUrls(fetchMock);
    expect(fetchedUrls.some((url) => url.endsWith(VIDEO_EXTENSION))).toBe(false);
  });
});
