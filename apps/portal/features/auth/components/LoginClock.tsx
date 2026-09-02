"use client";

import { Clock } from "@repo/ui/Clock";

/**
 * LoginClock — thin client wrapper that mounts the shared @repo/ui Clock on
 * the server-rendered login page. Isolates client JS to the clock only so the
 * login page can remain a server component for its auth-cookie check.
 *
 * AGENT-TRACE: testid is pinned to "login-clock" to satisfy the existing
 * e2e/visual/login.visual.spec.ts mask contract.
 */
export function LoginClock() {
  return <Clock testId="login-clock" format="time" className="text-[12px] font-medium" />;
}
