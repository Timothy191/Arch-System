"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@repo/ui/Input";
import { AnimatedButton } from "@repo/ui/AnimatedButton";
import { Checkbox } from "@repo/ui/Checkbox";
import { Eye, EyeOff, Lock } from "lucide-react";
import { toast } from "sonner";
import { useLogin } from "@repo/auth/data-access";
import { isValidPageRedirect } from "@repo/auth/utils";

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
  const [passwordError, setPasswordError] = useState("");

  const { login, loading, rateLimitCountdown, setRateLimitCountdown } = useLogin();

  useEffect(() => {
    const emailParam = searchParams.get("email") || searchParams.get("employeeId");
    if (emailParam) setEmployeeId(emailParam);
  }, [searchParams]);

  function handleCapsLockKey(e: React.KeyboardEvent) {
    setCapsLock(e.getModifierState("CapsLock"));
  }

  function getPasswordRequirements(password: string): string[] {
    const requirements: string[] = [];
    if (password.length < 6) requirements.push("at least 6 characters");
    if (password.length > 128) requirements.push("fewer than 128 characters");
    return requirements;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError("");

    // Validate password requirements before submission
    const requirements = getPasswordRequirements(password);
    if (requirements.length > 0) {
      setPasswordError(`Password must have ${requirements.join(", ")}`);
      return;
    }

    const result = await login(employeeId, password);
    if (result?.success) {
      router.push(redirectTo);
      router.refresh();
    } else {
      // Show specific password requirements if password doesn't meet them
      const failedRequirements = getPasswordRequirements(password);
      if (failedRequirements.length > 0) {
        setPasswordError(`Password must have ${failedRequirements.join(", ")}`);
      }
    }
    // Don't clear password on failed login - let user see what they typed
  }

  return (
    <form data-testid="login-form" onSubmit={handleSubmit} className="space-y-8">
      <div className="space-y-2">
        <label
          htmlFor="email"
          className="block text-xs font-medium text-[var(--text-secondary)] transition-colors duration-200 liquid-text-lift select-none cursor-pointer"
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
            disabled={loading}
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
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
        <p id="email-hint" className="text-[10px] text-arch-text-tertiary select-none">
          Your employee ID is on your badge.
        </p>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="password"
          className="block text-xs font-medium text-[var(--text-secondary)] transition-colors duration-200 liquid-text-lift select-none cursor-pointer"
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
            disabled={loading}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setPasswordError("");
            }}
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
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arch-accent-blue/50 rounded-sm"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {password && (
          <div className="text-[10px] text-arch-text-tertiary space-y-1 animate-fade-up">
            <p>Password requirements:</p>
            <ul className="space-y-0.5 ml-3">
              <li className={password.length >= 6 ? "text-arch-accent-green" : ""}>
                {password.length >= 6 ? "✓" : "○"} At least 6 characters
              </li>
              <li className={password.length <= 128 ? "text-arch-accent-green" : ""}>
                {password.length <= 128 ? "✓" : "○"} Fewer than 128 characters
              </li>
            </ul>
          </div>
        )}
        {passwordError && (
          <div
            className="flex items-center gap-1.5 text-[11px] text-arch-accent-red animate-fade-up"
            role="alert"
          >
            <span>{passwordError}</span>
          </div>
        )}
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
          {loading ? "Accessing your workspace..." : "Access Arch Systems"}
        </AnimatedButton>
      </div>

      <div className="flex items-center justify-between pt-3">
        <Checkbox
          id="remember-me"
          checked={rememberMe}
          onChange={(e) => setRememberMe(e.target.checked)}
          label="Remember me"
          className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors liquid-text-lift"
        />
        <Link
          href={`/reset-password?email=${encodeURIComponent(employeeId)}`}
          className="text-xs text-[var(--text-muted)] hover:text-[var(--accent-blue)] transition-colors duration-200 liquid-text-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arch-accent-blue/50 rounded px-1 py-0.5 -mx-1"
        >
          Forgot password?
        </Link>
      </div>
    </form>
  );
}
