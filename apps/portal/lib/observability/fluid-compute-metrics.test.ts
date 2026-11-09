import {
  endFluidComputeSpan,
  type FluidComputeMetrics,
  resetFluidComputeMetrics,
  startFluidComputeSpan,
  trackWaitUntilDuration,
} from './fluid-compute-metrics';

describe('fluid-compute-metrics', () => {
  beforeEach(() => {
    resetFluidComputeMetrics();
  });

  it('tracks start, end, and waitUntil durations without errors', () => {
    const started = startFluidComputeSpan('shiftCloseout');
    expect(started.startTime).toBeGreaterThan(0);

    endFluidComputeSpan({
      functionName: 'shiftCloseout',
      durationMs: 120,
      isSuccess: true,
    });
    trackWaitUntilDuration(20, 'shiftCloseout');

    const sample: FluidComputeMetrics = {
      activeConcurrency: 0,
      totalActiveMs: 100,
      totalDurationMs: 120,
      invocationCount: 1,
      coldStartCount: 0,
      lastReset: Date.now(),
      errors: 0,
    };
    expect(sample.invocationCount).toBe(1);
  });
});
