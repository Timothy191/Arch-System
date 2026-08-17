import type { NextRequest } from "next/server";
import { proxy as handleProxy } from "./server/proxy";

/**
 * Next.js edge middleware — delegates to server/proxy.ts for:
 * - Supabase session refresh
 * - Role / department route gating (employees table)
 * - Redis-cached department slug → UUID resolution
 * - API exemptions (/api/c66, /api/health, /api/metrics)
 */
export async function proxy(request: NextRequest) {
  return handleProxy(request);
}

export default proxy;

export const config = {
  // Exclude static assets and API routes from middleware.
  matcher: ["/((?!_next/static|_next/image|api/|favicon.ico).*)"],
};
