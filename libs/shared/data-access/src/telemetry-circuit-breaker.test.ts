import { TelemetryCircuitBreaker } from "./telemetry-circuit-breaker";

describe("TelemetryCircuitBreaker", () => {
  it("executes successfully in CLOSED state", async () => {
    const breaker = new TelemetryCircuitBreaker({ failureThreshold: 2 });
    const mockOp = jest.fn().mockResolvedValue("telemetry_payload");

    const result = await breaker.execute(mockOp);

    expect(result).toBe("telemetry_payload");
    expect(breaker.getState()).toBe("CLOSED");
    expect(breaker.getMetrics().successCount).toBe(1);
  });

  it("trips to OPEN state after hitting failure threshold", async () => {
    const breaker = new TelemetryCircuitBreaker({
      failureThreshold: 2,
      maxRetries: 0,
      resetTimeoutMs: 1000,
    });
    const failingOp = jest.fn().mockRejectedValue(new Error("Network timeout"));

    // Attempt 1
    await expect(breaker.execute(failingOp)).rejects.toThrow("Network timeout");
    expect(breaker.getState()).toBe("CLOSED");

    // Attempt 2 (hits failure threshold)
    await expect(breaker.execute(failingOp)).rejects.toThrow("Network timeout");
    expect(breaker.getState()).toBe("OPEN");

    // Next call fails fast without invoking operation
    const fallbackFn = jest.fn().mockReturnValue("cached_fallback_data");
    const fallbackResult = await breaker.execute(failingOp, fallbackFn);
    expect(fallbackResult).toBe("cached_fallback_data");
    expect(fallbackFn).toHaveBeenCalled();
  });

  it("recovers from OPEN to HALF_OPEN after cooldown and transitions to CLOSED on success", async () => {
    jest.useFakeTimers();
    const breaker = new TelemetryCircuitBreaker({
      failureThreshold: 1,
      maxRetries: 0,
      resetTimeoutMs: 500,
    });

    const failingOp = jest.fn().mockRejectedValue(new Error("Connection error"));
    await expect(breaker.execute(failingOp)).rejects.toThrow("Connection error");
    expect(breaker.getState()).toBe("OPEN");

    // Fast-forward past resetTimeoutMs
    jest.advanceTimersByTime(600);
    expect(breaker.getState()).toBe("HALF_OPEN");

    // Successful trial execution restores CLOSED state
    const successOp = jest.fn().mockResolvedValue("recovered_data");
    const result = await breaker.execute(successOp);
    expect(result).toBe("recovered_data");
    expect(breaker.getState()).toBe("CLOSED");

    jest.useRealTimers();
  });
});
