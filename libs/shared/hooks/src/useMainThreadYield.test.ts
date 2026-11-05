/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';
import { useMainThreadYield, yieldToMain } from './useMainThreadYield';

describe('Given useMainThreadYield and yieldToMain (INP main-thread yielding)', () => {
  afterEach(() => {
    const globalObj = globalThis as unknown as { scheduler?: unknown };
    delete globalObj.scheduler;
  });

  it('When scheduler.yield is available, Then yieldToMain delegates to scheduler.yield()', async () => {
    const yieldSpy = jest.fn().mockResolvedValue(undefined);
    (globalThis as unknown as { scheduler: { yield: jest.Mock } }).scheduler = {
      yield: yieldSpy,
    };

    await yieldToMain();
    expect(yieldSpy).toHaveBeenCalledTimes(1);
  });

  it('When scheduler.yield is unavailable, Then yieldToMain falls back to macrotask timer and runAfterPaint executes the transition callback', async () => {
    const { result } = renderHook(() => useMainThreadYield());
    const taskSpy = jest.fn();

    await act(async () => {
      await result.current.runAfterPaint(taskSpy);
    });

    expect(taskSpy).toHaveBeenCalledTimes(1);
  });
});
