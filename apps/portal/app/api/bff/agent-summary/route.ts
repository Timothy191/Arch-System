import { z } from "@repo/contract/schemas/common.schema";
import { isAppError } from "@repo/errors";
import {
  AgentBffAggregator,
  ApiGateway,
  type BffClientTarget,
  BulkheadPool,
  CircuitBreaker,
  executeWithRetry,
  type GatewayRequest,
  type GatewayResponse,
} from "@repo/utils";
import { type NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Named Constants with Unit Suffixes (REFAC-01)
// ---------------------------------------------------------------------------

const MAX_RETRY_COUNT = 3;
const INITIAL_RETRY_DELAY_MS = 150;
const MAX_RETRY_DELAY_MS = 3000;
const CIRCUIT_RESET_TIMEOUT_MS = 10000;
const CIRCUIT_FAILURE_THRESHOLD_COUNT = 3;
const BULKHEAD_MAX_CONCURRENT_LIMIT_COUNT = 5;
const BULKHEAD_MAX_QUEUE_CAPACITY_COUNT = 20;

// ---------------------------------------------------------------------------
// Schemas & Composable Types (REFAC-09 & REFAC-11)
// ---------------------------------------------------------------------------

export const AgentSummaryResponseSchema = z.object({
  target: z.string(),
  operatorId: z.string(),
  shiftId: z.string(),
  activeDeviceCount: z.number(),
  systemHealthStatus: z.enum(["healthy", "degraded", "critical"]),
  timestampMs: z.number(),
});

export type AgentSummaryResponse = z.infer<typeof AgentSummaryResponseSchema>;

// ---------------------------------------------------------------------------
// Parameter Objects (REFAC-06)
// ---------------------------------------------------------------------------

export interface FetchAgentSummaryParams {
  operatorId: string;
  shiftId: string;
  target: BffClientTarget;
}

// ---------------------------------------------------------------------------
// Resilience Pool Singletons
// ---------------------------------------------------------------------------

const scadaCircuitBreaker = new CircuitBreaker<{ deviceCount: number }>({
  name: "scada-telemetry-breaker",
  failureThresholdCount: CIRCUIT_FAILURE_THRESHOLD_COUNT,
  resetTimeoutMs: CIRCUIT_RESET_TIMEOUT_MS,
  fallback: () => ({ deviceCount: 0 }),
});

const scadaBulkhead = new BulkheadPool({
  name: "scada-bulkhead-pool",
  maxConcurrentLimitCount: BULKHEAD_MAX_CONCURRENT_LIMIT_COUNT,
  maxQueueCapacityCount: BULKHEAD_MAX_QUEUE_CAPACITY_COUNT,
});

// ---------------------------------------------------------------------------
// API Gateway Setup (Centralized Concerns)
// ---------------------------------------------------------------------------

const gateway = new ApiGateway();

// Gateway Middleware: Authentication & Context Setup
gateway.use(async (req, next) => {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader && req.path.startsWith("/api/bff")) {
    // Basic auth check for demonstration
  }
  return next();
});

// Gateway Route Registration with Attached CircuitBreaker & Bulkhead
gateway.registerRoute({
  method: "POST",
  path: "/api/bff/agent-summary",
  circuitBreakerOptions: {
    name: "agent-summary-gateway-cb",
    failureThresholdCount: 5,
  },
  bulkheadOptions: {
    name: "agent-summary-gateway-bh",
    maxConcurrentLimitCount: 10,
  },
  handler: async (req: GatewayRequest): Promise<GatewayResponse<unknown>> => {
    const body = (req.body as FetchAgentSummaryParams) || {};
    const target = body.target || "portal_web";
    const operatorId = body.operatorId || "op_default";
    const shiftId = body.shiftId || "shift_current";

    // Call Backend-for-Frontend Aggregator (BFF)
    const bffResult = await AgentBffAggregator.aggregate({
      target,
      tasks: [
        {
          sourceName: "operator_service",
          isCritical: true,
          fetchFn: () =>
            executeWithRetry(
              async () => ({
                id: operatorId,
                status: "active",
              }),
              {
                maxRetriesCount: MAX_RETRY_COUNT,
                initialDelayMs: INITIAL_RETRY_DELAY_MS,
                maxDelayMs: MAX_RETRY_DELAY_MS,
                isIdempotent: true,
              }
            ),
        },
        {
          sourceName: "scada_telemetry",
          isCritical: false,
          fetchFn: () =>
            scadaBulkhead.execute(() =>
              scadaCircuitBreaker.execute(async () => ({
                deviceCount: 12,
              }))
            ),
        },
      ],
      combiner: (results) => ({
        op: results.operator_service as { id: string; status: string } | undefined,
        scada: results.scada_telemetry as { deviceCount: number } | undefined,
      }),
      transformer: (combined, t): AgentSummaryResponse => ({
        target: t,
        operatorId: combined.op?.id || operatorId,
        shiftId,
        activeDeviceCount: combined.scada?.deviceCount ?? 0,
        systemHealthStatus: combined.scada ? "healthy" : "degraded",
        timestampMs: Date.now(),
      }),
      schema: AgentSummaryResponseSchema,
    });

    return {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: bffResult,
    };
  },
});

// ---------------------------------------------------------------------------
// Next.js App Router Route Handlers
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    let bodyPayload: unknown = {};
    try {
      bodyPayload = await request.json();
    } catch {
      // Empty or non-JSON body
    }

    const headersRecord: Record<string, string> = {};
    request.headers.forEach((val, key) => {
      headersRecord[key.toLowerCase()] = val;
    });

    const gatewayReq: GatewayRequest = {
      path: "/api/bff/agent-summary",
      method: "POST",
      headers: headersRecord,
      body: bodyPayload,
    };

    const gatewayRes = await gateway.handleRequest(gatewayReq);

    return NextResponse.json(gatewayRes.body, {
      status: gatewayRes.statusCode,
      headers: gatewayRes.headers,
    });
  } catch (error) {
    const isApp = isAppError(error);
    const statusCode = isApp && error.statusCode ? error.statusCode : 500;
    const message = error instanceof Error ? error.message : "Internal Server Error";

    return NextResponse.json(
      {
        success: false,
        error: message,
        code: isApp && error.code ? error.code : "SERVER_ERROR",
      },
      { status: statusCode }
    );
  }
}
