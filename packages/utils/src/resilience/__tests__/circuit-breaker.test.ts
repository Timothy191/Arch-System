import { CircuitBreakerOpenError } from "@repo/errors";
import { CircuitBreaker } from "../circuit-breaker";

describe("CircuitBreaker Resilience Unit Tests", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("should start in CLOSED state and execute successful calls", async () => {
    const cb = new CircuitBreaker<string>({ name: "test-service" });
    expect(cb.getState()).toBe("CLOSED");

    const result = await cb.execute(async () => "success");
    expect(result).toBe("success");
    expect(cb.getMetrics().successfulCallsCount).toBe(1);
  });

  it("should transition to OPEN state when failure threshold is reached", async () => {
    const cb = new CircuitBreaker<string>({
      name: "test-service",
      failureThresholdCount: 3,
      resetTimeoutMs: 5000,
    });

    const failingOperation = async () => {
      throw new Error("Service unavailable");
    };

    for (let i = 0; i < 3; i++) {
      await expect(cb.execute(failingOperation)).rejects.toThrow("Service unavailable");
    }

    expect(cb.getState()).toBe("OPEN");
    await expect(cb.execute(async () => "test")).rejects.toThrow(CircuitBreakerOpenError);
  });

  it("should invoke fallback when OPEN state if fallback is provided", async () => {
    const cb = new CircuitBreaker<string>({
      name: "test-service",
      failureThresholdCount: 1,
      fallback: () => "fallback-response",
    });

    await expect(
      cb.execute(async () => {
        throw new Error("Failed");
      })
    ).resolves.toBe("fallback-response");

    expect(cb.getState()).toBe("OPEN");

    const result = await cb.execute(async () => "should-not-run");
    expect(result).toBe("fallback-response");
  });

  it("should transition to HALF_OPEN after resetTimeoutMs and then CLOSED on success", async () => {
    const cb = new CircuitBreaker<string>({
      name: "test-service",
      failureThresholdCount: 2,
      resetTimeoutMs: 5000,
      halfOpenTrialCount: 1,
    });

    for (let i = 0; i < 2; i++) {
      await expect(
        cb.execute(async () => {
          throw new Error("Fail");
        })
      ).rejects.toThrow();
    }

    expect(cb.getState()).toBe("OPEN");

    // Fast-forward time past resetTimeoutMs
    jest.advanceTimersByTime(6000);

    expect(cb.getState()).toBe("HALF_OPEN");

    const probeResult = await cb.execute(async () => "recovered");
    expect(probeResult).toBe("recovered");
    expect(cb.getState()).toBe("CLOSED");
  });
});
