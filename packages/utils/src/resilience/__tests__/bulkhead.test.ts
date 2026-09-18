import { BulkheadRejectedError } from "@repo/errors";
import { BulkheadPool } from "../bulkhead";

describe("BulkheadPool Resilience Unit Tests", () => {
  it("should execute concurrent operations up to maxConcurrentLimitCount", async () => {
    const bulkhead = new BulkheadPool({
      name: "scada-pool",
      maxConcurrentLimitCount: 2,
      maxQueueCapacityCount: 5,
    });

    let activeCount = 0;
    let maxObservedActive = 0;

    const task = async () => {
      return bulkhead.execute(async () => {
        activeCount++;
        maxObservedActive = Math.max(maxObservedActive, activeCount);
        await new Promise((resolve) => setTimeout(resolve, 50));
        activeCount--;
        return "done";
      });
    };

    const results = await Promise.all([task(), task(), task()]);
    expect(results).toEqual(["done", "done", "done"]);
    expect(maxObservedActive).toBeLessThanOrEqual(2);
    expect(bulkhead.getStats().totalExecutedCount).toBe(3);
  });

  it("should throw BulkheadRejectedError when queue capacity is exceeded", async () => {
    const bulkhead = new BulkheadPool({
      name: "constrained-pool",
      maxConcurrentLimitCount: 1,
      maxQueueCapacityCount: 1,
      queueTimeoutMs: 1000,
    });

    const slowTask = () =>
      bulkhead.execute(() => new Promise((resolve) => setTimeout(resolve, 200)));

    const t1 = slowTask();
    const t2 = slowTask(); // Queued (1/1)

    // t3 exceeds queue capacity
    await expect(slowTask()).rejects.toThrow(BulkheadRejectedError);

    await Promise.all([t1, t2]);
    expect(bulkhead.getStats().totalRejectedCount).toBe(1);
  });
});
