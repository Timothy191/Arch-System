import "@repo/ui/globals.css";
import "@/styles/print-report.css";
import { ArchThemeProvider } from "@repo/theme/react";
import { EveLogo } from "@repo/ui/EveLogo";
import { Toaster } from "@repo/ui/Toaster";
import type { Metadata, Viewport } from "next";
import dynamic from "next/dynamic";
import { Inter, JetBrains_Mono, Outfit } from "next/font/google";
import { SkipLinks } from "@/components/accessibility/SkipLinks";
import { AriaLauncher } from "@/components/ai/AriaLauncher";
import { ClientOverlays } from "@/components/ClientOverlays";
import { FocusModeProvider } from "@/components/FocusModeProvider";
import { OfflineBanner } from "@/components/OfflineBanner";
import { RouteAnnouncer } from "@/components/RouteAnnouncer";
import { SystemTrayPill } from "@/components/system/SystemTray";
import { WebVitalsReporter } from "@/components/WebVitalsReporter";
import ClientProviders from "./ClientProviders";

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

// AGENT-TRACE: MacMenuBar deferred via next/dynamic to remove framer-motion
// from the shared layout chunk. Without this, framer-motion lands in every
// page's bundle (including error.tsx, global-error.tsx) because MacMenuBar
// is synchronously imported in a Server Component layout boundary.
const MacMenuBar = dynamic(
  () => import("@repo/ui/MacMenuBar").then((m) => ({ default: m.MacMenuBar })),
  {
    loading: () => (
      <div className="h-9 w-full animate-pulse rounded-lg bg-white/10" aria-hidden="true" />
    ),
  },
);

import { RouteBackground } from "@/components/RouteBackground";
import { SplitWindowLayout } from "@/components/system/SplitWindowLayout";
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

const PORTAL_VERSION = process.env.PORTAL_VERSION ?? "2.0.0.1";

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
              <header aria-label="Global navigation" className="flex items-center gap-3">
                <MacMenuBar
                  rightSlot={
                    <nav id="navigation" aria-label="Main menu">
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
                aria-label="Main content"
                className="relative z-primary-card pt-16"
              >
                <SplitWindowLayout>{children}</SplitWindowLayout>
              </main>

              <CommandBar />
              <ViewportBoundaries />
              <ClientOverlays />
              <Toaster />

              {/* Global footer landmark (WCAG 1.3.1) with eve branding + Vercel attribution */}
              <footer
                role="contentinfo"
                aria-label="Site footer"
                className="relative z-10 mt-4 px-6 py-4 border-t border-[var(--border-subtle)] text-[10px] text-[var(--text-muted)] select-none"
              >
                <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="uppercase tracking-wider font-medium text-[var(--text-secondary)]">
                      Arch OS
                    </span>
                    <span className="text-[var(--text-muted)]/60">·</span>
                    <span>v{PORTAL_VERSION}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <EveLogo className="h-3 w-auto text-[var(--text-secondary)]" />
                    <span className="text-[var(--text-muted)]">eve</span>
                  </div>
                </div>
                <p className="mt-2 text-center sm:text-left text-[9px] leading-relaxed text-[var(--text-muted)]/80">
                  Vercel, the Vercel design, Next.js and related marks, designs and logos are
                  trademarks or registered trademarks of Vercel, Inc. or its affiliates in the US
                  and other countries.
                </p>
              </footer>
            </FocusModeProvider>
          </ClientProviders>
        </ArchThemeProvider>
      </body>
    </html>
  );
}
