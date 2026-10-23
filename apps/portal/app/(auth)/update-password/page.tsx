'use client';

import { createBrowserSupabaseClient } from '@repo/supabase/client';
import { AnimatedButton } from '@repo/ui/AnimatedButton';
import { Input } from '@repo/ui/Input';
import { AlertTriangle, Check, Loader2, Lock } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

/**
 * Maps raw Supabase user profile update errors to precise, readable user instructions.
 * Resolves password validation issues such as weak password complexity or using the current password.
 *
 * @param raw - The raw error message string from the user update process.
 * @returns A safe, human-readable error description.
 */
function mapUpdateError(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes('weak')) {
    return 'Password is too weak. Use at least 8 characters with a mix of letters, numbers, and symbols.';
  }
  if (lower.includes('same')) {
    return 'New password must be different from your current password.';
  }
  return 'Unable to update password. Please try again.';
}

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [updated, setUpdated] = useState(false);
  const [error, setError] = useState('');
  const redirectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    supabase.auth.getSession().then(({ data }) => {
      setCheckingSession(false);
      setHasSession(!!data.session);
    });
  }, []);

  useEffect(() => {
    return () => {
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
      }
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);

    const supabase = createBrowserSupabaseClient();
    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    setLoading(false);

    if (updateError) {
      setError(mapUpdateError(updateError.message));
      return;
    }

    setUpdated(true);
    redirectTimeoutRef.current = setTimeout(() => {
      router.push('/login');
    }, 3000);
  }

  if (checkingSession) {
    return (
      <div className="w-full max-w-md space-y-3">
        <div className="glass-card space-y-4 overflow-hidden rounded-xl p-6 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-[var(--accent-blue)]" />
          <p className="text-[var(--text-muted)] text-sm">Verifying session...</p>
        </div>
      </div>
    );
  }

  if (!hasSession) {
    return (
      <div className="w-full max-w-md space-y-3">
        <div className="glass-card space-y-4 overflow-hidden rounded-xl p-6 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-[var(--accent-red)]" strokeWidth={1.5} />
          <h1 className="font-medium text-[var(--text-heading)] text-lg">Link Expired</h1>
          <p className="text-[var(--text-muted)] text-sm">
            This password reset link is invalid or has expired. Please request a new one.
          </p>
          <a
            href="/reset-password"
            className="inline-block w-full rounded-full bg-[var(--accent-blue)] px-4 py-2.5 text-center font-medium text-sm text-white transition-opacity hover:opacity-90"
          >
            Request New Link
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md space-y-3">
      <div className="glass-card glass-top-border animate-window-open overflow-hidden rounded-xl">
        <div className="flex items-center gap-3 border-[var(--border-subtle)] border-b bg-[var(--glass-surface-hover)] px-4 py-2.5">
          <div className="flex shrink-0 items-center gap-1.5">
            <span className="h-3 w-3 rounded-full border border-[var(--border-subtle)] bg-[var(--mac-close)]" />
            <span className="h-3 w-3 rounded-full border border-[var(--border-subtle)] bg-[var(--mac-minimize)]" />
            <span className="h-3 w-3 rounded-full border border-[var(--border-subtle)] bg-[var(--mac-zoom)]" />
          </div>
          <span className="flex-1 select-none pr-14 text-center font-medium text-[13px] text-[var(--text-secondary)]">
            Arch — New Password
          </span>
        </div>

        <div className="space-y-4 p-6">
          {updated ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--accent-green)]/10">
                <Check className="h-6 w-6 text-[var(--accent-green)]" strokeWidth={1.5} />
              </div>
              <div className="space-y-1">
                <h1 className="font-medium text-[var(--text-heading)] text-lg">Password Updated</h1>
                <p className="text-[var(--text-muted)] text-sm">
                  Your password has been updated. Redirecting to sign in...
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--accent-blue)]/10">
                <Lock className="h-6 w-6 text-[var(--accent-blue)]" strokeWidth={1.5} />
              </div>

              <div className="space-y-1 text-center">
                <h1 className="font-medium text-[var(--text-heading)] text-xl">Set New Password</h1>
                <p className="text-[var(--text-muted)] text-sm">
                  Choose a strong password you have not used before.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label
                    htmlFor="new-password"
                    className="block text-[var(--text-secondary)] text-sm"
                  >
                    New Password
                  </label>
                  <Input
                    id="new-password"
                    type="password"
                    required
                    minLength={8}
                    maxLength={128}
                    disabled={loading}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    variant="login"
                    className="liquid-glass-input focus:ring-0"
                    placeholder="Enter new password"
                    autoComplete="new-password"
                    aria-describedby={error ? 'update-error' : undefined}
                  />
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="confirm-password"
                    className="block text-[var(--text-secondary)] text-sm"
                  >
                    Confirm Password
                  </label>
                  <Input
                    id="confirm-password"
                    type="password"
                    required
                    minLength={8}
                    maxLength={128}
                    disabled={loading}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    variant="login"
                    className="liquid-glass-input focus:ring-0"
                    placeholder="Re-enter new password"
                    autoComplete="new-password"
                    aria-describedby={error ? 'update-error' : undefined}
                  />
                </div>

                {error && (
                  <p
                    id="update-error"
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
                  {loading ? 'Updating...' : 'Update Password'}
                </AnimatedButton>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
