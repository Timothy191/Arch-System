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
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { type ReactNode, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { RequestVisitorModal } from './RequestVisitorModal';

const MIN_EMAIL_LENGTH = 3;
const MAX_EMAIL_LENGTH = 254;
const MIN_PASSWORD_LENGTH = 11;
const MAX_PASSWORD_LENGTH = 128;
const LOCK_ICON_STROKE_WIDTH = 1.5;

const LOGIN_INPUT_WRAPPER_CLASS =
  'liquid-glass-light gold-steel-border gold-steel-border-slim relative flex items-center overflow-hidden rounded-xl border border-[var(--border-emphasis)] bg-[var(--bg-secondary)] shadow-diffusion-sm backdrop-blur-md transition-all duration-200 focus-within:-translate-y-px focus-within:border-[var(--accent-gold-border)] focus-within:bg-[var(--bg-tertiary)] focus-within:ring-2 focus-within:ring-[var(--accent-gold)]/15';

const LOGIN_INPUT_CLASS =
  'h-12 w-full rounded-xl bg-transparent pr-10 pl-10 text-base text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-0';

const SIGN_IN_BUTTON_CLASS =
  'group gold-steel-border gold-steel-border-slim flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[var(--color-action-primary)] py-3 font-semibold text-[13px] text-[var(--text-on-glass)] shadow-card transition-all duration-150 hover:-translate-y-px hover:bg-[var(--color-action-primary-hover)] active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-60';

const ENTERPRISE_ADDONS_BAR_CLASS =
  'liquid-glass-light gold-steel-border gold-steel-border-slim flex rounded-full border border-white/30 bg-[var(--material-ultra-thin)] p-1.5 shadow-diffusion-sm backdrop-blur-md';

const VISITOR_QR_TRIGGER_CLASS =
  'group inline-flex min-h-9 w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-black/[0.08] bg-white/80 px-4 py-1.5 font-medium text-[13px] text-zinc-800 transition-all hover:bg-amber-50 hover:text-amber-900';

export interface LoginFormProps {
  readonly renderQrCode?: (qrCode: string) => ReactNode;
}

export function LoginForm({ renderQrCode }: LoginFormProps = {}) {
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
  const [isVisitorModalOpen, setIsVisitorModalOpen] = useState(false);

  const { login, loading, rateLimitCountdown } = useLogin();
  const isRateLimited = rateLimitCountdown !== null && rateLimitCountdown > 0;

  useEffect(() => {
    const emailParam = searchParams.get('email') || searchParams.get('employeeId');
    if (emailParam) setEmployeeId(emailParam);
  }, [searchParams]);

  function handleCapsLockKey(keyboardEvent: React.KeyboardEvent) {
    setCapsLock(keyboardEvent.getModifierState('CapsLock'));
  }

  async function handleSubmit(formEvent: React.FormEvent) {
    formEvent.preventDefault();
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
    <>
      <form data-testid="login-form" onSubmit={handleSubmit} className="space-y-4">
        {/* Email / Employee ID Field */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="email"
              className="block cursor-pointer select-none font-medium text-[13px] text-zinc-800 leading-[18px]"
            >
              Email Address
            </label>
          </div>
          <div className={LOGIN_INPUT_WRAPPER_CLASS}>
            <Mail className="pointer-events-none absolute left-3.5 z-10 h-4 w-4 text-zinc-600 transition-colors" />
            <input
              id="email"
              name="email"
              type="email"
              required
              autoFocus
              minLength={MIN_EMAIL_LENGTH}
              maxLength={MAX_EMAIL_LENGTH}
              disabled={loading || isRateLimited}
              value={employeeId}
              onChange={(changeEvent) => setEmployeeId(changeEvent.target.value)}
              onFocus={(focusEvent) => focusEvent.target.select()}
              onBlur={(blurEvent) => {
                if (blurEvent.target.validity.typeMismatch) {
                  toast.error('Please enter a valid email address');
                } else if (
                  blurEvent.target.value &&
                  !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(blurEvent.target.value)
                ) {
                  toast.error('Please enter a valid email address');
                }
              }}
              placeholder="username@arch-systems.io"
              className={LOGIN_INPUT_CLASS}
              autoComplete="username"
            />
            {employeeId.length > 0 && !loading && (
              <button
                type="button"
                onClick={() => setEmployeeId('')}
                aria-label="Clear email address"
                className="absolute top-1/2 right-1.5 z-10 flex h-9 w-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Password Field */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="password"
              className="block cursor-pointer select-none font-medium text-[13px] text-zinc-800 leading-[18px]"
            >
              Password
            </label>
            <Link
              href={`/reset-password?email=${encodeURIComponent(employeeId)}`}
              className="inline-flex min-h-8 select-none items-center py-0.5 font-medium text-[13px] text-amber-800 leading-[18px] transition-colors hover:text-amber-950 hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <div className={LOGIN_INPUT_WRAPPER_CLASS}>
            <Lock className="pointer-events-none absolute left-3.5 z-10 h-4 w-4 text-zinc-600 transition-colors" />
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              required
              minLength={MIN_PASSWORD_LENGTH}
              maxLength={MAX_PASSWORD_LENGTH}
              disabled={loading || isRateLimited}
              value={password}
              onChange={(changeEvent) => {
                setPassword(changeEvent.target.value);
                setPasswordError('');
              }}
              onFocus={(focusEvent) => focusEvent.target.select()}
              onKeyDown={handleCapsLockKey}
              onKeyUp={handleCapsLockKey}
              placeholder="••••••••"
              className={LOGIN_INPUT_CLASS}
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              className="absolute top-1/2 right-1 z-10 flex h-9 w-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] focus:outline-none"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {password.length > 0 && (
            <div className="flex items-center gap-1.5 pt-0.5 font-mono text-[13px] text-[var(--text-secondary)] leading-[18px]">
              <CheckCircle2 className="h-3.5 w-3.5 text-[var(--accent-green)]" />
              <span>Credentials ready</span>
            </div>
          )}
          {passwordError && (
            <div
              className="mt-1 flex items-center gap-1.5 text-[13px] text-[var(--accent-red)] leading-[18px] motion-safe:animate-[fade-in_160ms_ease-out]"
              role="alert"
              aria-live="assertive"
            >
              <span>{passwordError}</span>
            </div>
          )}
          {capsLock && (
            <div
              className="mt-1 flex items-center gap-1.5 text-[13px] text-[var(--accent-amber)] leading-[18px]"
              role="alert"
              aria-live="polite"
            >
              <Lock className="h-3.5 w-3.5" strokeWidth={LOCK_ICON_STROKE_WIDTH} />
              <span>Caps Lock is on</span>
            </div>
          )}
          {rateLimitCountdown !== null && (
            <div
              className="mt-1 flex items-center gap-1.5 text-[13px] text-[var(--accent-amber)] leading-[18px]"
              role="alert"
              aria-live="polite"
            >
              <span>Too many attempts. Try again in {rateLimitCountdown}s</span>
            </div>
          )}
        </div>

        {/* Primary Tactile Sign In CTA */}
        <button type="submit" disabled={loading || isRateLimited} className={SIGN_IN_BUTTON_CLASS}>
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

        {/* Full-panel Visitor QR Code action */}
        <div data-testid="enterprise-auth-addons" className={ENTERPRISE_ADDONS_BAR_CLASS}>
          <button
            type="button"
            onClick={() => setIsVisitorModalOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={isVisitorModalOpen}
            className={VISITOR_QR_TRIGGER_CLASS}
          >
            <KeyRound className="h-3.5 w-3.5 shrink-0 text-amber-700" />
            <span>Visitor QR Code</span>
            <ArrowRight className="h-3.5 w-3.5 text-zinc-500 transition-transform group-hover:translate-x-0.5 group-hover:text-amber-700" />
          </button>
        </div>
      </form>

      <RequestVisitorModal
        isOpen={isVisitorModalOpen}
        onClose={() => setIsVisitorModalOpen(false)}
        renderQrCode={renderQrCode}
      />
    </>
  );
}
