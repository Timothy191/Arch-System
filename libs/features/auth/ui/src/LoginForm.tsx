"use client";

import { useLogin } from "@repo/auth/data-access";
import { isValidPageRedirect } from "@repo/auth/utils";
import { ArrowRight, Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";
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

  const { login, loading, rateLimitCountdown } = useLogin();
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
    <form data-testid="login-form" onSubmit={handleSubmit} className="space-y-5">
      {/* Email Field */}
      <div className="space-y-1.5">
        <label
          htmlFor="email"
          className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 select-none cursor-pointer"
        >
          Email Address
        </label>
        <div className="relative flex items-center bg-white/70 backdrop-blur-md border border-neutral-200/90 rounded-lg overflow-hidden transition-all duration-200 focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-500/20 shadow-sm">
          <Mail className="w-4 h-4 absolute left-3.5 text-neutral-400 pointer-events-none" />
          <input
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
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (e.target.value.includes("@") && !emailRegex.test(e.target.value)) {
                  toast.error("Please enter a valid email address");
                }
              }
            }}
            placeholder="username@arch-systems.io"
            className="w-full pl-10 pr-4 py-3 bg-transparent border-none text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-0"
            autoComplete="username"
          />
        </div>
      </div>

      {/* Password Field */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center">
          <label
            htmlFor="password"
            className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 select-none cursor-pointer"
          >
            Password
          </label>
          <Link
            href={`/reset-password?email=${encodeURIComponent(employeeId)}`}
            className="text-xs font-medium text-amber-600 hover:text-amber-700 hover:underline transition-colors select-none"
          >
            Forgot password?
          </Link>
        </div>
        <div className="relative flex items-center bg-white/70 backdrop-blur-md border border-neutral-200/90 rounded-lg overflow-hidden transition-all duration-200 focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-500/20 shadow-sm">
          <Lock className="w-4 h-4 absolute left-3.5 text-neutral-400 pointer-events-none" />
          <input
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
            placeholder="••••••••"
            className="w-full pl-10 pr-11 py-3 bg-transparent border-none text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-0"
            autoComplete="current-password"
          />
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 transition-colors p-1 rounded focus:outline-none"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {passwordError && (
          <div
            className="flex items-center gap-1.5 text-xs text-red-600 animate-fade-up mt-1"
            role="alert"
            aria-live="assertive"
          >
            <span>{passwordError}</span>
          </div>
        )}
        {capsLock && (
          <div
            className="flex items-center gap-1.5 text-xs text-amber-600 animate-fade-up mt-1"
            role="alert"
            aria-live="polite"
          >
            <Lock className="w-3 h-3" strokeWidth={1.5} />
            <span>Caps Lock is on</span>
          </div>
        )}
        {rateLimitCountdown !== null && (
          <div
            className="flex items-center gap-1.5 text-xs text-amber-600 animate-fade-up mt-1"
            role="alert"
            aria-live="polite"
          >
            <span>Too many attempts. Try again in {rateLimitCountdown}s</span>
          </div>
        )}
      </div>

      {/* Remember Me */}
      <div className="flex items-center space-x-2 pt-0.5">
        <input
          id="remember"
          name="remember"
          type="checkbox"
          checked={rememberMe}
          onChange={(e) => setRememberMe(e.target.checked)}
          className="w-4 h-4 rounded border-neutral-300 text-amber-600 focus:ring-amber-500/20 accent-amber-600 cursor-pointer"
        />
        <label htmlFor="remember" className="text-xs text-neutral-600 select-none cursor-pointer">
          Remember this device
        </label>
      </div>

      {/* Sign In Button */}
      <button
        type="submit"
        disabled={loading || isRateLimited}
        className="w-full py-3.5 bg-gradient-to-b from-[#c59837] via-[#a36c1e] to-[#71440d] hover:from-[#d4a843] hover:via-[#b37824] hover:to-[#814e10] text-white text-xs font-semibold tracking-wider uppercase rounded-lg shadow-md shadow-amber-950/20 border border-amber-400/40 active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 group cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Signing In...</span>
          </span>
        ) : (
          <>
            <span>Sign In</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </>
        )}
      </button>
    </form>
  );
}
