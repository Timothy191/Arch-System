import { useState } from "react";
import * as Sentry from "@sentry/nextjs";
import { toast } from "sonner";

async function pushTelemetry(name: string) {
  try {
    await fetch("/api/telemetry/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, value: 1 }),
    });
  } catch {
    /* ignore */
  }
}

export function useLogin() {
  const [loading, setLoading] = useState(false);
  const [rateLimitCountdown, setRateLimitCountdown] = useState<number | null>(null);

  const login = async (employeeId: string, password: string) => {
    setRateLimitCountdown(null);
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: employeeId, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 429) {
          const retryAfter = response.headers.get("X-RateLimit-Reset");
          if (retryAfter) {
            const retryTimestamp = parseInt(retryAfter, 10);
            const remaining = Math.max(0, retryTimestamp - Math.floor(Date.now() / 1000));
            setRateLimitCountdown(remaining);
          }
          toast.error(data.error || "Too many attempts.");
        } else {
          toast.error(data.error || "Sign in failed.");
        }

        Sentry.addBreadcrumb({
          message: "Auth failed",
          category: "auth",
          level: "error",
          data: { reason: data.error },
        });
        void pushTelemetry("auth.failure");
        setLoading(false);
        return { success: false };
      }

      Sentry.addBreadcrumb({ message: "Auth succeeded", category: "auth", level: "info" });
      void pushTelemetry("auth.success");
      setLoading(false);
      return { success: true };
    } catch {
      toast.error("Network error. Please try again.");
      setLoading(false);
      return { success: false };
    }
  };

  return { login, loading, rateLimitCountdown, setRateLimitCountdown };
}
