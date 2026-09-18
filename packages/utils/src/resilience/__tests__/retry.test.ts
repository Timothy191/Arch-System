import { AuthError, ValidationError } from "@repo/errors";
import { executeWithRetry } from "../retry";

describe("RetryStrategy Unit Tests", () => {
  it("should succeed on first attempt without retrying", async () => {
    const fn = jest.fn().mockResolvedValue("ok");
    const result = await executeWithRetry(fn, { maxRetriesCount: 3 });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("should retry transient failures and succeed on retry attempt", async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error("Transient socket error"))
      .mockResolvedValueOnce("recovered");

    const onRetry = jest.fn();
    const result = await executeWithRetry(fn, {
      maxRetriesCount: 2,
      initialDelayMs: 10,
      jitter: false,
      onRetry,
    });

    expect(result).toBe("recovered");
    expect(fn).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledWith(expect.any(Error), 1, 10);
  });

  it("should not retry non-idempotent operations unless allowNonIdempotentRetry is set", async () => {
    const fn = jest.fn().mockRejectedValue(new Error("Transient error"));

    await expect(
      executeWithRetry(fn, { isIdempotent: false, allowNonIdempotentRetry: false })
    ).rejects.toThrow("Transient error");

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("should fail fast without retrying on non-retryable errors (AuthError, ValidationError)", async () => {
    const authFn = jest.fn().mockRejectedValue(new AuthError("Unauthorized"));

    await expect(
      executeWithRetry(authFn, { maxRetriesCount: 3, initialDelayMs: 10 })
    ).rejects.toThrow("Unauthorized");

    expect(authFn).toHaveBeenCalledTimes(1);

    const valFn = jest.fn().mockRejectedValue(new ValidationError("Invalid payload"));

    await expect(
      executeWithRetry(valFn, { maxRetriesCount: 3, initialDelayMs: 10 })
    ).rejects.toThrow("Invalid payload");

    expect(valFn).toHaveBeenCalledTimes(1);
  });
});
