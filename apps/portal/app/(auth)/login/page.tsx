import { cookies } from "next/headers";
import { createServerSupabaseClient, getUserSafely } from "@repo/supabase/server";
import { LoginForm } from "@/features/auth/components/LoginForm";
import { AlertTriangle } from "lucide-react";
import { Logo } from "@repo/ui/Logo";
import { AgenticAiLogo } from "@repo/ui/AgenticAiLogo";
import { GlassShineController } from "@10-src/01_Admin/components";
import { CliAgentMark } from "@/components/auth/CliAgentMark";
import { LoginServiceStatusBanner } from "@/components/auth/LoginServiceStatusBanner";
import {
  INTEGRATED_CLI_AGENTS,
  type IntegratedCliAgent,
} from "@/lib/auth/integrated-cli-agents";

const PORTAL_VERSION = process.env.PORTAL_VERSION ?? "2.0.0.1";

function CliAgentTickerItem({ agent }: { agent: IntegratedCliAgent }) {
  return (
    <span className="login-card-footer-cli-agent">
      <span className="login-card-footer-cli-bullet" aria-hidden="true">
        •
      </span>
      <CliAgentMark agent={agent} />
      <span>{agent.name}</span>
    </span>
  );
}

function LoginCardFooterTickerRow({ version }: { version: string }) {
  return (
    <>
      <button
        type="button"
        className="login-card-footer-lang inline-flex shrink-0 items-center gap-1 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arch-accent-blue/50 rounded px-1 py-0.5"
        aria-label="Select Language"
      >
        <span>English (US)</span>
        <svg
          className="login-card-footer-chevron"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      <span className="login-card-footer-ticker-sep" aria-hidden="true">
        ·
      </span>
      <div className="login-card-footer-cli-agents" title="Integrated CLI coding agents">
        <AgenticAiLogo className="login-card-footer-agentic-icon shrink-0" aria-hidden="true" />
        <span className="login-card-footer-cli-agents-label">CLI Agents</span>
        {INTEGRATED_CLI_AGENTS.map((agent) => (
          <CliAgentTickerItem key={agent.name} agent={agent} />
        ))}
      </div>
      <span className="login-card-footer-ticker-sep" aria-hidden="true">
        ·
      </span>
      <div className="login-card-footer-meta">
        <span>v{version}</span>
        <span className="login-card-footer-os">Arch OS</span>
      </div>
    </>
  );
}

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
    <main className="relative w-full flex-1 min-h-0 flex flex-col items-start justify-start py-6 pl-6 pr-8 md:pl-12 md:pr-16 lg:pl-20 lg:pr-32 overflow-y-auto box-border">
      <GlassShineController />
      <div className="login-card-float-wrapper login-card-float-wrapper--top portal-layer-login relative z-[calc(var(--z-primary-card)+1)] w-[380px] max-w-full shrink-0">
        <div className="login-card-float-shadow" aria-hidden="true" />
        <div
          data-testid="login-card"
          className="login-card-container layer-signin-card animate-fade-up flex flex-col px-8 pt-6 pb-0 min-h-[36rem] rounded-[var(--radius-xl)]"
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
            <div className="login-card-border-shine" aria-hidden="true" />
            <div className="login-card-thread-border" aria-hidden="true" />
            <div className="login-card-surface-sheen" aria-hidden="true" />
            <div className="login-card-glass-shine glass-shine-target" aria-hidden="true" />

            <div className="login-card-body">
              <section className="login-card-intro">
                <div className="login-card-brand">
                  <h1 className="login-brand-wordmark" aria-label="Arch-Operational System">
                    <span className="login-brand-wordmark-visual" aria-hidden="true">
                      <span className="login-brand-logo-a">
                        <Logo className="login-brand-logo-mark" splitTone />
                      </span>
                      <span className="login-brand-wordmark-tail">Arch-Operational System</span>
                    </span>
                  </h1>
                </div>
              </section>

              <section className="login-card-panel login-card-panel--main mt-auto -mx-8 shrink-0 select-none">
                <div className="login-card-form-region login-card-main-form">
                  <LoginForm />
                </div>

                <div className="login-card-form-notice-divider" aria-hidden="true" />

                <div className="login-card-footer-notice-block">
                  <div className="login-card-notice shrink-0 select-none">
                    <svg
                      className="login-card-notice-icon shrink-0"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="16" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                    <p className="login-card-notice-text">
                      <strong>Notice:</strong> Please ensure you are connected to the corporate VPN.
                    </p>
                  </div>
                  <LoginServiceStatusBanner />
                </div>

                <div
                  className="login-card-footer-ticker-viewport login-card-footer-ticker-band"
                  aria-label={`English (US). CLI agents: ${INTEGRATED_CLI_AGENTS.map((a) => a.name).join(", ")}. Version and Arch OS.`}
                >
                  <div className="login-card-footer-ticker-track">
                    <div className="login-card-footer-ticker-row">
                      <LoginCardFooterTickerRow version={PORTAL_VERSION} />
                    </div>
                    <div className="login-card-footer-ticker-row" aria-hidden="true">
                      <LoginCardFooterTickerRow version={PORTAL_VERSION} />
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </>
          )}
        </div>
      </div>
    </main>
  );
}
