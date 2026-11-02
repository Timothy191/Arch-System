/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';
import { useThrottledDebounce, useThrottledDebounceFn } from './useThrottledDebounce';

describe('useThrottledDebounce & useThrottledDebounceFn', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('useThrottledDebounce', () => {
    it('initializes with initial value', () => {
      const { result } = renderHook(() => useThrottledDebounce('initial', 200));
      expect(result.current).toBe('initial');
    });

    it('debounces rapid updates after inactivity', () => {
      const { result, rerender } = renderHook(
        ({ val }) => useThrottledDebounce(val, { throttleMs: 100, debounceMs: 300 }),
        { initialProps: { val: 'start' } }
      );

      rerender({ val: 'update-1' });
      rerender({ val: 'update-2' });
      rerender({ val: 'final' });

      expect(result.current).toBe('start');

      act(() => {
        jest.advanceTimersByTime(350);
      });

      expect(result.current).toBe('final');
    });

    it('supports leading edge execution when configured', () => {
      const { result, rerender } = renderHook(
        ({ val }) => useThrottledDebounce(val, { throttleMs: 200, debounceMs: 300, leading: true }),
        { initialProps: { val: 'first' } }
      );

      rerender({ val: 'immediate' });
      expect(result.current).toBe('immediate');
    });
  });

  describe('useThrottledDebounceFn', () => {
    it('executes callback with trailing debounce and supports cancel/flush', () => {
      const callback = jest.fn();
      const { result } = renderHook(() =>
        useThrottledDebounceFn(callback, { throttleMs: 100, debounceMs: 200, trailing: true })
      );

      act(() => {
        result.current.run('payload-1');
        result.current.run('payload-2');
      });

      expect(callback).not.toHaveBeenCalled();

      act(() => {
        result.current.flush();
      });

      expect(callback).toHaveBeenCalledWith('payload-2');
      expect(callback).toHaveBeenCalledTimes(1);

      act(() => {
        result.current.run('payload-3');
        result.current.cancel();
        jest.advanceTimersByTime(300);
      });

      expect(callback).toHaveBeenCalledTimes(1);
    });
  });
});
