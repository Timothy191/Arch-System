/**
 * /login — "Core Log"
 *
 * The portal's sign-in surface, built from the materials an operator actually
 * handles: a measured depth scale, lithology banding, iron-oxide staining. The
 * measured section rail is the only ornament; the ochre accent is spent once, on
 * the primary action.
 *
 * Behaviour is unchanged from the previous macOS-window version: the auth-cookie
 * check, the redirect guards and the unavailable-service branch are identical.
 * The form itself is the real `LoginForm` (not a replica), so the rate limiting,
 * caps-lock detection, show/hide toggle and `input#email` / `input#password`
 * contracts that e2e/login.spec.ts and LoginForm.test.tsx depend on all hold.
 *
 * Testids preserved for the existing suites: `login-card` (this panel),
 * `login-clock` (via LoginClock), `footer-date`, `eve-status-bar`.
 */

import { createServerSupabaseClient, getUserSafely } from "@repo/supabase/server";
import { Clock } from "@repo/ui/Clock";
import { EveStatusBar } from "@repo/ui/EveStatusBar";
import { Logo } from "@repo/ui/Logo";
import { SECTION_BANDS, SECTION_DEPTH_M, SECTION_TICK_M } from "@repo/theme/tokens/strata";
import { AlertTriangle } from "lucide-react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { IBM_Plex_Mono, IBM_Plex_Sans, IBM_Plex_Sans_Condensed } from "next/font/google";
import type { CSSProperties } from "react";
import { LoginClock } from "@/features/auth/components/LoginClock";
import { LoginForm } from "@/features/auth/components/LoginForm";

const PORTAL_VERSION = process.env.PORTAL_VERSION ?? "2.0.0.1";

const plex = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex",
  display: "swap",
});

const plexCondensed = IBM_Plex_Sans_Condensed({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-cond",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const dynamic = "force-dynamic";

interface LoginPageProps {
  searchParams?: Promise<{ redirect?: string }>;
}

/** Major ticks across the schematic section: 0 m … 100 m. */
const DEPTH_TICKS = Array.from(
  { length: SECTION_DEPTH_M / SECTION_TICK_M + 1 },
  (_, i) => i * SECTION_TICK_M,
);

export default async function LoginPage({ searchParams }: LoginPageProps = {}) {
  const cookieStore = await cookies();
  const hasAuthCookie = cookieStore
    .getAll()
    .some(
      (c) =>
        c.name === "sb-access-token" ||
        ((c.name.startsWith("sb-") || c.name.includes("sb-")) &&
          (c.name.includes("-auth-token") || c.name.includes("-access-token"))),
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
      rawRedirect?.startsWith("/") &&
      !rawRedirect.startsWith("//") &&
      !rawRedirect.startsWith("/login")
        ? rawRedirect
        : "/hub";
    redirect(target);
  }

  return (
    <div className={`slg ${plex.variable} ${plexCondensed.variable} ${plexMono.variable}`}>
      {/*
        Measured section. Decorative and aria-hidden: the depth values are a
        scale, not a claim about any real borehole. Only the panel is content.
      */}
      <aside className="slg-rail" aria-hidden="true">
        <div className="slg-scale">
          {DEPTH_TICKS.map((metres) => (
            <div
              key={metres}
              className={metres % (SECTION_TICK_M * 5) === 0 ? "slg-row slg-row-major" : "slg-row"}
            >
              <span className="slg-row-m">{metres}</span>
              <span className="slg-row-tick" />
            </div>
          ))}
        </div>

        <div className="slg-material">
          {SECTION_BANDS.map((band, i) => (
            <div
              key={`${band.key}-${i}`}
              className={`slg-band slg-band-${band.key}`}
              style={{ "--h": String(band.h) } as CSSProperties}
            />
          ))}
        </div>
      </aside>

      <div className="slg-stage">
        <div className="slg-stack">
          {systemUnavailable ? (
            <section className="slg-panel" data-testid="login-card" aria-labelledby="slg-title">
              <header className="slg-head">
                <Logo className="slg-head-mark" />
                <span className="slg-head-word">Arch Systems</span>
                <LoginClock />
              </header>

              <div className="slg-body">
                <h1 className="slg-title" id="slg-title">
                  System unavailable
                </h1>
                <p className="slg-sub">
                  Authentication services can&apos;t be reached right now. Try again shortly, or
                  contact IT support.
                </p>
                <p className="slg-note slg-note-error">
                  <AlertTriangle className="slg-note-icon" aria-hidden="true" />
                  <span>No action on your part will fix this — it is a server-side outage.</span>
                </p>
                <a className="slg-submit slg-submit-link" href="/login">
                  Try again
                </a>
              </div>
            </section>
          ) : (
            <section className="slg-panel" data-testid="login-card" aria-labelledby="slg-title">
              <header className="slg-head">
                <Logo className="slg-head-mark" />
                <span className="slg-head-word">Arch Systems</span>
                <LoginClock />
              </header>

              <div className="slg-body">
                <h1 className="slg-title" id="slg-title">
                  Sign in to your workstation
                </h1>
                <p className="slg-sub">Access is logged against your operator ID.</p>

                <LoginForm />

                <p className="slg-note">
                  <AlertTriangle className="slg-note-icon" aria-hidden="true" />
                  <span>Connect to the corporate VPN before signing in.</span>
                </p>
              </div>

              <footer className="slg-foot">
                <span>v{PORTAL_VERSION}</span>
                <Clock testId="footer-date" format="date" className="slg-foot-date" />
                <span className="slg-foot-os">Arch OS</span>
              </footer>
            </section>
          )}

          {/* eve agentic system — slim status bar below the panel */}
          <EveStatusBar />
        </div>
      </div>
    </div>
  );
}
