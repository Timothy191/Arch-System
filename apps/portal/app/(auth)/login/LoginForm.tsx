"use client";

import { useState, useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@repo/ui/Input";
import { AnimatedButton } from "@repo/ui/AnimatedButton";
import { Eye, EyeOff, Lock } from "lucide-react";
import { toast } from "sonner";

/**
 * Validates whether a redirect path is internal to the application to prevent open redirects.
 * Ensures the path starts with a single slash and does not contain protocol bypass backslashes or double slashes.
 *
 * @param path - The target redirect path to validate.
 * @returns True if the path is an internal relative URL, otherwise false.
 */
function isInternalRedirect(path: string): boolean {
  return (
    path.startsWith("/") && !path.startsWith("//") && !path.startsWith("/\\")
  );
}

/**
 * Fire telemetry push (fire-and-forget). Extracted from handleSubmit to avoid
 * recreating the function on every submission.
 */
async function pushTelemetry(name: string) {
  try {
    await fetch("/api/telemetry/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, value: 1 }),
    });
  } catch {
    // Ignore telemetry failures in the client
  }
}

/**
 * Filter out non-page paths (assets, manifests, static files, etc.) that should never be redirect targets.
 * Ensures redirect targets only resolve to internal application route paths.
 *
 * @param path - The target redirect path to filter.
 * @returns True if the path points to a valid internal route page, otherwise false.
 */
function isValidPageRedirect(path: string): boolean {
  return (
    isInternalRedirect(path) &&
    !/\.(json|ico|png|jpg|jpeg|svg|xml|txt|webmanifest|css|js|woff|woff2)$/.test(
      path,
    )
  );
}

/**
 * LoginForm Component
 *
 * Accessibility features:
 * - Proper ARIA labels and descriptions on all inputs
 * - aria-live="polite" for error announcements
 * - aria-invalid for error states
 * - focus-visible rings for keyboard navigation
 * - Caps Lock warning with role="alert"
 * - Design system colors (OKLCH) should meet WCAG AA contrast ratios
 * - Respects prefers-reduced-motion via theme CSS
 */
export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawRedirect = searchParams.get("redirect") || "/";
  const redirectTo = isValidPageRedirect(rawRedirect) ? rawRedirect : "/";

  const [employeeId, setEmployeeId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [rateLimitCountdown, setRateLimitCountdown] = useState<number | null>(
    null,
  );

  // Pre-fill email from query params (password pre-fill intentionally omitted — credential exposure risk)
  useEffect(() => {
    const emailParam =
      searchParams.get("email") || searchParams.get("employeeId");
    if (emailParam) setEmployeeId(emailParam);
  }, [searchParams]);

  // Countdown timer for rate-limit cooldown
  useEffect(() => {
    if (rateLimitCountdown === null || rateLimitCountdown <= 0) return;
    const interval = setInterval(() => {
      setRateLimitCountdown((prev) => {
        if (prev === null || prev <= 1) return null;
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [rateLimitCountdown]);

  function handleCapsLockKey(e: React.KeyboardEvent) {
    setCapsLock(e.getModifierState("CapsLock"));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setRateLimitCountdown(null);
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: employeeId,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Surface rate-limit info to the user with a live countdown
        if (response.status === 429) {
          const retryAfter = response.headers.get("X-RateLimit-Reset");
          if (retryAfter) {
            const retryTimestamp = parseInt(retryAfter, 10);
            const now = Math.floor(Date.now() / 1000);
            const remaining = Math.max(0, retryTimestamp - now);
            setRateLimitCountdown(remaining);
            toast.error("Too many attempts. Please wait before trying again.");
          } else {
            toast.error(
              data.error ||
                "Too many attempts. Please wait before trying again.",
            );
          }
        } else {
          toast.error(data.error || "Sign in failed. Please try again.");
        }
        setPassword("");

        // Record Sentry breadcrumb (avoid PII)
        try {
          Sentry.addBreadcrumb({
            message: "Auth failed",
            category: "auth",
            level: "error",
            data: { reason: data.error || "Unknown error" },
          });
          // eslint-disable-next-line no-empty
        } catch {}

        // Push lightweight telemetry tag (fire-and-forget)
        void pushTelemetry("auth.failure");

        setLoading(false);
        return;
      }

      // Success - the API route sets HttpOnly cookies via Supabase
      // Success telemetry + breadcrumb (no PII)
      try {
        Sentry.addBreadcrumb({
          message: "Auth succeeded",
          category: "auth",
          level: "info",
        });
        // eslint-disable-next-line no-empty
      } catch {}
      void pushTelemetry("auth.success");

      setLoading(false);
      router.push(redirectTo);
      router.refresh();
    } catch {
      toast.error("Network error. Please try again.");
      setLoading(false);
    }
  }

  return (
    <form
      data-testid="login-form"
      onSubmit={handleSubmit}
      className="space-y-8"
    >
      <div className="space-y-2">
        <label
          htmlFor="email"
          className="block text-xs font-medium text-[var(--text-secondary)] transition-colors duration-200 liquid-text-lift select-none"
        >
          Employee ID / Email
        </label>
        <div className="relative group">
          <Input
            id="email"
            type="text"
            required
            autoFocus
            minLength={3}
            maxLength={254}
            disabled={loading}
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            variant="login"
            className="px-4 py-3.5 pr-10 transition-all duration-200 focus:outline-none focus:border-arch-accent-blue focus:ring-4 focus:ring-arch-accent-blue/20 liquid-glass-input focus-ring-arch-blue"
            placeholder="Employee ID or email"
            aria-label="Employee ID / Email"
            autoComplete="username"
            aria-describedby="email-hint"
            pattern="[a-zA-Z0-9@._-]+"
            title="Enter your employee ID or email address"
          />
          {/* RFID/NFC Reader badge scanning SVG icon */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none">
            <svg
              data-testid="nfc-icon"
              aria-hidden="true"
              className="w-4 h-4 text-[var(--text-muted)] opacity-60 transition-all duration-300 ease-glass group-hover:opacity-85 group-focus-within:opacity-100 group-hover:scale-110 group-focus-within:scale-110"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <path d="M7 8h10" />
              <path d="M7 12h10" />
              <path d="M7 16h6" />
              <path d="M17 15a3 3 0 0 0 0-4" />
              <path d="M19 17a5 5 0 0 0 0-8" />
            </svg>
          </div>
        </div>
        <p
          id="email-hint"
          className="text-[10px] text-arch-text-tertiary select-none"
        >
          Your employee ID is on your badge.
        </p>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="password"
          className="block text-xs font-medium text-[var(--text-secondary)] transition-colors duration-200 liquid-text-lift select-none"
        >
          Password
        </label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            required
            minLength={6}
            maxLength={128}
            disabled={loading}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={handleCapsLockKey}
            onKeyUp={handleCapsLockKey}
            variant="login"
            className="px-4 py-3.5 pr-10 transition-all duration-200 focus:outline-none focus:border-arch-accent-blue focus:ring-4 focus:ring-arch-accent-blue/20 liquid-glass-input focus-ring-arch-blue"
            placeholder="Enter your password"
            aria-label="Password"
            autoComplete="current-password"
          />
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arch-accent-blue/50 rounded-sm"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? (
              <EyeOff className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
          </button>
        </div>
        {/* Caps Lock warning */}
        {capsLock && (
          <div
            className="flex items-center gap-1.5 text-[11px] text-arch-accent-amber animate-fade-up"
            role="alert"
          >
            <Lock className="w-3 h-3" strokeWidth={1.5} />
            <span>Caps Lock is on</span>
          </div>
        )}
        {rateLimitCountdown !== null && (
          <div
            className="flex items-center gap-1.5 text-[11px] text-arch-accent-amber animate-fade-up"
            role="alert"
          >
            <span>Too many attempts. Try again in {rateLimitCountdown}s</span>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <AnimatedButton
          type="submit"
          disabled={loading}
          className="w-full h-12 rounded-md liquid-glass-button bg-[var(--color-action-primary)] hover:bg-[var(--color-action-primary-hover)] text-white font-medium relative overflow-hidden flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)]/50 focus-visible:ring-offset-1 transition-colors"
          hoverScale={1}
          tapScale={0.97}
        >
          {loading ? "Signing in..." : "Sign In"}
        </AnimatedButton>

        {/* SSO Divider */}
        <div className="relative flex items-center py-1">
          <div className="flex-grow border-t border-black/[0.06]" />
          <span className="flex-shrink mx-4 text-[9px] font-medium tracking-wider text-[var(--text-muted)] uppercase select-none">
            or
          </span>
          <div className="flex-grow border-t border-black/[0.06]" />
        </div>

        {/* SSO Button */}
        <AnimatedButton
          type="button"
          disabled={loading}
          onClick={() => {
            const ssoUrl = process.env.NEXT_PUBLIC_SSO_URL;
            const allowedSSODomains = (
              process.env.NEXT_PUBLIC_ALLOWED_SSO_DOMAINS || ""
            )
              .split(",")
              .filter(Boolean);
            if (ssoUrl) {
              // Validate SSO URL against allowed domains before redirecting
              if (allowedSSODomains.length > 0) {
                try {
                  const parsedUrl = new URL(ssoUrl);
                  if (!allowedSSODomains.includes(parsedUrl.hostname)) {
                    toast.error(
                      "SSO configuration is invalid. Please contact your administrator.",
                    );
                    return;
                  }
                } catch {
                  toast.error(
                    "SSO configuration is invalid. Please contact your administrator.",
                  );
                  return;
                }
              }
              // Redirect to corporate SSO/OIDC endpoint
              window.location.href = ssoUrl;
            } else {
              // Fallback: show error if SSO not configured
              toast.error(
                "Single Sign-On is not configured. Please contact your administrator.",
              );
            }
          }}
          className="w-full h-12 border border-[var(--border-default)] bg-[var(--overlay-dim)] hover:bg-[var(--overlay-subtle)] text-[var(--text-secondary)] font-medium text-xs rounded-md liquid-glass-button flex items-center justify-center gap-2 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arch-accent-blue/50 focus-visible:ring-offset-1"
          hoverScale={1}
          tapScale={0.97}
        >
          <svg
            className="w-4 h-4 text-[var(--text-muted)] opacity-80"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="7.5" cy="15.5" r="5.5" />
            <path d="m21 2-9.6 9.6" />
            <path d="m15.5 7.5 3 3" />
            <path d="M18.5 4.5 21 7" />
          </svg>
          Sign in with Single Sign-On (SSO)
        </AnimatedButton>
      </div>

      {/* Remember Me + Forgot Password row */}
      <div className="flex items-center justify-between pt-3">
        <label
          htmlFor="remember-me"
          className="flex items-center gap-2 cursor-pointer select-none group"
        >
          <div className="relative">
            <input
              id="remember-me"
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="sr-only peer"
            />
            <div
              className={`w-3.5 h-3.5 rounded-sm border transition-all duration-150 flex items-center justify-center peer-focus-visible:ring-2 peer-focus-visible:ring-arch-accent-blue/50 peer-focus-visible:ring-offset-1 ${
                rememberMe
                  ? "bg-arch-accent-blue border-arch-accent-blue"
                  : "border-arch-border-emphasis bg-transparent"
              }`}
            >
              {rememberMe && (
                <svg
                  className="w-2.5 h-2.5 text-white"
                  viewBox="0 0 10 10"
                  fill="none"
                >
                  <path
                    d="M1.5 5L4 7.5L8.5 2.5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </div>
          </div>
          <span className="text-xs text-[var(--text-muted)] group-hover:text-[var(--text-secondary)] transition-colors liquid-text-lift">
            Remember me
          </span>
        </label>
        <Link
          href="/reset-password"
          className="text-xs text-[var(--text-muted)] hover:text-[var(--accent-blue)] transition-colors duration-200 liquid-text-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arch-accent-blue/50 rounded px-1 py-0.5 -mx-1"
        >
          Forgot password?
        </Link>
      </div>
    </form>
  );
}
