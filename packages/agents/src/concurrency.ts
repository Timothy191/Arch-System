export type LimitFunction = <T>(taskFn: () => Promise<T>) => Promise<T>;

/**
 * Lightweight, zero-dependency async concurrency limiter.
 * Limits simultaneous in-flight promise execution to a fixed concurrency window.
 */
export function createConcurrencyLimiter(concurrency: number): LimitFunction {
  let activeCount = 0;
  const waitQueue: Array<() => void> = [];

  const processNext = () => {
    activeCount -= 1;
    if (waitQueue.length > 0) {
      const nextResolver = waitQueue.shift();
      if (nextResolver) nextResolver();
    }
  };

  return async <T>(taskFn: () => Promise<T>): Promise<T> => {
    if (activeCount >= concurrency) {
      await new Promise<void>((resolve) => waitQueue.push(resolve));
    }
    activeCount += 1;
    try {
      return await taskFn();
    } finally {
      processNext();
    }
  };
}
