import "@repo/ui/globals.css";
import { ArchThemeProvider } from "@repo/theme/react";
import type { Metadata, Viewport } from "next";
import { Montserrat, JetBrains_Mono } from "next/font/google";
import dynamic from "next/dynamic";
import ClientProviders from "./ClientProviders";
import { OfflineBanner } from "@/components/OfflineBanner";
import { FocusModeProvider } from "@/components/FocusModeProvider";
import { PerformanceListener } from "@/components/PerformanceListener";
import { RouteAnnouncer } from "@/components/RouteAnnouncer";
import { PWAInstallButton } from "@/components/PWAInstallButton";
import { SystemTrayPill } from "@/components/system/SystemTray";
import { WebVitalsReporter } from "@/components/WebVitalsReporter";
import { Taskbar } from "@repo/ui/Taskbar";
import { TaskbarSearch } from "@/components/nav/TaskbarSearch";
import { Toaster } from "@repo/ui/Toaster";
import { CookieConsent } from "@repo/ui/CookieConsent";
import { FeedbackWidget } from "@/components/FeedbackWidget";

const HeaderWidgets = dynamic(
  () =>
    import("@/components/HeaderWidgets").then((m) => ({
      default: m.HeaderWidgets,
    })),
  {
    loading: () => (
      <div className="flex items-center gap-3" aria-hidden="true">
        <div className="w-7 h-7 rounded-full bg-[var(--overlay-dim)] border border-[var(--border-subtle)] animate-pulse" />
        <div className="w-20 h-7 rounded-full bg-[var(--overlay-dim)] border border-[var(--border-subtle)] animate-pulse" />
        <div className="w-7 h-7 rounded-full bg-[var(--overlay-dim)] border border-[var(--border-subtle)] animate-pulse" />
      </div>
    ),
  },
);

const CommandBar = dynamic(() =>
  import("@/components/CommandBar").then((m) => ({ default: m.CommandBar })),
);
import { SplitWindowLayout } from "@/components/system/SplitWindowLayout";
import { RouteBackground } from "@/components/RouteBackground";
import { ViewportBoundaries } from "@/components/system/ViewportBoundaries";
import { ConversationalBar } from "@/components/agent/ConversationalBar";

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
  weight: ["400", "500", "600", "700"],
  display: "swap",
  adjustFontFallback: true,
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono-loaded",
  weight: ["400", "500"],
  display: "swap",
  adjustFontFallback: true,
});

export const metadata: Metadata = {
  title: "Arch-Systems | Arch OS",
  description: "Multi-departmental industrial operations portal",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Arch Portal",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: "#f5f5f7",
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <html
      lang="en"
      data-theme="light"
      suppressHydrationWarning
      className={`${montserrat.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="preconnect"
          href={process.env.NEXT_PUBLIC_SUPABASE_URL || "https://*.supabase.co"}
        />
        <link
          rel="dns-prefetch"
          href={process.env.NEXT_PUBLIC_SUPABASE_URL || "https://*.supabase.co"}
        />
        <script
          type="speculationrules"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              prerender: [
                {
                  source: "document",
                  where: {
                    and: [
                      {
                        href_matches: [
                          "/",
                          "/drilling/*",
                          "/production/*",
                          "/access-control/*",
                          "/engineering/*",
                          "/control-room/*",
                          "/safety/*",
                          "/training/*",
                          "/satellite-14_observability_configuration/*",
                          "/admin/*",
                        ],
                      },
                      { not: { href_matches: "/api/*" } },
                      { not: { href_matches: "/_next/*" } },
                    ],
                  },
                  eagerness: "moderate",
                },
              ],
            }),
          }}
        />
      </head>
      <body
        suppressHydrationWarning
        className="text-[var(--text-heading)] min-h-screen font-sans antialiased selection:bg-[var(--accent-blue)]/30 selection:text-[var(--accent-blue)] relative overflow-x-hidden bg-[var(--bg-primary)]"
      >
        {/* Skip navigation link for keyboard users */}
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>

        {/* Announce SPA route changes to screen readers (WCAG 4.1.3) */}
        <RouteAnnouncer />

        <ArchThemeProvider>
          <ClientProviders>
            <FocusModeProvider>
              <RouteBackground />
              <PerformanceListener />
              <WebVitalsReporter />
              <OfflineBanner />
              <PWAInstallButton />

              {/* Global taskbar */}
              <header role="banner" className="portal-layer-chrome contents" aria-label="Taskbar">
                <Taskbar
                  centerSlot={<TaskbarSearch />}
                  rightSlot={
                    <nav role="navigation" aria-label="Global">
                      <SystemTrayPill trailing={<HeaderWidgets />} />
                    </nav>
                  }
                />
              </header>

              {/* Content wrapper with main landmark */}
              <main id="main-content" role="main" className="relative z-primary-card pt-14 pb-24 lg:pb-28">
                <SplitWindowLayout>{children}</SplitWindowLayout>
              </main>

              <CommandBar />
              <ConversationalBar />
              <ViewportBoundaries />
              <CookieConsent />
              <FeedbackWidget />
              <Toaster />

              {/* Footer landmark - if exists, otherwise contentinfo on body or create footer */}
              {/* We'll add a proper footer or ensure contentinfo is on appropriate element */}
            </FocusModeProvider>
          </ClientProviders>
        </ArchThemeProvider>
      </body>
    </html>
  );
}
