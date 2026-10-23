'use client';

import { createBrowserSupabaseClient } from '@repo/supabase/client';
import { AnimatedButton } from '@repo/ui/AnimatedButton';
import { Input } from '@repo/ui/Input';
import { AlertTriangle, Check, Lock } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

/**
 * Maps raw Supabase reset password errors to clear, localized user-facing validation and status messages.
 * Handles rate limits, invalid emails, and generic request errors.
 *
 * @param raw - The raw error message string from the database/auth provider.
 * @returns A user-friendly error message.
 */
function mapResetError(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes('rate limit')) {
    return 'Too many requests. Please wait a moment.';
  }
  if (lower.includes('email')) {
    return 'Please enter a valid email address.';
  }
  return 'Unable to send reset email. Please try again or contact IT Support.';
}

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const emailParam = searchParams?.get('email');
    if (emailParam) setEmail(emailParam);
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const supabase = createBrowserSupabaseClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/update-password`,
    });

    setLoading(false);

    if (resetError) {
      setError(mapResetError(resetError.message));
      return;
    }

    setSent(true);
  }

  return (
    <div className="w-full max-w-md space-y-3">
      <div className="glass-card glass-top-border animate-window-open overflow-hidden rounded-xl">
        {/* Title bar */}
        <div className="flex items-center gap-3 border-[var(--border-subtle)] border-b bg-[var(--glass-surface-hover)] px-4 py-2.5">
          <div className="flex shrink-0 items-center gap-1.5">
            <span className="h-3 w-3 rounded-full border border-[var(--border-subtle)] bg-[var(--mac-close)]" />
            <span className="h-3 w-3 rounded-full border border-[var(--border-subtle)] bg-[var(--mac-minimize)]" />
            <span className="h-3 w-3 rounded-full border border-[var(--border-subtle)] bg-[var(--mac-zoom)]" />
          </div>
          <span className="flex-1 select-none pr-14 text-center font-medium text-[13px] text-[var(--text-secondary)]">
            Arch — Reset Password
          </span>
        </div>

        <div className="space-y-4 p-6">
          {sent ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--accent-green)]/10">
                <Check className="h-6 w-6 text-[var(--accent-green)]" strokeWidth={1.5} />
              </div>
              <div className="space-y-1">
                <h1 className="font-medium text-[var(--text-heading)] text-lg">Check Your Email</h1>
                <p className="text-[var(--text-muted)] text-sm">
                  If an account exists for{' '}
                  <span className="font-medium text-[var(--text-secondary)]">{email}</span>, you
                  will receive a password reset link.
                </p>
              </div>
              <Link
                href="/login"
                className="block w-full rounded-full bg-[var(--accent-blue)] px-4 py-2.5 text-center font-medium text-sm text-white transition-opacity hover:opacity-90"
              >
                Back to Sign In
              </Link>
            </div>
          ) : (
            <>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--accent-blue)]/10">
                <Lock className="h-6 w-6 text-[var(--accent-blue)]" strokeWidth={1.5} />
              </div>

              <div className="space-y-1 text-center">
                <h1 className="font-medium text-[var(--text-heading)] text-xl">Reset Password</h1>
                <p className="text-[var(--text-muted)] text-sm">
                  Enter your email and we will send you a reset link.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label
                    htmlFor="reset-email"
                    className="block cursor-pointer text-[var(--text-secondary)] text-sm"
                  >
                    <span id="reset-email-label">Email</span>
                  </label>
                  <Input
                    id="reset-email"
                    type="email"
                    required
                    autoFocus
                    maxLength={254}
                    disabled={loading}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    variant="login"
                    className="liquid-glass-input focus:ring-0"
                    placeholder="admin@arch.os"
                    autoComplete="username"
                    aria-labelledby="reset-email-label"
                    aria-describedby={error ? 'reset-error' : undefined}
                  />
                </div>

                {error && (
                  <p
                    id="reset-error"
                    className="flex items-center gap-2 rounded-md bg-red-50/80 px-3 py-2 text-red-700 text-sm"
                    role="alert"
                  >
                    <AlertTriangle className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                    {error}
                  </p>
                )}

                <AnimatedButton
                  type="submit"
                  disabled={loading}
                  className="liquid-glass-button w-full"
                  hoverScale={1}
                  tapScale={0.97}
                >
                  {loading ? 'Sending reset link...' : 'Send Password Reset Link'}
                </AnimatedButton>
              </form>

              <div className="pt-1 text-center">
                <Link
                  href="/login"
                  className="text-[var(--text-muted)] text-xs transition-colors duration-200 hover:text-[var(--accent-blue)]"
                >
                  Back to Sign In
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
