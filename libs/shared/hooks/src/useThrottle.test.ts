/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';
import { useThrottle, useThrottleFn } from './useThrottle';

const TEST_NOW = new Date('2026-01-01T00:00:00.000Z');

describe('Given useThrottle and useThrottleFn', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(TEST_NOW);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Given useThrottle', () => {
    it('When initialized, Then it returns the initial value immediately', () => {
      const { result } = renderHook(() => useThrottle('initial', 200));

      expect(result.current).toBe('initial');
    });

    it('When the input changes rapidly, Then it publishes the latest value after the delay', () => {
      const { result, rerender } = renderHook(({ inputText }) => useThrottle(inputText, 200), {
        initialProps: { inputText: 'start' },
      });

      rerender({ inputText: 'update-1' });
      rerender({ inputText: 'final' });

      expect(result.current).toBe('start');

      act(() => {
        jest.advanceTimersByTime(199);
      });

      expect(result.current).toBe('start');

      act(() => {
        jest.advanceTimersByTime(1);
      });

      expect(result.current).toBe('final');
    });
  });

  describe('Given useThrottleFn', () => {
    it('When run repeatedly, Then it invokes immediately and trails with the latest payload', () => {
      const callbackFn = jest.fn();
      const { result } = renderHook(() => useThrottleFn(callbackFn, 200));

      act(() => {
        result.current.run('payload-1');
        result.current.run('payload-2');
        result.current.run('payload-3');
      });

      expect(callbackFn).toHaveBeenCalledWith('payload-1');
      expect(callbackFn).toHaveBeenCalledTimes(1);

      act(() => {
        jest.advanceTimersByTime(200);
      });

      expect(callbackFn).toHaveBeenCalledWith('payload-3');
      expect(callbackFn).toHaveBeenCalledTimes(2);
    });

    it('When canceled before the trailing delay, Then it does not invoke the trailing callback', () => {
      const callbackFn = jest.fn();
      const { result } = renderHook(() => useThrottleFn(callbackFn, 200));

      act(() => {
        result.current.run('payload-1');
        result.current.run('payload-2');
        result.current.cancel();
        jest.advanceTimersByTime(200);
      });

      expect(callbackFn).toHaveBeenCalledWith('payload-1');
      expect(callbackFn).toHaveBeenCalledTimes(1);
    });
  });
});
