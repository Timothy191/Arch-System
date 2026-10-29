import { usePitConnectivity } from '@repo/shared/hooks';
import { act, renderHook } from '@testing-library/react';

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => state,
  });
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('usePitConnectivity hook', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.useRealTimers();
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
  });

  it('should initialize as online when fetch succeeds', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
    });

    const { result } = renderHook(() =>
      usePitConnectivity({
        pingUrl: '/api/health',
        pingIntervalMs: 10000,
        degradedThresholdMs: 1000,
      })
    );

    await act(async () => {
      await result.current.checkConnectivity();
    });

    expect(result.current.status).toBe('online');
    expect(result.current.isOnline).toBe(true);
    expect(result.current.isDegraded).toBe(false);
  });

  it('should detect offline when fetch fails', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network Error'));

    const onStatusChange = jest.fn();
    const { result } = renderHook(() =>
      usePitConnectivity({
        pingUrl: '/api/health',
        onStatusChange,
      })
    );

    await act(async () => {
      await result.current.checkConnectivity();
    });

    expect(result.current.status).toBe('offline');
    expect(result.current.isOnline).toBe(false);
    expect(onStatusChange).toHaveBeenCalledWith('offline');
  });

  it('should probe the cheap liveness endpoint by default', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });

    renderHook(() => usePitConnectivity());

    await act(async () => {
      await Promise.resolve();
    });

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/health/live',
      expect.objectContaining({ method: 'HEAD' })
    );
  });

  it('should issue no heartbeat while the tab is hidden', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    setVisibility('hidden');

    renderHook(() => usePitConnectivity({ pingIntervalMs: 10_000 }));

    await act(async () => {
      jest.advanceTimersByTime(60_000);
    });

    expect(global.fetch).not.toHaveBeenCalled();

    await act(async () => {
      setVisibility('visible');
      await Promise.resolve();
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('should keep exactly one probe in flight per interval', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });

    const advanceProbe = async (ms: number) => {
      await act(async () => {
        jest.advanceTimersByTime(ms);
        // Let the probe promise settle so the next timer can be scheduled.
        await Promise.resolve();
        await Promise.resolve();
      });
    };

    renderHook(() => usePitConnectivity({ pingIntervalMs: 10_000 }));

    // t=0 probe runs on mount; each later slot lands within ±10% of 10s.
    await advanceProbe(0);
    await advanceProbe(11_000);
    await advanceProbe(11_000);

    expect(global.fetch).toHaveBeenCalledTimes(3);
  });
});
