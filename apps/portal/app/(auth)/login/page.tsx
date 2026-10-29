export const instant = false;

import { createServerSupabaseClient, getUserSafely } from '@repo/supabase/server';
import { Logo } from '@repo/ui/Logo';
import { AlertTriangle, Loader2, ShieldCheck } from 'lucide-react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { LoginForm } from '@/features/auth/components/LoginForm';
import { APP_VERSION } from '@/lib/version';

interface LoginPageProps {
  searchParams?: Promise<{ redirect?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps = {}) {
  const cookieStore = await cookies();
  const hasAuthCookie = cookieStore
    .getAll()
    .some(
      (c) =>
        c.name.startsWith('sb-') &&
        (c.name.includes('-auth-token') || c.name.includes('-access-token'))
    );

  let authenticated = false;
  let systemUnavailable = false;

  if (hasAuthCookie) {
    const supabase = await createServerSupabaseClient();
    try {
      const user = await getUserSafely(supabase);
      if (user?.id) {
        authenticated = true;
      }
    } catch (e) {
      if (
        e instanceof Error &&
        (e.message.includes('AuthRetryableFetchError') ||
          e.message.includes('fetch failed') ||
          e.message.includes('network'))
      ) {
        // eslint-disable-next-line no-console
        console.warn('Transient auth check failure, serving login form:', e.message);
      } else {
        systemUnavailable = true;
      }
    }
  }

  if (authenticated) {
    const params = await searchParams;
    const rawRedirect = params?.redirect;
    const target =
      rawRedirect?.startsWith('/') &&
      !rawRedirect.startsWith('//') &&
      !rawRedirect.startsWith('/login')
        ? rawRedirect
        : '/hub';
    redirect(target);
  }

  return (
    <main className="relative flex w-full flex-1 flex-col items-center justify-center overflow-hidden bg-transparent px-4">
      <div className="relative z-10 w-full max-w-md">
        {systemUnavailable ? (
          <div
            data-testid="login-card"
            className="gold-steel-border w-full animate-fade-up space-y-4 rounded-card border border-[var(--accent-blue)]/30 bg-arch-surface-secondary/80 p-8 text-center shadow-window backdrop-blur-xl md:p-10"
          >
            <AlertTriangle className="mx-auto h-10 w-10 text-accent-amber" strokeWidth={1.5} />
            <h1 className="font-semibold text-[var(--text-heading)] text-neutral-900 text-xl tracking-tight">
              System Unavailable
            </h1>
            <p className="text-neutral-600 text-sm">
              Unable to reach authentication services. Please try again shortly or contact IT
              Support.
            </p>
            <a
              href="/login"
              autoFocus
              className="gold-steel-border gold-steel-border-slim mt-4 inline-block rounded-xl border border-[var(--accent-blue)]/40 bg-[var(--accent-blue)] px-6 py-2.5 font-semibold text-white text-xs uppercase tracking-wider shadow-diffusion-sm transition-all hover:bg-[var(--accent-blue)]/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)]/50"
            >
              Retry
            </a>
          </div>
        ) : (
          <div
            data-testid="login-card"
            className="gold-steel-border w-full animate-fade-up rounded-card border border-[var(--accent-blue)]/30 bg-arch-surface-secondary/80 p-8 shadow-window backdrop-blur-xl md:p-10"
          >
            {/* Branding */}
            <div className="mb-6 flex flex-col items-center">
              <div className="gold-steel-border gold-steel-border-slim mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-arch-accent-blue/20 bg-arch-accent-blue/10 text-arch-accent-blue shadow-diffusion-sm">
                <Logo className="relative z-30 h-14 w-14 shrink-0 scale-110 text-[var(--accent-blue)] drop-shadow-sm" />
              </div>
              <div className="text-center">
                <h1 className="font-semibold text-[var(--text-heading)] text-neutral-900 text-xl tracking-tight">
                  Arch Systems
                </h1>
                <p className="mt-0.5 font-semibold text-[11px] text-neutral-500 uppercase tracking-widest">
                  Arch OS v{APP_VERSION}
                </p>
              </div>
            </div>

            {/* Header */}
            <div className="mb-6">
              <span className="select-none font-semibold text-[11px] text-[var(--accent-blue)] uppercase tracking-wider">
                Welcome Back
              </span>
              <h2 className="mt-0.5 font-semibold text-lg text-neutral-900 tracking-tight">
                Sign in to your account
              </h2>
              <p className="mt-1 text-neutral-500 text-xs">
                Access the mining & operations control panel.
              </p>
            </div>

            {/* Form */}
            <Suspense
              fallback={
                <div className="flex h-48 items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-[var(--accent-blue)]" />
                </div>
              }
            >
              <LoginForm />
            </Suspense>
          </div>
        )}

        {/* Footer */}
        <footer
          data-testid="login-footer"
          className="mt-8 select-none space-y-2 text-center text-[var(--accent-blue)]"
        >
          <div className="flex items-center justify-center gap-1.5 font-semibold text-[11px] text-[var(--accent-blue)] uppercase tracking-widest">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-[var(--accent-blue)]" />
            <span>Secure industrial access • Arch-Systems v{APP_VERSION}</span>
          </div>
          <div className="flex justify-center gap-6 font-medium text-[var(--accent-blue)] text-xs">
            <a
              className="inline-flex min-h-[32px] items-center px-2 py-1 text-[var(--accent-blue)] transition-colors hover:text-[var(--accent-blue)]/80 hover:underline"
              href="/docs"
            >
              Security Policy
            </a>
            <a
              className="inline-flex min-h-[32px] items-center px-2 py-1 text-[var(--accent-blue)] transition-colors hover:text-[var(--accent-blue)]/80 hover:underline"
              href="/docs#support"
            >
              Support
            </a>
          </div>
        </footer>
      </div>
    </main>
  );
}
