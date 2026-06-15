import "@repo/ui/globals.css";
import { ArchThemeProvider } from "@repo/theme/react";
import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import ClientProviders from "./ClientProviders";
import { OfflineBanner } from "@/components/OfflineBanner";
import { FocusModeProvider } from "@/components/FocusModeProvider";
import { PerformanceListener } from "@/components/PerformanceListener";
import { CommandBar } from "@/components/CommandBar";
import { RouteAnnouncer } from "@/components/RouteAnnouncer";
import { AIAssistantWrapper } from "@/components/ai/AIAssistantWrapper";
import dynamic from "next/dynamic";
import { FocusModeToggle } from "@/components/FocusModeToggle";
import { SystemTrayPill } from "@/components/system/SystemTray";
import { WebVitalsReporter } from "@/components/WebVitalsReporter";
import { MacMenuBar } from "@repo/ui/MacMenuBar";

const HeaderWidgets = dynamic(
  () =>
    import("@/components/HeaderWidgets").then((m) => ({
      default: m.HeaderWidgets,
    })),
  {
    loading: () => (
      <div className="flex items-center gap-3" aria-hidden="true">
        <div className="w-7 h-7 rounded-full bg-black/[0.03] border border-black/[0.05] animate-pulse" />
        <div className="w-20 h-7 rounded-full bg-black/[0.03] border border-black/[0.05] animate-pulse" />
        <div className="w-7 h-7 rounded-full bg-black/[0.03] border border-black/[0.05] animate-pulse" />
      </div>
    ),
  },
);
import { SplitWindowLayout } from "@/components/system/SplitWindowLayout";
import { RouteBackground } from "@/components/RouteBackground";
import { ViewportBoundaries } from "@/components/system/ViewportBoundaries";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <html
      lang="en"
      data-theme="light"
      suppressHydrationWarning
      className={`${inter.variable} ${jetbrainsMono.variable}`}
    >
      <head>
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
                          "/satellite-monitoring/*",
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
              <main
                id="main-content"
                role="main"
                className="relative z-primary-card pt-16"
              >
                <SplitWindowLayout>{children}</SplitWindowLayout>
              </main>

              <CommandBar />
              <ViewportBoundaries />

              {/* Footer landmark - if exists, otherwise contentinfo on body or create footer */}
              {/* We'll add a proper footer or ensure contentinfo is on appropriate element */}
            </FocusModeProvider>
          </ClientProviders>
        </ArchThemeProvider>
      </body>
    </html>
  );
}
