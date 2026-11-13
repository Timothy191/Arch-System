export const instant = false;

import { createServerSupabaseClient, getUserSafely } from '@repo/supabase/server';
import { EveLogo } from '@repo/ui/EveLogo';
import { Logo } from '@repo/ui/Logo';
import { AlertTriangle, Cpu, Loader2, ShieldCheck } from 'lucide-react';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { LoginForm } from '@/features/auth/components/LoginForm';
import { APP_VERSION } from '@/lib/version';
import { LoginVideoStage } from './LoginVideoStage';

const ALERT_ICON_STROKE_WIDTH = 1.5;

const SYSTEM_UNAVAILABLE_CARD_CLASS =
  'layer-signin-card gold-steel-border gold-steel-border-slim mx-auto w-full max-w-md space-y-4 rounded-2xl border border-amber-500/30 bg-white/90 p-8 text-center shadow-window backdrop-blur-xl md:p-10';

const RETRY_LINK_CLASS =
  'gold-steel-border gold-steel-border-slim mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-amber-500 px-6 py-2.5 font-semibold text-[13px] text-zinc-950 shadow-diffusion-sm transition-transform duration-150 hover:-translate-y-px hover:bg-amber-400 active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60';

const LOGIN_COMMAND_PORTAL_CLASS =
  'layer-signin-card liquid-glass-light gold-steel-border gold-steel-border-slim w-full overflow-hidden rounded-2xl border border-amber-500/25 bg-white/90 shadow-window backdrop-blur-xl lg:grid lg:grid-cols-12';

const LEFT_TELEMETRY_PANEL_CLASS =
  'relative isolate flex flex-col justify-between gap-5 overflow-hidden border-amber-500/30 border-b bg-zinc-50/80 p-6 md:p-7 lg:col-span-5 lg:border-r lg:border-b-0';

const RIGHT_AUTH_PANEL_CLASS =
  'liquid-glass-light flex flex-col justify-between bg-[var(--material-ultra-thin)] p-6 backdrop-blur-md md:p-7 lg:col-span-7';

const TASKBAR_GOLD_SEPARATOR_CLASS =
  'select-none font-bold font-mono text-[13px] text-accent-amber leading-none';

export const metadata: Metadata = {
  title: 'Login — Arch Systems',
  description: 'Sign in to access the Arch Systems industrial operations portal',
  robots: {
    index: false,
    follow: false,
  },
};

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
    <main className="relative flex w-full flex-1 flex-col items-center justify-center overflow-hidden bg-transparent px-4 py-4">
      <div className="relative z-10 w-full max-w-4xl">
        {systemUnavailable ? (
          <div data-testid="login-card" className={SYSTEM_UNAVAILABLE_CARD_CLASS}>
            <AlertTriangle
              className="mx-auto h-10 w-10 text-amber-700"
              strokeWidth={ALERT_ICON_STROKE_WIDTH}
            />
            <h1 className="font-display font-semibold text-[var(--text-heading)] text-xl text-zinc-900 tracking-tight">
              System Unavailable
            </h1>
            <p className="font-sans text-sm text-zinc-600">
              Unable to reach authentication services. Please try again shortly or contact IT
              Support.
            </p>
            <a href="/login" autoFocus className={RETRY_LINK_CLASS}>
              Retry
            </a>
          </div>
        ) : (
          <div data-testid="login-card" className={LOGIN_COMMAND_PORTAL_CLASS}>
            {/* Left Column: System Identity, Live Telemetry & EVE Agentic Attribution */}
            <aside
              className={LEFT_TELEMETRY_PANEL_CLASS}
              aria-label="System telemetry and identity"
            >
              {/* AI Mining Opencast Coal Mine Video Background with 32px Pause Control */}
              <LoginVideoStage />

              {/* Brand Identity */}
              <div className="relative z-10 space-y-3">
                <div className="flex items-center gap-3.5">
                  <div className="gold-steel-border gold-steel-border-slim flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-amber-500/30 bg-white/90 text-amber-700 shadow-diffusion-sm">
                    <Logo className="relative z-30 h-14 w-14 shrink-0 scale-110 text-amber-700 drop-shadow-sm" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h1 className="font-bold font-display text-2xl text-[var(--text-heading)] text-zinc-900 tracking-tight">
                      Arch Systems
                    </h1>
                    <div
                      data-testid="arch-systems-gold-separator"
                      aria-hidden="true"
                      className="my-2 flex w-56 items-center justify-center gap-2"
                    >
                      <span className="h-[2px] flex-1 rounded-full bg-gradient-to-r from-amber-500/20 via-amber-500 to-amber-600 shadow-diffusion-sm" />
                      <span className="h-2.5 w-2.5 rotate-45 rounded-[2px] border border-amber-600 bg-amber-400/60 shadow-diffusion-sm" />
                      <span className="h-[2px] flex-1 rounded-full bg-gradient-to-l from-amber-500/20 via-amber-500 to-amber-600 shadow-diffusion-sm" />
                    </div>
                    <div className="inline-flex items-center gap-1.5 rounded border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 font-medium text-[13px] text-amber-900 leading-[18px]">
                      <span>Brakfontein Pit &amp; Plant · SCADA</span>
                    </div>
                  </div>
                </div>
                <p className="font-sans text-[14px] text-zinc-700 leading-relaxed">
                  Live pit dispatch, SMR hour logging, wash-plant sheets, and shift closeout.
                </p>
              </div>

              {/* Integrated Eve Agentic Backend Dock */}
              <div
                data-testid="eve-agentic-backend-banner"
                className="relative z-10 rounded-xl border border-black/[0.08] bg-white/90 p-3.5"
              >
                <div className="inline-flex items-center gap-1.5 font-semibold text-[13px] text-amber-800 leading-[18px]">
                  <Cpu className="h-4 w-4 shrink-0" />
                  <span>Fully Intelligent &amp; Agentic Backend</span>
                </div>
                <p className="mt-1 font-sans text-[13px] text-zinc-600 leading-[18px]">
                  Autonomous multi-agent orchestration and self-healing telemetry
                </p>
                <div className="mt-2 flex items-center gap-2 border-zinc-200 border-t pt-2">
                  <span className="font-medium text-[13px] text-zinc-600 leading-[18px]">
                    Powered by
                  </span>
                  <EveLogo className="h-4 w-auto text-amber-700" />
                </div>
              </div>
            </aside>

            {/* Right Column: High-Speed Operator Authentication (Taskbar Effects & Branding) */}
            <section className={RIGHT_AUTH_PANEL_CLASS} aria-label="Operator authentication">
              <div>
                {/* Header with Taskbar Unified Pill & Branding */}
                <div className="mb-4 border-zinc-200/80 border-b pb-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div
                      data-testid="login-taskbar-brand-pill"
                      className="liquid-glass-light gold-steel-border gold-steel-border-slim inline-flex h-8 items-center gap-2 rounded-full border border-white/25 bg-[var(--material-ultra-thin)] px-3 shadow-diffusion-sm backdrop-blur-md"
                    >
                      <span
                        className="h-2 w-2 shrink-0 rounded-full bg-[var(--accent-green)]"
                        aria-hidden="true"
                      />
                      <span aria-hidden="true" className={TASKBAR_GOLD_SEPARATOR_CLASS}>
                        |
                      </span>
                      <span className="select-none font-semibold text-[13px] text-amber-800 leading-[18px]">
                        Welcome Back
                      </span>
                      <span aria-hidden="true" className={TASKBAR_GOLD_SEPARATOR_CLASS}>
                        |
                      </span>
                      <Logo variant="gold" className="h-3.5 w-3.5 shrink-0" />
                    </div>
                    <span className="rounded-md border border-arch-accent-blue/25 bg-arch-accent-blue/10 px-2.5 py-0.5 font-mono font-semibold text-[13px] text-arch-accent-blue tabular-nums leading-[18px]">
                      Arch OS · v{APP_VERSION}
                    </span>
                  </div>
                  <h2 className="mt-2.5 font-display font-semibold text-[var(--text-heading)] text-xl text-zinc-900 tracking-tight">
                    Sign in to your account
                  </h2>
                  <p className="mt-1 font-sans text-[14px] text-zinc-600 leading-5">
                    Access the mining &amp; operations control panel.
                  </p>
                </div>

                {/* Form */}
                <Suspense
                  fallback={
                    <div className="flex h-48 items-center justify-center">
                      <Loader2 className="h-6 w-6 animate-spin text-amber-700" />
                    </div>
                  }
                >
                  <LoginForm />
                </Suspense>
              </div>

              {/* Compact Taskbar-Styled Footer Pill inside Command Portal */}
              <footer
                data-testid="login-footer"
                className="liquid-glass-light gold-steel-border gold-steel-border-slim mt-5 flex flex-wrap items-center justify-between gap-2 rounded-full border border-white/25 bg-[var(--material-ultra-thin)] px-4 py-2 text-zinc-700 shadow-diffusion-sm backdrop-blur-md"
              >
                <div className="inline-flex items-center gap-1.5 font-medium text-[13px] text-zinc-700 leading-[18px]">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full bg-accent-green"
                    aria-hidden="true"
                  />
                  <ShieldCheck className="h-4 w-4 shrink-0 text-amber-700" />
                  <span>Secure industrial access</span>
                </div>
                <div className="flex items-center gap-2 font-medium text-[13px] leading-[18px]">
                  <a
                    className="inline-flex min-h-8 items-center px-1.5 text-zinc-700 transition-colors hover:text-amber-900 hover:underline"
                    href="/docs"
                  >
                    Security Policy
                  </a>
                  <span aria-hidden="true" className={TASKBAR_GOLD_SEPARATOR_CLASS}>
                    |
                  </span>
                  <a
                    className="inline-flex min-h-8 items-center px-1.5 text-zinc-700 transition-colors hover:text-amber-900 hover:underline"
                    href="/docs#support"
                  >
                    Support
                  </a>
                  <span aria-hidden="true" className={TASKBAR_GOLD_SEPARATOR_CLASS}>
                    |
                  </span>
                  <Logo variant="gold" className="h-3.5 w-3.5 shrink-0" />
                </div>
              </footer>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
