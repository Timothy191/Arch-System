/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';
import { useThrottledDebounce, useThrottledDebounceFn } from './useThrottledDebounce';

describe('Given useThrottledDebounce and useThrottledDebounceFn', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Given useThrottledDebounce', () => {
    it('When initialized, Then it returns the initial value immediately', () => {
      const { result } = renderHook(() => useThrottledDebounce('initial', 200));
      expect(result.current).toBe('initial');
    });

    it('When rapid updates occur, Then it settles to the final value after inactivity', () => {
      const { result, rerender } = renderHook(
        ({ inputText }) => useThrottledDebounce(inputText, { throttleMs: 100, debounceMs: 300 }),
        { initialProps: { inputText: 'start' } }
      );

      rerender({ inputText: 'update-1' });
      rerender({ inputText: 'update-2' });
      rerender({ inputText: 'final' });

      expect(result.current).toBe('start');

      act(() => {
        jest.advanceTimersByTime(350);
      });

      expect(result.current).toBe('final');
    });

    it('When leading edge is enabled, Then it emits the first update immediately', () => {
      const { result, rerender } = renderHook(
        ({ inputText }) =>
          useThrottledDebounce(inputText, { throttleMs: 200, debounceMs: 300, leading: true }),
        { initialProps: { inputText: 'first' } }
      );

      rerender({ inputText: 'immediate' });
      expect(result.current).toBe('immediate');
    });
  });

  describe('Given useThrottledDebounceFn', () => {
    it('When run, flushed, and canceled, Then it controls trailing callback execution', () => {
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
