import { BulkheadRejectedError } from "@repo/errors";

export interface BulkheadOptions {
  name: string;
  maxConcurrentLimitCount?: number;
  maxQueueCapacityCount?: number;
  queueTimeoutMs?: number;
}

export interface BulkheadStats {
  name: string;
  activeCount: number;
  queuedCount: number;
  maxConcurrentLimitCount: number;
  maxQueueCapacityCount: number;
  totalExecutedCount: number;
  totalRejectedCount: number;
}

const DEFAULT_MAX_CONCURRENT_LIMIT_COUNT = 10;
const DEFAULT_MAX_QUEUE_CAPACITY_COUNT = 50;
const DEFAULT_QUEUE_TIMEOUT_MS = 5000;

interface QueueItem<T> {
  fn: () => Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
  timer: NodeJS.Timeout;
}

export class BulkheadPool {
  private readonly name: string;
  private readonly maxConcurrentLimitCount: number;
  private readonly maxQueueCapacityCount: number;
  private readonly queueTimeoutMs: number;

  private activeCount = 0;
  private queue: QueueItem<unknown>[] = [];
  private totalExecutedCount = 0;
  private totalRejectedCount = 0;

  constructor(options: BulkheadOptions) {
    this.name = options.name;
    this.maxConcurrentLimitCount =
      options.maxConcurrentLimitCount ?? DEFAULT_MAX_CONCURRENT_LIMIT_COUNT;
    this.maxQueueCapacityCount = options.maxQueueCapacityCount ?? DEFAULT_MAX_QUEUE_CAPACITY_COUNT;
    this.queueTimeoutMs = options.queueTimeoutMs ?? DEFAULT_QUEUE_TIMEOUT_MS;
  }

  public async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.activeCount < this.maxConcurrentLimitCount) {
      return this.runTask(fn);
    }

    if (this.queue.length >= this.maxQueueCapacityCount) {
      this.totalRejectedCount++;
      throw new BulkheadRejectedError(
        `Bulkhead pool '${this.name}' queue capacity (${this.maxQueueCapacityCount}) exceeded.`,
        {
          poolName: this.name,
          activeCount: this.activeCount,
          queueCapacity: this.maxQueueCapacityCount,
        }
      );
    }

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        const index = this.queue.findIndex((item) => item.timer === timer);
        if (index !== -1) {
          this.queue.splice(index, 1);
          this.totalRejectedCount++;
          reject(
            new BulkheadRejectedError(
              `Bulkhead pool '${this.name}' queued request timed out after ${this.queueTimeoutMs}ms.`,
              {
                poolName: this.name,
                activeCount: this.activeCount,
                queueCapacity: this.maxQueueCapacityCount,
              }
            )
          );
        }
      }, this.queueTimeoutMs);

      this.queue.push({
        fn: fn as () => Promise<unknown>,
        resolve: resolve as (value: unknown) => void,
        reject,
        timer,
      });
    });
  }

  public getStats(): BulkheadStats {
    return {
      name: this.name,
      activeCount: this.activeCount,
      queuedCount: this.queue.length,
      maxConcurrentLimitCount: this.maxConcurrentLimitCount,
      maxQueueCapacityCount: this.maxQueueCapacityCount,
      totalExecutedCount: this.totalExecutedCount,
      totalRejectedCount: this.totalRejectedCount,
    };
  }

  private async runTask<T>(fn: () => Promise<T>): Promise<T> {
    this.activeCount++;
    this.totalExecutedCount++;
    try {
      return await fn();
    } finally {
      this.activeCount--;
      this.processNextQueueItem();
    }
  }

  private processNextQueueItem(): void {
    if (this.activeCount < this.maxConcurrentLimitCount && this.queue.length > 0) {
      const item = this.queue.shift();
      if (item) {
        clearTimeout(item.timer);
        this.runTask(item.fn).then(item.resolve).catch(item.reject);
      }
    }
  }
}
