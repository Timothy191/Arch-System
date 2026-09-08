import { createServerSupabaseClient, getUserSafely } from "@repo/supabase/server";
import { Clock } from "@repo/ui/Clock";
import { EveLogo } from "@repo/ui/EveLogo";
import { EveStatusBar } from "@repo/ui/EveStatusBar";
import { Logo } from "@repo/ui/Logo";
import { AlertCircle, AlertTriangle, ChevronDown, Lock } from "lucide-react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LoginClock } from "@/features/auth/components/LoginClock";
import { LoginForm } from "@/features/auth/components/LoginForm";
import { RefractionGlow } from "@/features/auth/components/RefractionGlow";

const PORTAL_VERSION = process.env.PORTAL_VERSION ?? "2.0.0.1";

export const dynamic = "force-dynamic";

interface LoginPageProps {
  searchParams?: Promise<{ redirect?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps = {}) {
  const cookieStore = await cookies();
  const hasAuthCookie = cookieStore
    .getAll()
    .some(
      (c) =>
        c.name === "sb-access-token" ||
        ((c.name.startsWith("sb-") || c.name.includes("sb-")) &&
          (c.name.includes("-auth-token") || c.name.includes("-access-token")))
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

  if (authenticated) {
    const params = await searchParams;
    const rawRedirect = params?.redirect;
    const target =
      rawRedirect &&
      rawRedirect.startsWith("/") &&
      !rawRedirect.startsWith("//") &&
      !rawRedirect.startsWith("/login")
        ? rawRedirect
        : "/hub";
    redirect(target);
  }

  return (
    <main className="relative w-full min-h-[calc(100vh-28px)] flex flex-col items-center justify-center py-8 px-4 overflow-y-auto bg-transparent">
      {/* Login Card wrapper */}
      <div className="relative z-10 w-[380px] max-w-full my-auto animate-fade-up flex flex-col justify-center">
        {/* Liquid Refraction Glow (Behind Card) */}
        <RefractionGlow />
        {systemUnavailable ? (
          <div className="w-full flex flex-col overflow-hidden liquid-glass-light border border-white/20 shadow-window rounded-2xl">
            <div className="flex items-center gap-3 px-4 py-2.5 border-b border-white/20 bg-white/10">
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="w-3 h-3 rounded-full bg-mac-red border border-arch-border-subtle" />
                <span className="w-3 h-3 rounded-full bg-mac-yellow border border-arch-border-subtle" />
                <span className="w-3 h-3 rounded-full bg-mac-green border border-arch-border-subtle" />
              </div>
              <span className="flex-1 text-center text-[13px] font-medium text-black select-none pr-14">
                Arch — System Sign In
              </span>
              <LoginClock />
            </div>
            <div className="p-6 space-y-4 text-center">
              <AlertTriangle className="w-8 h-8 text-arch-accent-red mx-auto" strokeWidth={1.5} />
              <h1 className="text-lg font-medium text-black">System Unavailable</h1>
              <p className="text-sm text-black">
                Unable to reach authentication services. Please try again shortly or contact IT
                Support.
              </p>
              <a
                href="/login"
                className="inline-block mt-4 px-4 py-2 text-sm font-medium text-black bg-arch-accent-blue hover:opacity-90 rounded-lg transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arch-accent-blue/50"
              >
                Retry
              </a>
            </div>
          </div>
        ) : (
          <div
            data-testid="login-card"
            className="w-full flex flex-col overflow-hidden login-card-container layer-signin-card liquid-glass-light border border-white/20 shadow-window rounded-2xl"
          >
            {/* Title bar */}
            <div className="flex items-center gap-3 px-4 py-2.5 border-b border-white/10 bg-white/5">
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="w-3 h-3 rounded-full bg-mac-red border border-arch-border-subtle" />
                <span className="w-3 h-3 rounded-full bg-mac-yellow border border-arch-border-subtle" />
                <span className="w-3 h-3 rounded-full bg-mac-green border border-arch-border-subtle" />
              </div>
              <span className="flex-1 text-center text-[13px] font-medium text-black select-none pr-14">
                Arch — System Sign In
              </span>
              <LoginClock />
            </div>

            <div className="px-7 py-7 flex-1 flex flex-col justify-center space-y-5">
              {/* Header Bar */}
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold tracking-wider uppercase text-black select-none">
                  Welcome Back
                </span>
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-black border border-emerald-500/20 text-[10px] font-medium select-none">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <Lock className="w-2.5 h-2.5" strokeWidth={2} />
                  <span>Secure</span>
                </div>
              </div>

              {/* Title */}
              <div className="flex items-center gap-3.5">
                <div className="p-2 rounded-xl bg-black/[0.04] border border-black/[0.06] shadow-sm shrink-0 flex items-center justify-center">
                  <Logo className="w-9 h-9 text-[var(--accent-blue)]" />
                </div>
                <div className="space-y-0.5 min-w-0">
                  <h1 className="text-xl font-semibold tracking-tight text-[var(--text-heading)]">
                    Arch Systems
                  </h1>
                  <p className="text-[var(--text-secondary)] text-xs">
                    Sign in to your workstation
                  </p>
                </div>
              </div>

              <LoginForm />

              {/* Contextual System Notice */}
              <div className="px-3.5 py-2 rounded-lg border border-white/15 bg-white/5 text-[11px] text-black leading-relaxed flex items-center gap-2.5 select-none">
                <AlertCircle className="w-3.5 h-3.5 text-black shrink-0" strokeWidth={2} />
                <span>
                  <strong>Notice:</strong> Please ensure you are connected to the corporate VPN.
                </span>
              </div>
            </div>

            {/* Enterprise Footer */}
            <div className="px-4 py-3 flex items-center justify-between text-[10px] text-black bg-white/5 border-t border-white/10 select-none">
              <button
                type="button"
                className="flex items-center gap-1 cursor-pointer hover:text-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arch-accent-blue/50 rounded px-1.5 py-0.5 -mx-1.5"
                aria-label="Select Language"
              >
                <span>English (US)</span>
                <ChevronDown className="w-2.5 h-2.5 opacity-60" strokeWidth={2.5} />
              </button>
              <div className="flex items-center gap-2.5">
                <Clock testId="footer-date" format="date" className="text-[10px]" />
                <span>v{PORTAL_VERSION}</span>
                <span className="uppercase tracking-wider font-medium">Arch OS</span>
                <span className="text-black/30">·</span>
                <EveLogo className="h-3 w-auto text-sky-800" />
              </div>
            </div>
          </div>
        )}

        {/* eve agentic system — slim status bar below the login card */}
        <EveStatusBar />
      </div>
    </main>
  );
}
