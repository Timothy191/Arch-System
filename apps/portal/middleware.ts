import type { NextRequest } from "next/server";
import { proxy } from "./server/proxy";

/**
 * Next.js edge middleware — delegates to server/proxy.ts for:
 * - Supabase session refresh
 * - Role / department route gating (employees table)
 * - Redis-cached department slug → UUID resolution
 * - API exemptions (/api/c66, /api/health, /api/metrics)
 */
export async function middleware(request: NextRequest) {
  return proxy(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|api/|favicon.ico).*)"],
};
