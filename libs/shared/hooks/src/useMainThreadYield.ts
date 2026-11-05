import { useCallback, useTransition } from 'react';

interface GlobalScheduler {
  yield?: () => Promise<void>;
}

/**
 * Yields control back to the browser main thread so pending input events and
 * visual frame paints complete before heavy JavaScript work continues.
 * Uses the native Prioritized Task Scheduling API (`scheduler.yield()`) when
 * available, falling back to `setTimeout(..., 0)`.
 */
export async function yieldToMain(): Promise<void> {
  const globalWithScheduler = globalThis as unknown as {
    scheduler?: GlobalScheduler;
  };
  if (typeof globalWithScheduler.scheduler?.yield === 'function') {
    await globalWithScheduler.scheduler.yield();
    return;
  }
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
}

export interface UseMainThreadYieldReturn {
  isPending: boolean;
  runAfterPaint: (task: () => void) => Promise<void>;
}

/**
 * React 19 INP optimization hook (<200ms target).
 * Yields to the browser main thread so urgent visual feedback paints first,
 * then schedules the non-urgent state update inside `startTransition`.
 */
export function useMainThreadYield(): UseMainThreadYieldReturn {
  const [isPending, startTransition] = useTransition();

  const runAfterPaint = useCallback(async (task: () => void): Promise<void> => {
    await yieldToMain();
    startTransition(() => {
      task();
    });
  }, []);

  return {
    isPending,
    runAfterPaint,
  };
}
