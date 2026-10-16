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
    <main className="relative w-full flex-1 flex flex-col items-center justify-center px-4 overflow-hidden bg-transparent">
      <div className="relative w-full max-w-md z-10">
        {systemUnavailable ? (
          <div
            data-testid="login-card"
            className="w-full bg-arch-surface-secondary/80 backdrop-blur-xl border border-arch-border-subtle rounded-card p-8 md:p-10 shadow-window text-center space-y-4 animate-fade-up"
          >
            <AlertTriangle className="w-10 h-10 text-accent-amber mx-auto" strokeWidth={1.5} />
            <h1 className="text-xl font-semibold tracking-tight text-neutral-900 text-[var(--text-heading)]">
              System Unavailable
            </h1>
            <p className="text-sm text-neutral-600">
              Unable to reach authentication services. Please try again shortly or contact IT
              Support.
            </p>
            <a
              href="/login"
              autoFocus
              className="inline-block mt-4 px-6 py-2.5 text-xs font-semibold uppercase tracking-wider text-white bg-[var(--accent-blue)] hover:bg-[var(--accent-blue)]/90 rounded-button shadow-diffusion-sm border border-[var(--accent-blue)]/40 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)]/50"
            >
              Retry
            </a>
          </div>
        ) : (
          <div
            data-testid="login-card"
            className="w-full bg-arch-surface-secondary/80 backdrop-blur-xl border border-arch-border-subtle rounded-card p-8 md:p-10 shadow-window animate-fade-up"
          >
            {/* Branding */}
            <div className="flex flex-col items-center mb-6">
              <div className="w-12 h-12 rounded-xl bg-arch-accent-blue/10 border border-arch-accent-blue/20 flex items-center justify-center mb-3 shadow-diffusion-sm text-arch-accent-blue">
                <Logo className="w-6 h-6 text-[var(--accent-blue)]" />
              </div>
              <div className="text-center">
                <h1 className="text-xl font-semibold tracking-tight text-neutral-900 text-[var(--text-heading)]">
                  Arch Systems
                </h1>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-neutral-500 mt-0.5">
                  Arch OS v{APP_VERSION}
                </p>
              </div>
            </div>

            {/* Header */}
            <div className="mb-6">
              <span className="text-[11px] font-semibold tracking-wider uppercase text-[var(--accent-blue)] select-none">
                Welcome Back
              </span>
              <h2 className="text-lg font-semibold text-neutral-900 tracking-tight mt-0.5">
                Sign in to your account
              </h2>
              <p className="text-xs text-neutral-500 mt-1">
                Access the mining & operations control panel.
              </p>
            </div>

            {/* Form */}
            <Suspense
              fallback={
                <div className="h-48 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-[var(--accent-blue)]" />
                </div>
              }
            >
              <LoginForm />
            </Suspense>
          </div>
        )}

        {/* Footer */}
        <footer className="mt-8 text-center space-y-2 select-none">
          <div className="flex items-center justify-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-neutral-600 ">
            <ShieldCheck className="w-3.5 h-3.5 text-accent-green shrink-0" />
            <span>Secure industrial access • Arch-Systems v{APP_VERSION}</span>
          </div>
          <div className="flex justify-center gap-6 text-xs text-neutral-600 ">
            <a
              className="hover:text-neutral-900 :text-white transition-colors py-1 px-2 inline-flex items-center min-h-[32px]"
              href="/docs"
            >
              Security Policy
            </a>
            <a
              className="hover:text-neutral-900 :text-white transition-colors py-1 px-2 inline-flex items-center min-h-[32px]"
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
