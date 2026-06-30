"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@repo/ui/Input";
import { AnimatedButton } from "@repo/ui/AnimatedButton";
import { Checkbox } from "@repo/ui/Checkbox";
import { Eye, EyeOff, Lock } from "lucide-react";
import { useLogin } from "@repo/auth/data-access";
import { isValidPageRedirect } from "@repo/auth/utils";

/** Shared dimensions for Employee ID, Password, and Sign In — equal width/height */
const LOGIN_CONTROL =
  "login-form-control h-12 w-full min-h-12 box-border rounded-md px-4";

const INPUT_CLASS = `${LOGIN_CONTROL} transition-all duration-200 focus:outline-none liquid-glass-input`;

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawRedirect = searchParams.get("redirect") || "/";
  const redirectTo = isValidPageRedirect(rawRedirect) ? rawRedirect : "/";

  const [employeeId, setEmployeeId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const { login, loading } = useLogin();

  useEffect(() => {
    const emailParam = searchParams.get("email") || searchParams.get("employeeId");
    if (emailParam) setEmployeeId(emailParam);
  }, [searchParams]);

  function handleCapsLockKey(e: React.KeyboardEvent) {
    setCapsLock(e.getModifierState("CapsLock"));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = await login(employeeId, password);
    if (result?.success) {
      router.push(redirectTo);
      router.refresh();
    } else {
      setPassword("");
    }
  }

  return (
    <form data-testid="login-form" onSubmit={handleSubmit} className="flex flex-col">
      <div className="login-form-stack">
        <div className="login-form-field">
          <div className="login-form-label-group">
            <label htmlFor="email" className="login-form-label">
              Employee ID / Email
            </label>
            <p id="email-hint" className="login-form-hint">
              Your employee ID is on your badge.
            </p>
          </div>
          <div className="login-form-control-wrap login-form-control-border-shine">
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
              className={INPUT_CLASS}
              placeholder="Employee ID or email"
              aria-label="Employee ID / Email"
              autoComplete="username"
              aria-describedby="email-hint"
            />
          </div>
        </div>

        <div className="login-form-field">
          <div className="login-form-label-group">
            <label htmlFor="password" className="login-form-label">
              Password
            </label>
          </div>
          <div className="relative login-form-control-wrap login-form-control-border-shine">
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
              className={`${INPUT_CLASS} pr-10`}
              placeholder="Enter your password"
              aria-label="Password"
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute right-3 top-1/2 z-[3] -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arch-accent-blue/50 rounded-sm"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
            {capsLock && (
              <div
                className="absolute left-0 top-full mt-1 flex items-center gap-1.5 text-[11px] text-arch-accent-amber animate-fade-up"
                role="alert"
              >
                <Lock className="w-3 h-3" strokeWidth={1.5} />
                <span>Caps Lock is on</span>
              </div>
            )}
          </div>
        </div>

        <div className="login-form-actions">
          <AnimatedButton
            type="submit"
            disabled={loading}
            className={`${LOGIN_CONTROL} liquid-glass-button liquid-glass-button-signin bg-[var(--color-signin-button)] hover:bg-[var(--color-signin-button-hover)] text-white font-semibold relative overflow-hidden flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-signin-button)]/60 focus-visible:ring-offset-1 transition-colors`}
            hoverScale={1}
            tapScale={0.97}
          >
            {loading ? "Signing in..." : "Sign In"}
          </AnimatedButton>

          <div className="login-form-footer-row flex items-center justify-between shrink-0">
            <Checkbox
              id="remember-me"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              label="Remember me"
              className="login-form-meta"
            />
            <Link
              href="/reset-password"
              className="login-form-meta login-form-meta-link"
            >
              Forgot password?
            </Link>
          </div>
        </div>
      </div>
    </form>
  );
}
