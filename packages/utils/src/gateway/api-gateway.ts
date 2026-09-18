import { AppError } from "@repo/errors";
import { type BulkheadOptions, BulkheadPool } from "../resilience/bulkhead";
import { CircuitBreaker, type CircuitBreakerOptions } from "../resilience/circuit-breaker";

export interface GatewayRequest {
  path: string;
  method: string;
  headers: Record<string, string>;
  body?: unknown;
  query?: Record<string, string>;
}

export interface GatewayResponse<T = unknown> {
  statusCode: number;
  headers: Record<string, string>;
  body: T;
}

export type GatewayMiddleware = (
  req: GatewayRequest,
  next: () => Promise<GatewayResponse>
) => Promise<GatewayResponse>;

export interface RouteConfig {
  method: string;
  path: string;
  handler: (req: GatewayRequest) => Promise<GatewayResponse>;
  circuitBreaker?: CircuitBreaker<unknown>;
  bulkhead?: BulkheadPool;
}

const CORRELATION_ID_HEADER = "x-correlation-id";
const DEFAULT_HTTP_NOT_FOUND_STATUS = 404;
const DEFAULT_HTTP_INTERNAL_ERROR_STATUS = 500;

export class ApiGateway {
  private middlewares: GatewayMiddleware[] = [];
  private routes: RouteConfig[] = [];

  public use(middleware: GatewayMiddleware): void {
    this.middlewares.push(middleware);
  }

  public registerRoute(options: {
    method: string;
    path: string;
    handler: (req: GatewayRequest) => Promise<GatewayResponse>;
    circuitBreakerOptions?: CircuitBreakerOptions<unknown>;
    bulkheadOptions?: BulkheadOptions;
  }): void {
    const circuitBreaker = options.circuitBreakerOptions
      ? new CircuitBreaker(options.circuitBreakerOptions)
      : undefined;
    const bulkhead = options.bulkheadOptions
      ? new BulkheadPool(options.bulkheadOptions)
      : undefined;

    this.routes.push({
      method: options.method.toUpperCase(),
      path: options.path,
      handler: options.handler,
      circuitBreaker,
      bulkhead,
    });
  }

  public async handleRequest(req: GatewayRequest): Promise<GatewayResponse> {
    const headers = { ...req.headers };
    if (!headers[CORRELATION_ID_HEADER]) {
      headers[CORRELATION_ID_HEADER] =
        `cor_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }
    const normalizedReq: GatewayRequest = {
      ...req,
      method: req.method.toUpperCase(),
      headers,
    };

    const dispatchMiddleware = (index: number): Promise<GatewayResponse> => {
      if (index < this.middlewares.length) {
        const middleware = this.middlewares[index];
        if (middleware) {
          return middleware(normalizedReq, () => dispatchMiddleware(index + 1));
        }
      }
      return this.dispatchRoute(normalizedReq);
    };

    const correlationId = normalizedReq.headers[CORRELATION_ID_HEADER] ?? "";

    try {
      const response = await dispatchMiddleware(0);
      return {
        ...response,
        headers: {
          [CORRELATION_ID_HEADER]: correlationId,
          ...response.headers,
        },
      };
    } catch (error) {
      return this.formatErrorResponse(error, correlationId);
    }
  }

  private async dispatchRoute(req: GatewayRequest): Promise<GatewayResponse> {
    const route = this.routes.find((r) => r.method === req.method && r.path === req.path);

    if (!route) {
      return {
        statusCode: DEFAULT_HTTP_NOT_FOUND_STATUS,
        headers: {
          "content-type": "application/json",
          [CORRELATION_ID_HEADER]: req.headers[CORRELATION_ID_HEADER] || "",
        },
        body: {
          success: false,
          error: `Route not found: ${req.method} ${req.path}`,
          code: "ROUTE_NOT_FOUND",
        },
      };
    }

    const executeHandler = (): Promise<GatewayResponse> => route.handler(req);

    const executeWithBulkhead = (): Promise<GatewayResponse> => {
      if (route.bulkhead) {
        return route.bulkhead.execute(executeHandler);
      }
      return executeHandler();
    };

    const executeWithCircuitBreaker = (): Promise<GatewayResponse> => {
      if (route.circuitBreaker) {
        return route.circuitBreaker.execute(executeWithBulkhead) as Promise<GatewayResponse>;
      }
      return executeWithBulkhead();
    };

    return executeWithCircuitBreaker();
  }

  private formatErrorResponse(error: unknown, correlationId: string): GatewayResponse {
    const statusCode =
      error instanceof AppError && error.statusCode
        ? error.statusCode
        : DEFAULT_HTTP_INTERNAL_ERROR_STATUS;
    const code = error instanceof AppError && error.code ? error.code : "INTERNAL_SERVER_ERROR";
    const message = error instanceof Error ? error.message : "An unexpected server error occurred";

    return {
      statusCode,
      headers: {
        "content-type": "application/json",
        [CORRELATION_ID_HEADER]: correlationId,
      },
      body: {
        success: false,
        error: message,
        code,
        correlationId,
      },
    };
  }
}
