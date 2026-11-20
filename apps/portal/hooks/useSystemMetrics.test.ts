import { act, renderHook } from '@testing-library/react';
import { useSystemMetrics } from './useSystemMetrics';

describe('useSystemMetrics hook', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should initialize metrics properly', () => {
    const { result } = renderHook(() => useSystemMetrics());
    expect(result.current.websocketLatency).toBeGreaterThanOrEqual(0);
    expect(result.current.serverTimeSAST).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    expect(['A', 'B', 'C']).toContain(result.current.currentShift.shift);
  });

  it('should update clock and shift on time tick', () => {
    const { result } = renderHook(() => useSystemMetrics());
    const initialTime = result.current.serverTimeSAST;

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    const nextTime = result.current.serverTimeSAST;
    expect(nextTime).not.toBe(initialTime);
  });

  it('should poll health endpoint on latency interval', async () => {
    const mockFetch = jest.fn().mockResolvedValue({ ok: true });
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const { result } = renderHook(() => useSystemMetrics());

    await act(async () => {
      jest.advanceTimersByTime(15_000);
    });

    expect(mockFetch).toHaveBeenCalledWith('/api/health/live', {
      method: 'GET',
      cache: 'no-store',
    });
    expect(result.current.websocketLatency).toBeGreaterThanOrEqual(0);
  });
});
