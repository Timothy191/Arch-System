"use client";

import { useLogin } from "@repo/auth/data-access";
import { isValidPageRedirect } from "@repo/auth/utils";
import { AnimatedButton } from "@repo/ui/AnimatedButton";
import { Checkbox } from "@repo/ui/Checkbox";
import { Input } from "@repo/ui/Input";
import { Eye, EyeOff, Loader2, Lock } from "lucide-react";
import NextImage from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

// Named constraints & Zero-Magic Invariants (REFAC-01)
const MIN_EMPLOYEE_ID_LENGTH = 3;
const MAX_EMAIL_LENGTH = 254;
const MIN_PASSWORD_LENGTH = 6;
const MAX_PASSWORD_LENGTH = 128;
const BUTTON_HOVER_SCALE = 1.02;
const BUTTON_TAP_SCALE = 0.97;
const DEFAULT_AUTH_REDIRECT = "/";
const AUTHENTICATED_HOME_REDIRECT = "/hub";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmailFormat(val: string): boolean {
  return EMAIL_REGEX.test(val);
}

export interface LoginFormProps {
  initialRedirect?: string;
}

export function LoginForm({ initialRedirect }: LoginFormProps = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawRedirect = initialRedirect || searchParams.get("redirect") || DEFAULT_AUTH_REDIRECT;
  const redirectTo =
    isValidPageRedirect(rawRedirect) && !rawRedirect.startsWith("/login")
      ? rawRedirect
      : DEFAULT_AUTH_REDIRECT;

  const [employeeId, setEmployeeId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [passwordError, setPasswordError] = useState("");

  const { login, loading, rateLimitCountdown } = useLogin();
  const isRateLimited = rateLimitCountdown !== null && rateLimitCountdown > 0;

  useEffect(() => {
    const emailParam = searchParams.get("email") || searchParams.get("employeeId");
    if (emailParam) setEmployeeId(emailParam);
  }, [searchParams]);

  const handleCapsLockKey = useCallback((e: React.KeyboardEvent) => {
    setCapsLock(e.getModifierState("CapsLock"));
  }, []);

  const handleEmailBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    const value = e.target.value.trim();
    if (value.includes("@") && !isValidEmailFormat(value)) {
      toast.error("Please enter a valid email address");
    }
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setPasswordError("");

      if (isRateLimited) return;

      if (!employeeId.trim() || password.length < MIN_PASSWORD_LENGTH) {
        setPasswordError("Invalid email/employee ID or password");
        return;
      }

      const result = await login(employeeId, password);
      if (result?.success) {
        if (typeof window !== "undefined" && window.location && process.env.NODE_ENV !== "test") {
          const destination =
            redirectTo === DEFAULT_AUTH_REDIRECT ? AUTHENTICATED_HOME_REDIRECT : redirectTo;
          window.location.assign(destination);
        } else {
          router.push(redirectTo);
          router.refresh();
        }
      } else {
        setPasswordError("Invalid email/employee ID or password");
      }
    },
    [employeeId, isRateLimited, login, password, redirectTo, router]
  );

  const passwordDescribedBy =
    [
      passwordError ? "password-error" : null,
      capsLock ? "caps-lock-warning" : null,
      rateLimitCountdown !== null ? "rate-limit-warning" : null,
    ]
      .filter(Boolean)
      .join(" ") || undefined;

  return (
    <form data-testid="login-form" noValidate onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <label
          htmlFor="email"
          className="block text-xs font-semibold text-[var(--text-heading,#1d1d1f)] select-none cursor-pointer"
        >
          <span id="email-label">Employee ID / Email</span>
        </label>
        <div className="relative group">
          <Input
            id="email"
            type="email"
            required
            autoFocus
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            minLength={MIN_EMPLOYEE_ID_LENGTH}
            maxLength={MAX_EMAIL_LENGTH}
            disabled={loading || isRateLimited}
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            onFocus={(e) => e.target.select()}
            onBlur={handleEmailBlur}
            variant="login"
            className="px-4 py-3.5 pr-10 text-sm text-[var(--text-heading,#1d1d1f)] bg-white/70 backdrop-blur-md border border-black/15 rounded-xl shadow-inner transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-white focus:outline focus:outline-2 focus:outline-[var(--accent-blue,#0066ff)]"
            placeholder="Employee ID or email"
            aria-labelledby="email-label"
            autoComplete="username"
            aria-describedby="email-hint"
          />
        </div>
        <p
          id="email-hint"
          className="text-[11px] font-medium text-[var(--text-secondary,#6e6e73)] select-none"
        >
          Your employee ID is on your badge.
        </p>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="password"
          className="block text-xs font-semibold text-[var(--text-heading,#1d1d1f)] select-none cursor-pointer"
        >
          <span id="password-label">Password</span>
        </label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            required
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            minLength={MIN_PASSWORD_LENGTH}
            maxLength={MAX_PASSWORD_LENGTH}
            disabled={loading || isRateLimited}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setPasswordError("");
            }}
            onFocus={(e) => e.target.select()}
            onKeyDown={handleCapsLockKey}
            onKeyUp={handleCapsLockKey}
            variant="login"
            className="px-4 py-3.5 pr-10 text-sm text-[var(--text-heading,#1d1d1f)] bg-white/70 backdrop-blur-md border border-black/15 rounded-xl shadow-inner transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-white focus:outline focus:outline-2 focus:outline-[var(--accent-blue,#0066ff)]"
            placeholder="Enter your password"
            aria-labelledby="password-label"
            aria-invalid={Boolean(passwordError)}
            aria-describedby={passwordDescribedBy}
            autoComplete="current-password"
          />
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary,#6e6e73)] hover:text-[var(--text-heading,#1d1d1f)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent-blue,#0066ff)] rounded-sm"
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-controls="password"
            aria-pressed={showPassword}
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {passwordError && (
          <div
            id="password-error"
            className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--palette-semantic-danger,#d22118)] animate-fade-up"
            role="alert"
            aria-live="assertive"
          >
            <span>{passwordError}</span>
          </div>
        )}
        {capsLock && (
          <div
            id="caps-lock-warning"
            className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--palette-semantic-warning,#d97706)] animate-fade-up"
            role="alert"
            aria-live="polite"
          >
            <Lock className="w-3 h-3" strokeWidth={1.5} />
            <span>Caps Lock is on</span>
          </div>
        )}
        {rateLimitCountdown !== null && (
          <div
            id="rate-limit-warning"
            className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--palette-semantic-warning,#d97706)] animate-fade-up"
            role="alert"
            aria-live="polite"
          >
            <span>Too many attempts. Try again in {rateLimitCountdown}s</span>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4 group">
        <AnimatedButton
          type="submit"
          disabled={loading || isRateLimited}
          className="w-full h-12 rounded-xl liquid-glass-button bg-[var(--accent-blue,#0066ff)] hover:brightness-95 active:brightness-90 text-white text-sm font-semibold tracking-wide relative overflow-hidden flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent-blue,#0066ff)] transition-all duration-200 shadow-md border border-white/30"
          hoverScale={BUTTON_HOVER_SCALE}
          tapScale={BUTTON_TAP_SCALE}
        >
          <span className="pointer-events-none absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-white/60 to-transparent z-10" />
          {loading ? (
            <span className="flex items-center gap-2 drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)] relative z-20">
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              <span>Accessing your workspace...</span>
            </span>
          ) : (
            <span className="drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)] relative z-20 font-semibold">
              Access Arch Systems
            </span>
          )}
        </AnimatedButton>
      </div>

      <div className="flex items-center justify-between pt-1">
        <Checkbox
          id="remember-me"
          checked={rememberMe}
          onChange={(e) => setRememberMe(e.target.checked)}
          label="Remember me"
          className="text-xs font-medium text-[var(--text-secondary,#6e6e73)] hover:text-[var(--text-heading,#1d1d1f)] transition-colors"
        />
        <Link
          href={`/reset-password?email=${encodeURIComponent(employeeId)}`}
          className="text-xs font-medium text-[var(--text-secondary,#6e6e73)] hover:text-[var(--accent-blue,#0066ff)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent-blue,#0066ff)] rounded px-1 py-0.5 -mx-1"
        >
          Forgot password?
        </Link>
      </div>

      <div className="flex items-center justify-center gap-2 pt-2 border-t border-black/10 text-[11px] text-[var(--text-secondary,#6e6e73)] select-none">
        <span className="font-mono text-[10px] tracking-wider uppercase font-medium">
          AI Engine
        </span>
        <span className="opacity-40">•</span>
        <NextImage
          src="/images/ai-sdk/ai-sdk-logotype-light.svg"
          alt="Powered by Vercel AI SDK"
          width={78}
          height={16}
          className="h-4 w-auto object-contain opacity-80 hover:opacity-100 transition-opacity"
        />
      </div>
    </form>
  );
}

/**
 * High-fidelity zero-CLS skeleton matching LoginForm layout.
 * Used inside Suspense boundaries for streaming SSR per Vercel React Best Practices.
 */
export function LoginFormSkeleton() {
  return (
    <div data-testid="login-form-skeleton" className="space-y-6 animate-pulse" aria-hidden="true">
      <div className="space-y-2">
        <div className="h-3 w-28 rounded bg-[var(--text-heading,#1d1d1f)]/10" />
        <div className="h-11 w-full rounded-xl bg-white/50 border border-black/10" />
        <div className="h-2.5 w-44 rounded bg-[var(--text-secondary,#6e6e73)]/10" />
      </div>
      <div className="space-y-2">
        <div className="h-3 w-16 rounded bg-[var(--text-heading,#1d1d1f)]/10" />
        <div className="h-11 w-full rounded-xl bg-white/50 border border-black/10" />
      </div>
      <div className="h-12 w-full rounded-xl bg-[var(--accent-blue,#0066ff)]/20" />
      <div className="flex items-center justify-between pt-1">
        <div className="h-4 w-24 rounded bg-[var(--text-secondary,#6e6e73)]/10" />
        <div className="h-4 w-24 rounded bg-[var(--text-secondary,#6e6e73)]/10" />
      </div>
      <div className="flex items-center justify-center gap-2 pt-2 border-t border-black/10">
        <div className="h-3 w-28 rounded bg-[var(--text-secondary,#6e6e73)]/10" />
      </div>
    </div>
  );
}
