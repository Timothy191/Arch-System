'use client';

import { useLogin } from '@repo/auth/data-access';
import { isValidPageRedirect } from '@repo/auth/utils';
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  Shield,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

const LOGIN_INPUT_WRAPPER_CLASS =
  'gold-steel-border gold-steel-border-slim relative flex items-center overflow-hidden rounded-lg border border-[var(--accent-blue)]/40 bg-white/70 shadow-diffusion-sm backdrop-blur-md transition-all duration-200 focus-within:border-[var(--accent-blue)] focus-within:ring-2 focus-within:ring-[var(--accent-blue)]/20';

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawRedirect = searchParams.get('redirect') || '/';
  const redirectTo =
    isValidPageRedirect(rawRedirect) && !rawRedirect.startsWith('/login') ? rawRedirect : '/';

  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  const { login, loading, rateLimitCountdown } = useLogin();
  const isRateLimited = rateLimitCountdown !== null && rateLimitCountdown > 0;

  useEffect(() => {
    const emailParam = searchParams.get('email') || searchParams.get('employeeId');
    if (emailParam) setEmployeeId(emailParam);
  }, [searchParams]);

  function handleCapsLockKey(e: React.KeyboardEvent) {
    setCapsLock(e.getModifierState('CapsLock'));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError('');

    if (isRateLimited) return;

    const result = await login(employeeId, password);
    if (result?.success) {
      if (typeof window !== 'undefined' && window.location && process.env.NODE_ENV !== 'test') {
        const destination = redirectTo === '/' ? '/hub' : redirectTo;
        window.location.assign(destination);
      } else {
        router.push(redirectTo);
        router.refresh();
      }
    } else {
      setPasswordError(result?.error ?? 'Sign in failed. Please try again.');
    }
  }

  return (
    <form data-testid="login-form" onSubmit={handleSubmit} className="space-y-5">
      {/* Email Field */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label
            htmlFor="email"
            className="block cursor-pointer select-none font-semibold text-neutral-600 text-xs uppercase tracking-wider"
          >
            Email Address
          </label>
          <span className="select-none font-medium text-[10.5px] text-neutral-400">
            Email or Employee Code
          </span>
        </div>
        <div className={LOGIN_INPUT_WRAPPER_CLASS}>
          <Mail className="pointer-events-none absolute left-3.5 z-10 h-4 w-4 text-neutral-500" />
          <input
            id="email"
            name="email"
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
              if (e.target.validity.typeMismatch) {
                toast.error('Please enter a valid email address');
              } else if (e.target.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.target.value)) {
                toast.error('Please enter a valid email address');
              }
            }}
            placeholder="username@arch-systems.io"
            className="gold-steel-border gold-steel-border-slim w-full rounded-lg bg-transparent py-3 pr-9 pl-10 text-neutral-900 text-sm placeholder:text-neutral-500 focus:outline-none focus:ring-0"
            autoComplete="username"
          />
          {employeeId.length > 0 && !loading && (
            <button
              type="button"
              onClick={() => setEmployeeId('')}
              aria-label="Clear email address"
              className="absolute top-1/2 right-1.5 z-10 flex h-7 w-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded text-neutral-400 transition-colors hover:text-neutral-700"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Password Field */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label
            htmlFor="password"
            className="block cursor-pointer select-none font-semibold text-neutral-600 text-xs uppercase tracking-wider"
          >
            Password
          </label>
          <Link
            href={`/reset-password?email=${encodeURIComponent(employeeId)}`}
            className="inline-flex min-h-[32px] select-none items-center py-1 font-medium text-[var(--accent-blue)] text-xs transition-colors hover:text-[var(--accent-blue)]/80 hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        <div className={LOGIN_INPUT_WRAPPER_CLASS}>
          <Lock className="pointer-events-none absolute left-3.5 z-10 h-4 w-4 text-neutral-500" />
          <input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            required
            minLength={11}
            maxLength={128}
            disabled={loading || isRateLimited}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setPasswordError('');
            }}
            onFocus={(e) => e.target.select()}
            onKeyDown={handleCapsLockKey}
            onKeyUp={handleCapsLockKey}
            placeholder="••••••••"
            className="gold-steel-border gold-steel-border-slim w-full rounded-lg bg-transparent py-3 pr-11 pl-10 text-neutral-900 text-sm placeholder:text-neutral-500 focus:outline-none focus:ring-0"
            autoComplete="current-password"
          />
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            className="absolute top-1/2 right-1 z-10 flex h-9 w-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded text-neutral-500 transition-colors hover:text-neutral-800 focus:outline-none"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <div className="flex items-center justify-between pt-0.5 text-[10.5px] text-neutral-500">
          <span className="inline-flex items-center gap-1">
            <CheckCircle2
              className={
                password.length > 0 ? 'h-3 w-3 text-emerald-600' : 'h-3 w-3 text-neutral-400'
              }
            />
            <span>{password.length > 0 ? 'Credentials ready' : 'Encrypted session handoff'}</span>
          </span>
          <span className="rounded border border-neutral-300/80 bg-white/60 px-1.5 py-0.2 font-mono text-[10px] text-neutral-600">
            Enter ↵
          </span>
        </div>
        {passwordError && (
          <div
            className="mt-1 flex animate-fade-up items-center gap-1.5 text-red-600 text-xs"
            role="alert"
            aria-live="assertive"
          >
            <span>{passwordError}</span>
          </div>
        )}
        {capsLock && (
          <div
            className="mt-1 flex animate-fade-up items-center gap-1.5 text-accent-amber text-xs"
            role="alert"
            aria-live="polite"
          >
            <Lock className="h-3 w-3" strokeWidth={1.5} />
            <span>Caps Lock is on</span>
          </div>
        )}
        {rateLimitCountdown !== null && (
          <div
            className="mt-1 flex animate-fade-up items-center gap-1.5 text-accent-amber text-xs"
            role="alert"
            aria-live="polite"
          >
            <span>Too many attempts. Try again in {rateLimitCountdown}s</span>
          </div>
        )}
      </div>

      {/* Sign In Button */}
      <button
        type="submit"
        disabled={loading || isRateLimited}
        className="group gold-steel-border gold-steel-border-slim flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[var(--accent-blue)] py-3.5 font-semibold text-white text-xs uppercase tracking-wider shadow-card transition-all duration-200 hover:bg-[var(--accent-blue)]/90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Signing In...</span>
          </span>
        ) : (
          <>
            <span>Sign In</span>
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </>
        )}
      </button>

      {/* Enterprise Hardware & Session Security Add-on Strip */}
      <div
        data-testid="enterprise-auth-addons"
        className="grid grid-cols-2 gap-2 border-[var(--accent-blue)]/15 border-t pt-3.5"
      >
        <div className="flex items-center gap-1.5 rounded-lg border border-[var(--accent-blue)]/20 bg-white/60 px-2.5 py-1.5 text-[10.5px] text-neutral-600">
          <KeyRound className="h-3.5 w-3.5 shrink-0 text-[var(--accent-blue)]" />
          <span className="truncate font-medium">C66 RFID / SSO Ready</span>
        </div>
        <div className="flex items-center gap-1.5 rounded-lg border border-[var(--accent-blue)]/20 bg-white/60 px-2.5 py-1.5 text-[10.5px] text-neutral-600">
          <Shield className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
          <span className="truncate font-medium">Audit-Logged RBAC</span>
        </div>
      </div>
    </form>
  );
}
