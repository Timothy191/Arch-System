import "@repo/ui/globals.css";
import { ArchThemeProvider } from "@repo/theme/react";
import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Outfit } from "next/font/google";
import dynamic from "next/dynamic";
import ClientProviders from "./ClientProviders";
import { OfflineBanner } from "@/components/OfflineBanner";
import { FocusModeProvider } from "@/components/FocusModeProvider";
import { PerformanceListener } from "@/components/PerformanceListener";
import { RouteAnnouncer } from "@/components/RouteAnnouncer";
import { AIAssistantWrapper } from "@/components/ai/AIAssistantWrapper";
import { PWAInstallButton } from "@/components/PWAInstallButton";
import { FocusModeToggle } from "@/components/FocusModeToggle";
import { SystemTrayPill } from "@/components/system/SystemTray";
import { WebVitalsReporter } from "@/components/WebVitalsReporter";
import { MacMenuBar } from "@repo/ui/MacMenuBar";
import { Toaster } from "@repo/ui/Toaster";
import { CookieConsent } from "@repo/ui/CookieConsent";
import { FeedbackWidget } from "@/components/FeedbackWidget";
import { HUB_PATH } from "@repo/utils";

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

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600"],
  display: "swap",
  adjustFontFallback: true,
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500"],
  display: "swap",
  adjustFontFallback: true,
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  weight: ["400", "500", "600"],
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
      className={`${inter.variable} ${jetbrainsMono.variable} ${outfit.variable}`}
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
                        href_matches: [HUB_PATH, "/hub/*", "/admin/*"],
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
        className="text-[var(--text-heading)] min-h-screen font-sans antialiased selection:bg-[var(--accent-blue)]/30 selection:text-[var(--accent-blue)] relative overflow-x-hidden bg-transparent"
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
              <AIAssistantWrapper />

              {/* Global Navigation Header with proper landmark */}
              <header role="banner" className="flex items-center gap-3">
                <MacMenuBar
                  rightSlot={
                    <nav role="navigation" aria-label="Global">
                      <div className="flex items-center gap-3">
                        <FocusModeToggle variant="icon" />
                        <SystemTrayPill />
                        <HeaderWidgets />
                      </div>
                    </nav>
                  }
                />
              </header>

              {/* Content wrapper with main landmark */}
              <main id="main-content" role="main" className="relative z-primary-card pt-16">
                <SplitWindowLayout>{children}</SplitWindowLayout>
              </main>

              <CommandBar />
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
