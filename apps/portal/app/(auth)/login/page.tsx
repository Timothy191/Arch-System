import { cookies } from "next/headers";
import { createServerSupabaseClient, getUserSafely } from "@repo/supabase/server";
import { LoginForm } from "@/features/auth/components/LoginForm";
import { RefractionGlow } from "@/features/auth/components/RefractionGlow";
import { AlertTriangle, Lock, AlertCircle, ChevronDown } from "lucide-react";
import { Logo } from "@repo/ui/Logo";

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
    <main className="relative w-full min-h-[calc(100vh-28px)] flex flex-col items-start justify-start py-8 pl-6 pr-8 md:pl-12 md:pr-16 lg:pl-20 lg:pr-32 overflow-y-auto">
      {/* Login Card wrapper */}
      <div className="relative z-10 w-[380px] max-w-full my-auto animate-fade-up -top-16 flex flex-col justify-center">
        {/* Liquid Refraction Glow (Behind Card) */}
        <RefractionGlow />
        {systemUnavailable ? (
          <div className="glass-card rounded-2xl overflow-hidden w-full">
            <div className="flex items-center gap-3 px-4 py-2.5 border-b border-arch-border-subtle bg-[var(--overlay-dim)]">
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="w-3 h-3 rounded-full bg-mac-red border border-arch-border-subtle" />
                <span className="w-3 h-3 rounded-full bg-mac-yellow border border-arch-border-subtle" />
                <span className="w-3 h-3 rounded-full bg-mac-green border border-arch-border-subtle" />
              </div>
              <span className="flex-1 text-center text-[13px] font-medium text-arch-text-secondary select-none pr-14">
                Arch — System Sign In
              </span>
            </div>
            <div className="p-6 space-y-4 text-center">
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
          </div>
        ) : (
          <div
            data-testid="login-card"
            className="w-full flex flex-col min-h-[660px] overflow-hidden login-card-container layer-signin-card liquid-glass-light border border-white/40 shadow-window rounded-xl"
          >
            {/* Title bar */}
            <div className="flex items-center gap-3 px-4 py-2.5 border-b border-arch-border-subtle bg-[var(--overlay-dim)]">
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="w-3 h-3 rounded-full bg-mac-red border border-arch-border-subtle" />
                <span className="w-3 h-3 rounded-full bg-mac-yellow border border-arch-border-subtle" />
                <span className="w-3 h-3 rounded-full bg-mac-green border border-arch-border-subtle" />
              </div>
              <span className="flex-1 text-center text-[13px] font-medium text-[var(--text-secondary)] select-none pr-14">
                Arch — System Sign In
              </span>
            </div>

            <div className="px-8 py-10 flex-1 flex flex-col justify-center space-y-8">
              {/* Header Bar */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[var(--accent-blue)] select-none">
                  Welcome Back
                </span>
                <div className="flex items-center gap-1.5 text-[10px] text-arch-accent-green">
                  <Lock className="w-3 h-3" strokeWidth={1.5} />
                  <span>Secure</span>
                </div>
              </div>

              {/* Title */}
              <div className="flex items-center gap-4">
                <Logo className="w-14 h-14 shrink-0 text-[var(--accent-blue)]" />
                <div className="space-y-1">
                  <h1 className="text-2xl font-medium tracking-tight text-[var(--text-heading)]">
                    Arch
                  </h1>
                  <p className="text-[var(--text-muted)] text-sm">Sign in to Arch Systems</p>
                </div>
              </div>

              <LoginForm />

              {/* Contextual System Notice */}
              <div className="px-3.5 py-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--overlay-dim)] text-[11px] text-[var(--text-secondary)] leading-relaxed flex items-start gap-2.5 select-none">
                <AlertCircle
                  className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0 mt-0.5"
                  strokeWidth={2}
                />
                <span>
                  <strong>Notice:</strong> Please ensure you are connected to the corporate VPN.
                </span>
              </div>
            </div>

            {/* Enterprise Footer */}
            <div className="px-4 py-3 flex items-center justify-between text-[10px] text-[var(--text-muted)] bg-[var(--overlay-dim)] border-t border-arch-border-subtle select-none">
              <button
                type="button"
                className="flex items-center gap-1 cursor-pointer hover:text-[var(--text-secondary)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arch-accent-blue/50 rounded px-1.5 py-0.5 -mx-1.5"
                aria-label="Select Language"
              >
                <span>English (US)</span>
                <ChevronDown className="w-2.5 h-2.5 opacity-60" strokeWidth={2.5} />
              </button>
              <div className="flex items-center gap-3">
                <span>v{PORTAL_VERSION}</span>
                <span className="uppercase tracking-wider font-medium">Arch OS</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
