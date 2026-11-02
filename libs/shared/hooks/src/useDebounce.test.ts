/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';
import { useDebounce, useDebounceFn } from './useDebounce';

describe('Given useDebounce and useDebounceFn', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Given useDebounce', () => {
    it('When initialized, Then it returns the initial value immediately', () => {
      const { result } = renderHook(() => useDebounce('initial', 200));

      expect(result.current).toBe('initial');
    });

    it('When the input changes rapidly, Then it publishes the latest value after the delay', () => {
      const { result, rerender } = renderHook(({ inputText }) => useDebounce(inputText, 200), {
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

  describe('Given useDebounceFn', () => {
    it('When run, flushed, and canceled, Then it controls trailing callback execution', () => {
      const callbackFn = jest.fn();
      const { result } = renderHook(() => useDebounceFn(callbackFn, 200));

      act(() => {
        result.current.run('payload-1');
        result.current.run('payload-2');
      });

      expect(callbackFn).not.toHaveBeenCalled();

      act(() => {
        result.current.flush();
      });

      expect(callbackFn).toHaveBeenCalledWith('payload-2');
      expect(callbackFn).toHaveBeenCalledTimes(1);

      act(() => {
        result.current.run('payload-3');
        result.current.cancel();
        jest.advanceTimersByTime(200);
      });

      expect(callbackFn).toHaveBeenCalledTimes(1);
    });
  });
});
