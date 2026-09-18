import { createServerSupabaseClient, getUserSafely } from "@repo/supabase/server";
import { Clock } from "@repo/ui/Clock";
import { EveLogo } from "@repo/ui/EveLogo";
import { EveStatusBar } from "@repo/ui/EveStatusBar";
import { Logo } from "@repo/ui/Logo";
import { AlertCircle, AlertTriangle, ChevronDown, Lock } from "lucide-react";
import nextDynamic from "next/dynamic";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LoginClock } from "@/features/auth/components/LoginClock";
import { LoginForm, LoginFormSkeleton } from "@/features/auth/components/LoginForm";

const RefractionGlow = nextDynamic(
  () =>
    import("@/features/auth/components/RefractionGlow").then((m) => ({
      default: m.RefractionGlow,
    })),
  { loading: () => null }
);

const PORTAL_VERSION = process.env.PORTAL_VERSION ?? "2.0.0.1";

export const dynamic = "force-dynamic";

interface LoginPageProps {
  searchParams?: Promise<{ redirect?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps = {}) {
  const params = await searchParams;
  const rawRedirect = params?.redirect;
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
      if (
        e instanceof Error &&
        (e.message.includes("AuthRetryableFetchError") ||
          e.message.includes("fetch failed") ||
          e.message.includes("network"))
      ) {
        // Transient auth check failure, serving login form
      } else {
        systemUnavailable = true;
      }
    }
  }

  if (authenticated) {
    const target =
      rawRedirect?.startsWith("/") &&
      !rawRedirect.startsWith("//") &&
      !rawRedirect.startsWith("/login")
        ? rawRedirect
        : "/hub";
    redirect(target);
  }

  return (
    <main className="relative w-full min-h-[calc(100vh-28px)] flex flex-col items-center justify-center py-8 px-4 overflow-y-auto bg-transparent">
      {/* Login Card wrapper */}
      <div className="relative z-10 w-[392px] max-w-full my-auto animate-fade-up flex flex-col justify-center">
        {/* Liquid Refraction Glow */}
        <RefractionGlow />
        {systemUnavailable ? (
          <div className="w-full flex flex-col overflow-hidden bg-white/70 backdrop-blur-2xl backdrop-saturate-[150%] border border-white/40 border-t-white/90 shadow-[0_2px_10px_rgba(4,12,24,0.18),0_24px_60px_rgba(4,12,24,0.28),inset_0_1px_0_rgba(255,255,255,0.95)] rounded-2xl">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-black/[0.06] bg-white/20">
              <div className="flex items-center gap-2 shrink-0">
                <span className="w-3 h-3 rounded-full bg-[#ff5f56] border border-black/10 shadow-sm" />
                <span className="w-3 h-3 rounded-full bg-[#ffbd2e] border border-black/10 shadow-sm" />
                <span className="w-3 h-3 rounded-full bg-[#27c93f] border border-black/10 shadow-sm" />
              </div>
              <span className="flex-1 text-center text-[13px] font-semibold text-[var(--text-heading)] select-none pr-14 tracking-tight">
                Arch — System Sign In
              </span>
              <LoginClock />
            </div>
            <div className="p-6 space-y-4 text-center">
              <AlertTriangle
                className="w-8 h-8 text-[var(--palette-semantic-danger,#d22118)] mx-auto"
                strokeWidth={1.5}
              />
              <h1 className="text-lg font-semibold text-[var(--text-heading)]">
                System Unavailable
              </h1>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                Unable to reach authentication services. Please try again shortly or contact IT
                Support.
              </p>
              <a
                href="/login"
                className="inline-block mt-4 px-5 py-2.5 text-sm font-semibold text-white bg-[var(--palette-brand-primary,#1c1c1e)] hover:bg-[#2c2c2e] rounded-lg transition-all shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--palette-brand-primary,#1c1c1e)]"
              >
                Retry
              </a>
            </div>
          </div>
        ) : (
          <div
            data-testid="login-card"
            className="w-full flex flex-col overflow-hidden login-card-container layer-signin-card bg-gradient-to-b from-white/75 via-white/55 to-white/65 backdrop-blur-2xl backdrop-saturate-[150%] border border-white/40 border-t-white/90 shadow-[0_2px_10px_rgba(4,12,24,0.18),0_24px_60px_rgba(4,12,24,0.28),inset_0_1px_0_rgba(255,255,255,0.95),inset_0_-1px_0_rgba(0,0,0,0.06)] rounded-2xl transition-shadow focus-within:shadow-[0_2px_10px_rgba(4,12,24,0.18),0_24px_60px_rgba(4,12,24,0.28),0_0_0_2px_var(--login-focus-gold)]"
          >
            {/* macOS Title Bar */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-black/[0.06] bg-white/20">
              <div className="flex items-center gap-2 shrink-0">
                <span className="w-3 h-3 rounded-full bg-[#ff5f56] border border-black/10 shadow-sm" />
                <span className="w-3 h-3 rounded-full bg-[#ffbd2e] border border-black/10 shadow-sm" />
                <span className="w-3 h-3 rounded-full bg-[#27c93f] border border-black/10 shadow-sm" />
              </div>
              <span className="flex-1 text-center text-[13px] font-semibold text-[var(--text-heading)] select-none pr-14 tracking-tight">
                Arch — System Sign In
              </span>
              <LoginClock />
            </div>

            <div className="px-7 py-7 flex-1 flex flex-col justify-center space-y-5">
              {/* Header Bar */}
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold tracking-wider uppercase text-[var(--text-secondary)] select-none">
                  Welcome Back
                </span>
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-800 border border-emerald-500/20 text-[10px] font-medium select-none">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <Lock className="w-2.5 h-2.5" strokeWidth={2} />
                  <span>Secure</span>
                </div>
              </div>

              {/* Title */}
              <div className="flex items-center gap-3.5">
                <div className="p-2.5 rounded-xl bg-black/[0.04] border border-black/[0.06] shadow-sm shrink-0 flex items-center justify-center">
                  <Logo className="w-9 h-9 text-[var(--accent-blue)]" />
                </div>
                <div className="space-y-0.5 min-w-0">
                  <h1 className="text-xl font-bold tracking-tight text-[var(--text-heading)]">
                    Arch Systems
                  </h1>
                  <p className="text-[var(--text-secondary)] text-xs font-medium">
                    Sign in to your workstation
                  </p>
                </div>
              </div>

              <Suspense fallback={<LoginFormSkeleton />}>
                <LoginForm initialRedirect={rawRedirect} />
              </Suspense>

              {/* Contextual System Notice */}
              <div className="px-3.5 py-2.5 rounded-lg border border-black/[0.08] bg-black/[0.02] text-[11px] text-[var(--text-secondary)] leading-relaxed flex items-center gap-2.5 select-none">
                <AlertCircle
                  className="w-3.5 h-3.5 text-[var(--text-heading)] shrink-0"
                  strokeWidth={2}
                />
                <span>
                  <strong className="font-semibold text-[var(--text-heading)]">Notice:</strong>{" "}
                  Please ensure you are connected to the corporate VPN.
                </span>
              </div>
            </div>

            {/* Enterprise Footer */}
            <div className="px-4 py-3 flex items-center justify-between text-[11px] text-[var(--text-secondary)] bg-white/30 border-t border-black/[0.06] select-none">
              <button
                type="button"
                className="flex items-center gap-1 cursor-pointer font-medium hover:text-[var(--text-heading)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent-blue)] rounded px-1.5 py-0.5 -mx-1.5"
                aria-label="Select Language"
              >
                <span>English (US)</span>
                <ChevronDown className="w-3 h-3 opacity-70" strokeWidth={2.5} />
              </button>
              <div className="flex items-center gap-2 font-mono text-[10px]">
                <Clock
                  testId="footer-date"
                  format="date"
                  className="text-[10px] text-[var(--text-secondary)]"
                />
                <span>v{PORTAL_VERSION}</span>
                <span className="uppercase tracking-wider font-semibold text-[var(--text-heading)]">
                  Arch OS
                </span>
                <span className="opacity-40">·</span>
                <EveLogo className="h-3 w-auto text-sky-800" />
              </div>
            </div>
          </div>
        )}

        {/* eve agentic system status bar */}
        <EveStatusBar />
      </div>
    </main>
  );
}
