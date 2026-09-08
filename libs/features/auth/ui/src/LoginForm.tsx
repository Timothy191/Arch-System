"use client";

import { useLogin } from "@repo/auth/data-access";
import { isValidPageRedirect } from "@repo/auth/utils";
import { AnimatedButton } from "@repo/ui/AnimatedButton";
import { Checkbox } from "@repo/ui/Checkbox";
import { Input } from "@repo/ui/Input";
import { Eye, EyeOff, Loader2, Lock } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawRedirect = searchParams.get("redirect") || "/";
  const redirectTo =
    isValidPageRedirect(rawRedirect) && !rawRedirect.startsWith("/login") ? rawRedirect : "/";

  const [employeeId, setEmployeeId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [passwordError, setPasswordError] = useState("");

  const { login, loading, rateLimitCountdown, setRateLimitCountdown } = useLogin();
  const isRateLimited = rateLimitCountdown !== null && rateLimitCountdown > 0;

  useEffect(() => {
    const emailParam = searchParams.get("email") || searchParams.get("employeeId");
    if (emailParam) setEmployeeId(emailParam);
  }, [searchParams]);

  function handleCapsLockKey(e: React.KeyboardEvent) {
    setCapsLock(e.getModifierState("CapsLock"));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError("");

    if (isRateLimited) return;

    // Client-side length sanity checks only
    if (password.length < 6) {
      setPasswordError("Invalid email/employee ID or password");
      return;
    }

    const result = await login(employeeId, password);
    if (result?.success) {
      if (typeof window !== "undefined" && window.location && process.env.NODE_ENV !== "test") {
        const destination = redirectTo === "/" ? "/hub" : redirectTo;
        window.location.assign(destination);
      } else {
        router.push(redirectTo);
        router.refresh();
      }
    } else {
      setPasswordError("Invalid email/employee ID or password");
    }
  }

  return (
    <form data-testid="login-form" onSubmit={handleSubmit} className="space-y-8">
      <div className="space-y-2">
        <label
          htmlFor="email"
          className="block text-xs font-medium text-black transition-colors duration-200 liquid-text-lift select-none cursor-pointer"
        >
          <span id="email-label">Employee ID / Email</span>
        </label>
        <div className="relative group">
          <Input
            id="email"
            type="email"
            required
            autoFocus
            minLength={3}
            maxLength={254}
            disabled={loading || isRateLimited}
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            onFocus={(e) => e.target.select()}
            onBlur={(e) => {
              if (e.target.value && !e.target.value.includes("@")) {
                // Allow employee IDs without @, but validate email format if @ is present
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (e.target.value.includes("@") && !emailRegex.test(e.target.value)) {
                  toast.error("Please enter a valid email address");
                }
              }
            }}
            variant="login"
            className="px-4 py-3.5 pr-10 transition-all duration-200 focus:outline-none focus:border-arch-accent-blue focus:ring-4 focus:ring-arch-accent-blue/20 liquid-glass-input focus-ring-arch-blue"
            placeholder="Employee ID or email"
            aria-labelledby="email-label"
            autoComplete="username"
            aria-describedby="email-hint"
          />
        </div>
        <p id="email-hint" className="text-[10px] text-black select-none">
          Your employee ID is on your badge.
        </p>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="password"
          className="block text-xs font-medium text-black transition-colors duration-200 liquid-text-lift select-none cursor-pointer"
        >
          <span id="password-label">Password</span>
        </label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            required
            minLength={6}
            maxLength={128}
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
            className="px-4 py-3.5 pr-10 transition-all duration-200 focus:outline-none focus:border-arch-accent-blue focus:ring-4 focus:ring-arch-accent-blue/20 liquid-glass-input focus-ring-arch-blue"
            placeholder="Enter your password"
            aria-labelledby="password-label"
            autoComplete="current-password"
          />
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-black/80 hover:text-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arch-accent-blue/50 rounded-sm"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {passwordError && (
          <div
            className="flex items-center gap-1.5 text-[11px] text-arch-accent-red animate-fade-up"
            role="alert"
            aria-live="assertive"
          >
            <span>{passwordError}</span>
          </div>
        )}
        {capsLock && (
          <div
            className="flex items-center gap-1.5 text-[11px] text-arch-accent-amber animate-fade-up"
            role="alert"
            aria-live="polite"
          >
            <Lock className="w-3 h-3" strokeWidth={1.5} />
            <span>Caps Lock is on</span>
          </div>
        )}
        {rateLimitCountdown !== null && (
          <div
            className="flex items-center gap-1.5 text-[11px] text-arch-accent-amber animate-fade-up"
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
          className="w-full h-14 rounded-lg liquid-glass-button bg-gradient-to-b from-[#c59837] via-[#94611a] to-[#603808] hover:from-[#d4a843] hover:via-[#a36c1e] hover:to-[#6e410b] text-white text-base font-bold tracking-wide relative overflow-hidden flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 focus-visible:ring-offset-1 transition-all duration-300 drop-shadow-[0_10px_20px_rgba(90,51,7,0.4)] drop-shadow-[0_4px_6px_rgba(0,0,0,0.3)] hover:drop-shadow-[0_16px_32px_rgba(90,51,7,0.55)] hover:drop-shadow-[0_6px_10px_rgba(0,0,0,0.35)] border border-amber-400/30"
          hoverScale={1.02}
          tapScale={0.97}
        >
          {/* Specular top rim shine */}
          <span className="pointer-events-none absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-amber-200/75 to-transparent z-10" />

          {/* Sweeping light shine effect */}
          <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent group-hover:translate-x-full transition-transform duration-1000 ease-out z-10" />

          {loading ? (
            <span className="flex items-center gap-2 drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)] relative z-20">
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              <span>Accessing your workspace...</span>
            </span>
          ) : (
            <span className="drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)] relative z-20">
              Access Arch Systems
            </span>
          )}
        </AnimatedButton>
      </div>

      <div className="flex items-center justify-between pt-3">
        <Checkbox
          id="remember-me"
          checked={rememberMe}
          onChange={(e) => setRememberMe(e.target.checked)}
          label="Remember me"
          className="text-xs text-black/80 hover:text-black transition-colors liquid-text-lift"
        />
        <Link
          href={`/reset-password?email=${encodeURIComponent(employeeId)}`}
          className="text-xs text-black/80 hover:text-black transition-colors duration-200 liquid-text-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arch-accent-blue/50 rounded px-1 py-0.5 -mx-1"
        >
          Forgot password?
        </Link>
      </div>

      <div className="flex items-center justify-center gap-2 pt-2 border-t border-black/10 text-[11px] text-black/60 select-none">
        <span className="font-mono text-[10px] tracking-wider uppercase">AI Engine</span>
        <span className="opacity-40">•</span>
        <img
          src="/images/ai-sdk/ai-sdk-logotype-light.svg"
          alt="Powered by Vercel AI SDK"
          className="h-4 w-auto object-contain opacity-75 hover:opacity-100 transition-opacity"
        />
      </div>
    </form>
  );
}
