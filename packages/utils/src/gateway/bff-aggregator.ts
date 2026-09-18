import type { z } from "@repo/contract";
import { AppError, ValidationError } from "@repo/errors";

export type BffClientTarget = "portal_web" | "c66_scanner" | "scada_client";

export type BffResult<T> =
  | {
      status: "success";
      target: BffClientTarget;
      data: T;
      timestampMs: number;
    }
  | {
      status: "partial";
      target: BffClientTarget;
      data: Partial<T>;
      missingSources: string[];
      timestampMs: number;
    };

export interface AggregationTask<T = unknown> {
  sourceName: string;
  isCritical: boolean;
  fetchFn: () => Promise<T>;
}

export interface AggregateOptions<TCombined, TTarget> {
  target: BffClientTarget;
  tasks: AggregationTask<unknown>[];
  combiner: (results: Record<string, unknown>) => TCombined;
  transformer: (combined: TCombined, target: BffClientTarget) => TTarget;
  schema?: z.ZodSchema<TTarget>;
}

export class AgentBffAggregator {
  public static async aggregate<TCombined, TTarget>(
    options: AggregateOptions<TCombined, TTarget>
  ): Promise<BffResult<TTarget>> {
    const { target, tasks, combiner, transformer, schema } = options;
    const results: Record<string, unknown> = {};
    const missingSources: string[] = [];

    const settledResults = await Promise.allSettled(
      tasks.map(async (task) => {
        const data = await task.fetchFn();
        return { sourceName: task.sourceName, isCritical: task.isCritical, data };
      })
    );

    for (let i = 0; i < settledResults.length; i++) {
      const task = tasks[i];
      const result = settledResults[i];
      if (!task || !result) continue;

      if (result.status === "fulfilled") {
        results[task.sourceName] = result.value.data;
      } else {
        missingSources.push(task.sourceName);
        if (task.isCritical) {
          const reasonMessage =
            result.reason instanceof Error
              ? result.reason.message
              : "Unknown critical source failure";
          throw new AppError(
            `Critical BFF aggregation source '${task.sourceName}' failed: ${reasonMessage}`,
            {
              code: "BFF_CRITICAL_SOURCE_FAILED",
              statusCode: 502,
              context: {
                sourceName: task.sourceName,
                target,
                cause: result.reason instanceof Error ? result.reason : undefined,
              },
            }
          );
        }
      }
    }

    const combinedData = combiner(results);
    const transformedData = transformer(combinedData, target);

    if (schema) {
      const parseResult = schema.safeParse(transformedData);
      if (!parseResult.success) {
        throw new ValidationError("BFF payload failed runtime Zod schema validation", {
          context: { target, issues: parseResult.error.issues },
        });
      }
    }

    const timestampMs = Date.now();

    if (missingSources.length > 0) {
      return {
        status: "partial",
        target,
        data: transformedData as Partial<TTarget>,
        missingSources,
        timestampMs,
      };
    }

    return {
      status: "success",
      target,
      data: transformedData,
      timestampMs,
    };
  }
}
