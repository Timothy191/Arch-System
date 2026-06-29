import { cookies } from "next/headers";
import { createServerSupabaseClient, getUserSafely } from "@repo/supabase/server";
import { LoginForm } from "@/features/auth/components/LoginForm";
import { AlertTriangle, Lock } from "lucide-react";
import { Logo } from "@repo/ui/Logo";
import { AgenticAiLogo } from "@repo/ui/AgenticAiLogo";

const PORTAL_VERSION = process.env.PORTAL_VERSION ?? "2.0.0.1";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const cookieStore = await cookies();
  const hasAuthCookie = cookieStore
    .getAll()
    .some((c) => c.name.startsWith("sb-") && c.name.endsWith("-auth-token"));

  let systemUnavailable = false;

  if (hasAuthCookie) {
    const supabase = await createServerSupabaseClient();
    try {
      await getUserSafely(supabase);
    } catch (e) {
      // Only mark as unavailable for auth service failures, not transient errors
      if (
        e instanceof Error &&
        (e.message.includes("AuthRetryableFetchError") ||
          e.message.includes("fetch failed") ||
          e.message.includes("network"))
      ) {
        // Transient — don't show unavailable, just serve the form
        // eslint-disable-next-line no-console
        console.warn("Transient auth check failure, serving login form:", e.message);
      } else {
        systemUnavailable = true;
      }
    }
  }

  return (
    <main className="relative w-full min-h-[calc(100vh-28px)] flex flex-col items-start justify-center py-8 pl-6 pr-8 md:pl-12 md:pr-16 lg:pl-20 lg:pr-32 overflow-y-auto">
      <div className="login-card-float-wrapper relative z-10 w-[380px] max-w-full my-auto">
        <div
          data-testid="login-card"
          className="login-card-container layer-signin-card animate-fade-up flex flex-col gap-8 p-8"
        >
          {systemUnavailable ? (
          <div className="space-y-4 text-center">
            <AlertTriangle className="w-8 h-8 text-arch-accent-red mx-auto" strokeWidth={1.5} />
            <h1 className="text-lg font-medium text-arch-text-primary">System Unavailable</h1>
            <p className="text-sm text-arch-text-tertiary">
              Unable to reach authentication services. Please try again shortly or contact IT
              Support.
            </p>
            <a
              href="/login"
              className="inline-block mt-4 px-4 py-2 text-sm font-medium text-white bg-arch-accent-blue hover:opacity-90 rounded-lg transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arch-accent-blue/50"
            >
              Retry
            </a>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[var(--brand-gold)] select-none">
                Welcome Back
              </span>
              <div className="flex items-center gap-1.5 text-[10px] text-arch-accent-green">
                <Lock className="w-3 h-3" strokeWidth={1.5} />
                <span>Secure</span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <Logo className="w-14 h-14 shrink-0 text-[var(--brand-silver)]" />
              <div className="space-y-1 min-w-0">
                <h1 className="text-lg font-medium tracking-tight leading-snug text-[var(--text-heading)] liquid-text-lift">
                  Arch-Operational-System
                </h1>
                <p className="flex items-start gap-1.5 text-[10px] font-medium uppercase tracking-wide leading-snug text-[var(--brand-silver-muted)]">
                  <AgenticAiLogo className="w-3.5 h-3.5 mt-px text-[var(--brand-silver-muted)]" />
                  <span>Powered &amp; Integrated by Agentic AI System</span>
                </p>
                <p className="text-[var(--text-muted)] text-sm">Sign in to Arch Systems</p>
              </div>
            </div>

            <LoginForm />

            <div className="login-card-notice px-3.5 py-2.5 rounded-lg text-[11px] text-[var(--text-secondary)] leading-relaxed flex items-start gap-2.5 select-none">
              <svg
                className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0 mt-0.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
              <span>
                <strong>Notice:</strong> Please ensure you are connected to the corporate VPN.
              </span>
            </div>

            <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)] select-none">
              <button
                type="button"
                className="flex items-center gap-1 cursor-pointer hover:text-[var(--text-secondary)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arch-accent-blue/50 rounded px-1.5 py-0.5 -mx-1.5"
                aria-label="Select Language"
              >
                <span>English (US)</span>
                <svg
                  className="w-2.5 h-2.5 opacity-60"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
              <div className="flex items-center gap-3">
                <span>v{PORTAL_VERSION}</span>
                <span className="uppercase tracking-wider font-medium text-[var(--brand-gold)]">
                  Arch OS
                </span>
              </div>
            </div>
          </>
          )}
        </div>
      </div>
    </main>
  );
}
