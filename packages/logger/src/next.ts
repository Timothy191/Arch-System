import type { NextRequest } from "next/server";
import { createChildLogger } from "./server";
import crypto from "crypto";

export type RequestContext = {
  requestId: string;
  method: string;
  url: string;
};

/**
 * Create a request-scoped child logger from a Next.js request.
 */
export function createRouteLogger(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const method = request.method;
  const url = new URL(request.url).pathname;

  return {
    logger: createChildLogger({ requestId, method, url }, "api"),
    context: { requestId, method, url } satisfies RequestContext,
  };
}

/**
 * Higher-order function that wraps a Next.js App Router route handler
 * with automatic request logging, timing, and error capture.
 */
export function withLogging<T>(
  handler: (
    // eslint-disable-next-line no-unused-vars -- Callback type signature parameter
    request: NextRequest & {
      log: ReturnType<typeof createRouteLogger>["logger"];
    },
    // eslint-disable-next-line no-unused-vars -- Callback type signature parameter
    context: { params: Promise<unknown> },
  ) => Promise<T> | T,
) {
  return async (request: NextRequest, routeContext: { params: Promise<unknown> }) => {
    const { logger } = createRouteLogger(request);
    const start = Date.now();

    logger.info("request started");

    try {
      const result = await handler(Object.assign(request, { log: logger }), routeContext);
      const duration = Date.now() - start;
      logger.info(
        { duration, status: result instanceof Response ? result.status : 200 },
        "request completed",
      );
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      logger.error({ duration, err: error }, "request failed");
      throw error;
    }
  };
}
