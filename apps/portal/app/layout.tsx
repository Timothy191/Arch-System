import "@repo/ui/globals.css";
import "@/styles/print-report.css";
import { ArchThemeProvider } from "@repo/theme/react";
import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Outfit } from "next/font/google";
import dynamic from "next/dynamic";
import ClientProviders from "./ClientProviders";
import { OfflineBanner } from "@/components/OfflineBanner";
import { FocusModeProvider } from "@/components/FocusModeProvider";

import { RouteAnnouncer } from "@/components/RouteAnnouncer";
import { AriaLauncher } from "@/components/ai/AriaLauncher";
import { SystemTrayPill } from "@/components/system/SystemTray";
import { WebVitalsReporter } from "@/components/WebVitalsReporter";
import { MacMenuBar } from "@repo/ui/MacMenuBar";
import { Toaster } from "@repo/ui/Toaster";
import { ClientOverlays } from "@/components/ClientOverlays";
import { SkipLinks } from "@/components/accessibility/SkipLinks";

const HeaderWidgets = dynamic(
  () =>
    import("@/components/HeaderWidgets").then((m) => ({
      default: m.HeaderWidgets,
    })),
  {
    loading: () => (
      <div className="flex items-center gap-3" aria-hidden="true">
        <div className="w-7 h-7 rounded-full liquid-glass-light border border-white/20 animate-pulse" />
        <div className="w-20 h-7 rounded-full liquid-glass-light border border-white/20 animate-pulse" />
        <div className="w-7 h-7 rounded-full liquid-glass-light border border-white/20 animate-pulse" />
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
      <head suppressHydrationWarning>
        <meta charSet="UTF-8" />
        {/* Preload primary LCP background asset off critical path */}
        <link
          rel="preload"
          href="/background/edge-of-the-event-horizon-poster.webp"
          as="image"
          type="image/webp"
          fetchPriority="high"
        />
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
      </head>
      <body
        suppressHydrationWarning
        className="text-[var(--text-heading)] min-h-screen font-sans antialiased selection:bg-[var(--accent-blue)]/30 selection:text-[var(--accent-blue)] relative overflow-x-hidden bg-transparent max-w-[1920px] mx-auto shadow-window"
      >
        {/* Skip navigation links for keyboard users (WCAG 2.4.1) */}
        <SkipLinks />

        {/* Announce SPA route changes to screen readers (WCAG 4.1.3) */}
        <RouteAnnouncer />

        <ArchThemeProvider>
          <ClientProviders>
            <FocusModeProvider>
              <RouteBackground />
              {/* Removed PerformanceListener as it causes extreme lag via infinite rAF loops */}
              <WebVitalsReporter />
              <OfflineBanner />
              <AriaLauncher />

              {/* Global Navigation Header with proper landmark (WCAG 1.3.1) */}
              <header
                role="banner"
                aria-label="Global navigation"
                className="flex items-center gap-3"
              >
                <MacMenuBar
                  rightSlot={
                    <nav id="navigation" role="navigation" aria-label="Main menu">
                      <div className="flex items-center gap-3">
                        <SystemTrayPill />
                        <HeaderWidgets />
                      </div>
                    </nav>
                  }
                />
              </header>

              {/* Content wrapper with main landmark (WCAG 1.3.1) */}
              <main
                id="main-content"
                role="main"
                aria-label="Main content"
                className="relative z-primary-card pt-16"
              >
                <SplitWindowLayout>{children}</SplitWindowLayout>
              </main>

              <CommandBar />
              <ViewportBoundaries />
              <ClientOverlays />
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
