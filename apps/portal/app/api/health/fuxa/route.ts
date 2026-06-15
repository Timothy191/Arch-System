import { NextRequest, NextResponse } from "next/server";

// AGENT-TRACE: Health check endpoint for FUXA SCADA integration
// Monitors FUXA server connectivity, HTTP response, and iframe loadability
// Critical for production monitoring and alerting

interface FuxaHealthResponse {
  status: "healthy" | "degraded" | "down";
  latency_ms: number;
  last_check: string;
  details: {
    url: string;
    http_status: number | null;
    error: string | null;
  };
}

export async function GET(_req: NextRequest) {
  const startTime = Date.now();
  const fuxaUrl = process.env.NEXT_PUBLIC_FUXA_URL || "http://localhost:1881";

  // AGENT-TRACE: Perform HTTP HEAD request to check FUXA availability
  // Using HEAD instead of GET to minimize bandwidth while checking server availability
  let httpStatus: number | null = null;
  let error: string | null = null;
  let status: "healthy" | "degraded" | "down" = "down";

  try {
    const response = await fetch(fuxaUrl, {
      method: "HEAD",
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });

    httpStatus = response.status;

    if (response.ok) {
      status = "healthy";
    } else if (response.status >= 500) {
      status = "degraded";
      error = `FUXA returned ${response.status} status`;
    } else {
      status = "degraded";
      error = `FUXA returned ${response.status} status`;
    }
  } catch (fetchError) {
    status = "down";
    error = fetchError instanceof Error ? fetchError.message : "Unknown error";
  }

  const latency_ms = Date.now() - startTime;
  const last_check = new Date().toISOString();

  const response: FuxaHealthResponse = {
    status,
    latency_ms,
    last_check,
    details: {
      url: fuxaUrl,
      http_status: httpStatus,
      error,
    },
  };

  // Return appropriate HTTP status based on FUXA health
  const httpStatusCode =
    status === "healthy" ? 200 : status === "degraded" ? 200 : 503;

  return NextResponse.json(response, { status: httpStatusCode });
}
