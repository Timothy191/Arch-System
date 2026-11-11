'use client';

import { useLogin } from '@repo/auth/data-access';
import { isValidPageRedirect } from '@repo/auth/utils';
import {
  ArrowRight,
  CheckCircle2,
  Copy,
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
import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

const MIN_EMAIL_LENGTH = 3;
const MAX_EMAIL_LENGTH = 254;
const MIN_PASSWORD_LENGTH = 11;
const MAX_PASSWORD_LENGTH = 128;
const LOCK_ICON_STROKE_WIDTH = 1.5;

const LOGIN_INPUT_WRAPPER_CLASS =
  'liquid-glass-light gold-steel-border gold-steel-border-slim relative flex items-center overflow-hidden rounded-xl border border-white/40 bg-[var(--material-ultra-thin)] shadow-diffusion-sm backdrop-blur-md transition-all duration-200 hover:bg-white/95 focus-within:border-amber-500/70 focus-within:bg-white/95 focus-within:ring-2 focus-within:ring-amber-500/15';

const LOGIN_INPUT_CLASS =
  'h-12 w-full rounded-xl bg-transparent pr-10 pl-10 text-base text-zinc-900 placeholder:text-zinc-500 focus:outline-none focus:ring-0';

const SIGN_IN_BUTTON_CLASS =
  'group gold-steel-border gold-steel-border-slim flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-amber-500 py-3 font-semibold text-[13px] text-zinc-950 shadow-card transition-all duration-150 hover:-translate-y-px hover:bg-amber-400 active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-60';

const ENTERPRISE_ADDONS_BAR_CLASS =
  'liquid-glass-light gold-steel-border gold-steel-border-slim flex flex-col gap-2 rounded-full border border-white/30 bg-[var(--material-ultra-thin)] px-3 py-1.5 shadow-diffusion-sm backdrop-blur-md sm:flex-row sm:items-center sm:justify-between';

const VISITOR_FIELD_INPUT_CLASS =
  'h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-500/20';

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
  const [isVisitorRequestOpen, setIsVisitorRequestOpen] = useState(false);
  const [managerName, setManagerName] = useState('');
  const [visitorName, setVisitorName] = useState('');
  const [visitorCompany, setVisitorCompany] = useState('');
  const [visitReason, setVisitReason] = useState('');
  const [copyStatus, setCopyStatus] = useState('');

  const visitorRequest = JSON.stringify({
    managerName,
    visitorName,
    company: visitorCompany,
    reason: visitReason,
  });
  const hasVisitorDetails = [managerName, visitorName, visitorCompany, visitReason].every((field) =>
    field.trim()
  );

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
          <span className="select-none font-mono text-[13px] text-zinc-600 leading-[18px]">
            Email or Employee Code
          </span>
        </div>
        <div className={LOGIN_INPUT_WRAPPER_CLASS}>
          <Mail className="pointer-events-none absolute left-3.5 z-10 h-4 w-4 text-zinc-600" />
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
            className={LOGIN_INPUT_CLASS}
            autoComplete="username"
          />
          {employeeId.length > 0 && !loading && (
            <button
              type="button"
              onClick={() => setEmployeeId('')}
              aria-label="Clear email address"
              className="absolute top-1/2 right-1.5 z-10 flex h-9 w-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded text-zinc-600 transition-colors hover:text-zinc-800"
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
          <Lock className="pointer-events-none absolute left-3.5 z-10 h-4 w-4 text-zinc-600" />
          <input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            required
            minLength={MIN_PASSWORD_LENGTH}
            maxLength={MAX_PASSWORD_LENGTH}
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
            className={LOGIN_INPUT_CLASS}
            autoComplete="current-password"
          />
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            className="absolute top-1/2 right-1 z-10 flex h-9 w-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded text-zinc-600 transition-colors hover:text-zinc-800 focus:outline-none"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <div className="flex items-center justify-between pt-0.5 font-mono text-[13px] text-zinc-600 leading-[18px]">
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle2
              className={
                password.length > 0 ? 'h-3.5 w-3.5 text-emerald-700' : 'h-3.5 w-3.5 text-zinc-500'
              }
            />
            <span>{password.length > 0 ? 'Credentials ready' : 'Encrypted session handoff'}</span>
          </span>
          <kbd className="rounded border border-zinc-300 bg-zinc-100 px-1.5 py-0.5 font-mono text-[13px] text-zinc-600 leading-[18px]">
            Enter ↵
          </kbd>
        </div>
        {passwordError && (
          <div
            className="mt-1 flex items-center gap-1.5 text-[13px] text-red-700 leading-[18px]"
            role="alert"
            aria-live="assertive"
          >
            <span>{passwordError}</span>
          </div>
        )}
        {capsLock && (
          <div
            className="mt-1 flex items-center gap-1.5 text-[13px] text-amber-800 leading-[18px]"
            role="alert"
            aria-live="polite"
          >
            <Lock className="h-3.5 w-3.5" strokeWidth={LOCK_ICON_STROKE_WIDTH} />
            <span>Caps Lock is on</span>
          </div>
        )}
        {rateLimitCountdown !== null && (
          <div
            className="mt-1 flex items-center gap-1.5 text-[13px] text-amber-800 leading-[18px]"
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

      {/* Secondary Action (Visitor QR Code) vs. Passive Telemetry Badge (Audit-Logged RBAC) */}
      <div data-testid="enterprise-auth-addons" className={ENTERPRISE_ADDONS_BAR_CLASS}>
        <button
          type="button"
          onClick={() => setIsVisitorRequestOpen((isOpen) => !isOpen)}
          aria-expanded={isVisitorRequestOpen}
          aria-controls="visitor-qr-request"
          className="group inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-full border border-black/[0.08] bg-white/80 px-3.5 py-1.5 font-medium text-[13px] text-zinc-800 transition-all hover:bg-amber-50 hover:text-amber-900"
        >
          <KeyRound className="h-3.5 w-3.5 shrink-0 text-amber-700" />
          <span>Visitor QR Code</span>
          <ArrowRight className="h-3.5 w-3.5 text-zinc-500 transition-transform group-hover:translate-x-0.5 group-hover:text-amber-700" />
        </button>
        <div
          aria-label="Security posture: Audit-Logged RBAC"
          className="inline-flex select-none items-center justify-center gap-1.5 px-2 py-1 font-mono font-semibold text-[13px] text-zinc-800 leading-[18px]"
        >
          <span
            aria-hidden="true"
            className="hidden select-none font-bold font-mono text-[13px] text-accent-amber leading-none sm:inline"
          >
            |
          </span>
          <Shield className="h-4 w-4 shrink-0 text-emerald-700" />
          <span>Audit-Logged RBAC</span>
        </div>
      </div>

      {isVisitorRequestOpen && (
        <section
          id="visitor-qr-request"
          aria-labelledby="visitor-qr-title"
          className="space-y-4 rounded-2xl border border-amber-500/25 bg-white/95 p-4 shadow-diffusion-sm"
        >
          <div>
            <h3 id="visitor-qr-title" className="font-semibold text-sm text-zinc-900">
              Create a visitor pass
            </h3>
            <p className="mt-1 text-xs text-zinc-600">
              Enter the visit details to generate a QR code for the visitor.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 font-medium text-xs text-zinc-700">
              Manager name
              <input
                value={managerName}
                onChange={(event) => setManagerName(event.target.value)}
                maxLength={120}
                autoComplete="name"
                className={VISITOR_FIELD_INPUT_CLASS}
                placeholder="Manager hosting the visit"
              />
            </label>
            <label className="space-y-1 font-medium text-xs text-zinc-700">
              Visitor name
              <input
                value={visitorName}
                onChange={(event) => setVisitorName(event.target.value)}
                maxLength={120}
                autoComplete="off"
                className={VISITOR_FIELD_INPUT_CLASS}
                placeholder="Visitor full name"
              />
            </label>
            <label className="space-y-1 font-medium text-xs text-zinc-700">
              Company
              <input
                value={visitorCompany}
                onChange={(event) => setVisitorCompany(event.target.value)}
                maxLength={160}
                autoComplete="organization"
                className={VISITOR_FIELD_INPUT_CLASS}
                placeholder="Visitor company"
              />
            </label>
            <label className="space-y-1 font-medium text-xs text-zinc-700">
              Reason for visit
              <input
                value={visitReason}
                onChange={(event) => setVisitReason(event.target.value)}
                maxLength={240}
                className={VISITOR_FIELD_INPUT_CLASS}
                placeholder="Meeting, delivery, site work…"
              />
            </label>
          </div>
          {hasVisitorDetails && (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <QRCodeSVG
                value={visitorRequest}
                id="visitor-qr-code"
                size={192}
                level="M"
                marginSize={2}
                title={`Visitor pass for ${visitorName}`}
                className="h-48 w-48 rounded bg-white p-2"
              />
              <button
                type="button"
                onClick={async () => {
                  try {
                    const qrCode = document.querySelector('#visitor-qr-code');
                    if (!(qrCode instanceof SVGElement)) {
                      throw new Error('QR code is unavailable');
                    }
                    await navigator.clipboard.writeText(qrCode.outerHTML);
                    setCopyStatus(
                      'QR code copied as SVG. Paste it into a supported document or editor.'
                    );
                  } catch {
                    setCopyStatus('Clipboard unavailable. You can scan the QR code directly.');
                  }
                }}
                className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 font-semibold text-sm text-zinc-950 hover:bg-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-offset-2"
              >
                <Copy className="h-4 w-4" aria-hidden="true" />
                Copy QR code
              </button>
              <p className="text-center text-xs text-zinc-600" role="status" aria-live="polite">
                {copyStatus || 'Scan the QR to read the visitor pass details.'}
              </p>
            </div>
          )}
        </section>
      )}
    </form>
  );
}
