import { createServerSupabaseClient, getUserSafely } from '@repo/supabase/server';
import { Logo } from '@repo/ui/Logo';
import { AlertTriangle, ShieldCheck } from 'lucide-react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { LoginForm } from '@/features/auth/components/LoginForm';

const PORTAL_VERSION = process.env.PORTAL_VERSION ?? '2.4.1';

export const dynamic = 'force-dynamic';

interface LoginPageProps {
  searchParams?: Promise<{ redirect?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps = {}) {
  const cookieStore = await cookies();
  const hasAuthCookie = cookieStore
    .getAll()
    .some(
      (c) =>
        c.name === 'sb-access-token' ||
        ((c.name.startsWith('sb-') || c.name.includes('sb-')) &&
          (c.name.includes('-auth-token') || c.name.includes('-access-token')))
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
    <main className="relative w-full flex-1 flex flex-col items-center justify-center px-4 overflow-hidden bg-transparent bg-[radial-gradient(circle_at_2px_2px,rgba(0,0,0,0.03)_1px,transparent_0)] bg-[size:32px_32px]">
      {/* Ambient Gold Accents */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute w-[600px] h-[600px] rounded-full blur-[50px] -top-48 -left-48 -z-10 bg-[radial-gradient(circle,rgba(217,119,6,0.07)_0%,rgba(243,244,246,0)_70%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute w-[600px] h-[600px] rounded-full blur-[50px] -bottom-48 -right-48 -z-10 bg-[radial-gradient(circle,rgba(217,119,6,0.07)_0%,rgba(243,244,246,0)_70%)]"
      />

      <div className="w-full max-w-md z-10">
        {systemUnavailable ? (
          <div
            data-testid="login-card"
            className="w-full bg-white/80 backdrop-blur-xl border border-amber-500/20 rounded-2xl p-8 md:p-10 shadow-[0_8px_32px_rgba(0,0,0,0.04)] text-center space-y-4 animate-fade-up"
          >
            <AlertTriangle className="w-10 h-10 text-amber-600 mx-auto" strokeWidth={1.5} />
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
              className="inline-block mt-4 px-6 py-2.5 text-xs font-semibold uppercase tracking-wider text-white bg-gradient-to-b from-[#c59837] via-[#a36c1e] to-[#71440d] hover:from-[#d4a843] hover:via-[#b37824] hover:to-[#814e10] rounded-lg shadow-md shadow-amber-950/20 border border-amber-400/40 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50"
            >
              Retry
            </a>
          </div>
        ) : (
          <div
            data-testid="login-card"
            className="w-full bg-white/80 backdrop-blur-xl border border-amber-500/20 rounded-2xl p-8 md:p-10 shadow-[0_8px_32px_rgba(0,0,0,0.04)] animate-fade-up"
          >
            {/* Branding */}
            <div className="flex flex-col items-center mb-6">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#c59837] via-[#a36c1e] to-[#71440d] border border-amber-400/30 flex items-center justify-center mb-3 shadow-md shadow-amber-900/20">
                <Logo className="w-6 h-6 text-white" />
              </div>
              <div className="text-center">
                <h1 className="text-xl font-semibold tracking-tight text-neutral-900 text-[var(--text-heading)]">
                  Arch Systems
                </h1>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-neutral-500 mt-0.5">
                  Arch OS v{PORTAL_VERSION}
                </p>
              </div>
            </div>

            {/* Header */}
            <div className="mb-6">
              <span className="text-[11px] font-semibold tracking-wider uppercase text-amber-700 select-none">
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
            <LoginForm />
          </div>
        )}

        {/* Footer */}
        <footer className="mt-8 text-center space-y-2 select-none">
          <div className="flex items-center justify-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-neutral-500">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>Secure industrial access • Arch-Systems v{PORTAL_VERSION}</span>
          </div>
          <div className="flex justify-center gap-6 text-xs text-neutral-400">
            <a className="hover:text-neutral-700 transition-colors" href="/docs">
              Security Policy
            </a>
            <a className="hover:text-neutral-700 transition-colors" href="/docs#support">
              Support
            </a>
          </div>
        </footer>
      </div>
    </main>
  );
}
