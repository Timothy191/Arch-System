"use client";

import { useState, useEffect, type ChangeEvent, type FormEvent, type KeyboardEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@repo/ui/Input";
import { AnimatedButton } from "@repo/ui/AnimatedButton";
import { Checkbox } from "@repo/ui/Checkbox";
import { Eye, EyeOff, Lock } from "lucide-react";
import { useLogin } from "@repo/auth/data-access";
import { isValidPageRedirect } from "@repo/auth/utils";
import { LOGIN_PORTAL_COPY } from "../config/login-portal-copy";

const LOGIN_CONTROL =
  "login-form-control login-production-control h-12 w-full min-h-12 box-border px-4";

const INPUT_CLASS = `${LOGIN_CONTROL} transition-all duration-200 focus:outline-none liquid-glass-input`;

export function LoginFormProduction() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawRedirect = searchParams.get("redirect") || "/";
  const redirectTo = isValidPageRedirect(rawRedirect) ? rawRedirect : "/";

  const [employeeEmail, setEmployeeEmail] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const { login, loading } = useLogin();

  useEffect(() => {
    const emailParam = searchParams.get("email");
    const employeeIdParam = searchParams.get("employeeId");
    if (emailParam) setEmployeeEmail(emailParam);
    if (employeeIdParam) setEmployeeId(employeeIdParam);
  }, [searchParams]);

  function handleCapsLockKey(e: KeyboardEvent<HTMLInputElement>) {
    setCapsLock(e.getModifierState("CapsLock"));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const result = await login(employeeEmail, employeeId, password);
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
            <label htmlFor="employee-email" className="login-form-label">
              Employee Email
            </label>
          </div>
          <div className="login-form-control-wrap login-production-control-wrap">
            <Input
              id="employee-email"
              type="email"
              required
              autoFocus
              minLength={5}
              maxLength={254}
              disabled={loading}
              value={employeeEmail}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setEmployeeEmail(e.target.value)}
              variant="login"
              className={INPUT_CLASS}
              placeholder={LOGIN_PORTAL_COPY.employeeEmailPlaceholder}
              aria-label="Employee Email"
              autoComplete="email"
            />
          </div>
        </div>

        <div className="login-form-field">
          <div className="login-form-label-group">
            <label htmlFor="employee-id" className="login-form-label">
              Employee ID
            </label>
          </div>
          <div className="login-form-control-wrap login-production-control-wrap">
            <Input
              id="employee-id"
              type="text"
              required
              minLength={3}
              maxLength={32}
              disabled={loading}
              value={employeeId}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setEmployeeId(e.target.value)}
              variant="login"
              className={INPUT_CLASS}
              placeholder={LOGIN_PORTAL_COPY.employeeIdPlaceholder}
              aria-label="Employee ID"
              autoComplete="username"
            />
          </div>
        </div>

        <div className="login-form-field">
          <div className="login-form-label-group">
            <label htmlFor="password" className="login-form-label">
              Password
            </label>
          </div>
          <div className="relative login-form-control-wrap login-production-control-wrap">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              required
              minLength={6}
              maxLength={128}
              disabled={loading}
              value={password}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
              onKeyDown={handleCapsLockKey}
              onKeyUp={handleCapsLockKey}
              variant="login"
              className={`${INPUT_CLASS} pr-10`}
              placeholder={LOGIN_PORTAL_COPY.passwordPlaceholder}
              aria-label="Password"
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword((s: boolean) => !s)}
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
            className={`${LOGIN_CONTROL} login-production-signin liquid-glass-button liquid-glass-button-signin glass-shine-target bg-[var(--color-signin-button)] hover:bg-[var(--color-signin-button-hover)] text-white font-semibold relative overflow-hidden flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-signin-button)]/60 focus-visible:ring-offset-1 transition-colors`}
            hoverScale={1}
            tapScale={0.97}
          >
            {loading ? "Signing in..." : "Sign In"}
          </AnimatedButton>

          <div className="login-form-footer-row flex items-center justify-between shrink-0">
            <Checkbox
              id="remember-me"
              checked={rememberMe}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setRememberMe(e.target.checked)}
              label="Remember me"
              className="login-form-meta"
            />
            <Link href="/reset-password" className="login-form-meta login-form-meta-link">
              Forgot password?
            </Link>
          </div>
        </div>
      </div>
    </form>
  );
}
