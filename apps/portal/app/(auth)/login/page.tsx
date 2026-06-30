import { cookies } from "next/headers";
import { createServerSupabaseClient, getUserSafely } from "@repo/supabase/server";
import { LoginForm } from "@/features/auth/components/LoginForm";
import { AlertTriangle, Lock } from "lucide-react";
import { Logo } from "@repo/ui/Logo";
import { AgenticAiLogo } from "@repo/ui/AgenticAiLogo";

const PORTAL_VERSION = process.env.PORTAL_VERSION ?? "2.0.0.1";

/** CLI coding agents integrated with Arch OS agentic workflows */
const INTEGRATED_CLI_AGENTS = [
  "Claude Code",
  "Aider",
  "Antigravity",
  "Cursor",
  "Codex CLI",
  "Gemini CLI",
  "Cline",
  "OpenCode",
  "Continue",
  "Amazon Q Developer",
] as const;

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
          <span key={agent} className="login-card-footer-cli-agent">
            <span className="login-card-footer-cli-bullet" aria-hidden="true">
              •
            </span>
            {agent}
          </span>
        ))}
      </div>
      <span className="login-card-footer-ticker-sep" aria-hidden="true">
        ·
      </span>
      <div className="login-card-footer-meta">
        <span>v{version}</span>
        <span className="login-card-footer-os uppercase tracking-wider font-medium text-[var(--brand-gold)]">
          Arch OS
        </span>
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
      <div className="login-card-float-wrapper login-card-float-wrapper--top relative z-10 w-[420px] max-w-full shrink-0">
        <div
          data-testid="login-card"
          className="login-card-container layer-signin-card animate-fade-up flex flex-col px-8 pt-6 pb-9 min-h-[36rem] rounded-[var(--radius-xl)]"
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

            <div className="login-card-body">
              <header className="login-card-greeting login-card-greeting--lead">
                <h2 className="login-card-greeting-title">
                  <span className="login-card-greeting-line">Welcome back to Arch</span>
                  <span className="login-card-greeting-line login-card-greeting-sub">
                    How can I assist you?
                  </span>
                </h2>
              </header>

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

              <div className="login-card-form-region">
                <LoginForm />
              </div>

              <div className="login-card-bottom-stack">
                <div className="login-card-notice shrink-0 flex items-start gap-2.5 select-none">
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
                <div className="login-card-secure" aria-label="Secure connection">
                  <Lock className="w-3 h-3" strokeWidth={1.5} aria-hidden="true" />
                  <span>Secure</span>
                </div>
              </div>
            </div>

            <div className="login-card-footer login-card-footer-panel shrink-0 -mx-8 select-none">
              <div
                className="login-card-footer-ticker-viewport"
                aria-label={`English (US). CLI agents: ${INTEGRATED_CLI_AGENTS.join(", ")}. Version and Arch OS.`}
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
            </div>
          </>
          )}
        </div>
      </div>
    </main>
  );
}
