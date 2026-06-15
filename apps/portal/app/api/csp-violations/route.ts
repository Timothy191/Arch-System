/**
 * CSP Violation Reporting Endpoint
 *
 * Browsers POST Content Security Policy violations here when the policy
 * includes a `report-uri` (or `report-to`) directive. This endpoint:
 *
 * 1. Validates the incoming report structure
 * 2. Logs it via the error logger for production monitoring
 * 3. Returns 204 No Content (as required by the CSP spec)
 *
 * Use this endpoint to gather violation data before tightening the CSP
 * from Report-Only to enforcement mode.
 */

import { logError } from "@/lib/errors/error-logger";

interface CspReport {
  "document-uri": string;
  referrer: string;
  "blocked-uri": string;
  "violated-directive": string;
  "effective-directive": string;
  "original-policy": string;
  disposition: string;
  "script-sample"?: string;
  "status-code": number;
  "source-file"?: string;
  "line-number"?: number;
  "column-number"?: number;
}

export async function POST(req: Request): Promise<Response> {
  try {
    const raw = await req.json();

    // CSP reports can arrive as { "csp-report": { ... } } or wrapped
    const report: CspReport | null = raw["csp-report"] ?? raw.cspReport ?? null;

    if (!report) {
      return new Response(null, { status: 204 });
    }

    const {
      "violated-directive": directive,
      "blocked-uri": blocked,
      "document-uri": doc,
    } = report;

    // Log as a structured error for monitoring/alerting
    logError(new Error(`CSP violation: ${directive}`), {
      context: "csp_violation",
      directive,
      blockedUri: blocked,
      documentUri: doc,
      disposition: report.disposition,
    });

    return new Response(null, { status: 204 });
  } catch {
    // CSP spec says the endpoint must always return 204, even on malformed
    // reports. Silently ignore parse failures.
    return new Response(null, { status: 204 });
  }
}
