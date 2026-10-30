import '@repo/ui/globals.css';
import { ArchThemeProvider } from '@repo/theme/react';
import { AnimationProvider } from '@repo/ui';
import { EveLogo } from '@repo/ui/EveLogo';
import { Toaster } from '@repo/ui/Toaster';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import type { Metadata, Viewport } from 'next';
import dynamic from 'next/dynamic';
import { IBM_Plex_Sans, Inter, JetBrains_Mono, Outfit } from 'next/font/google';
import { SkipLinks } from '@/components/accessibility/SkipLinks';
import { ClientOverlays } from '@/components/ClientOverlays';
import { RouteAnnouncer } from '@/components/RouteAnnouncer';
import { SystemTrayPill } from '@/components/system/SystemTray';
import { DepartmentReviews } from '@/features/hub';
import ClientProviders from './ClientProviders';

const HeaderWidgets = dynamic(
  () =>
    import('@/components/HeaderWidgets').then((m) => ({
      default: m.HeaderWidgets,
    })),
  {
    loading: () => (
      <div className="flex items-center gap-3" aria-hidden="true">
        <div className="liquid-glass-light h-7 w-7 animate-pulse rounded-full border border-white/20" />
        <div className="liquid-glass-light h-7 w-20 animate-pulse rounded-full border border-white/20" />
        <div className="liquid-glass-light h-7 w-7 animate-pulse rounded-full border border-white/20" />
      </div>
    ),
  }
);

const CommandBar = dynamic(() =>
  import('@/components/CommandBar').then((m) => ({ default: m.CommandBar }))
);

// AGENT-TRACE: MacMenuBar deferred via next/dynamic to remove framer-motion
// from the shared layout chunk. Without this, framer-motion lands in every
// page's bundle (including error.tsx, global-error.tsx) because MacMenuBar
// is synchronously imported in a Server Component layout boundary.
const MacMenuBar = dynamic(
  () => import('@repo/ui/MacMenuBar').then((m) => ({ default: m.MacMenuBar })),
  {
    ssr: true,
  }
);

import { RouteBackground } from '@/components/RouteBackground';
import { SplitWindowLayout } from '@/components/system/SplitWindowLayout';

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  preload: true,
  adjustFontFallback: true,
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  weight: ['400', '500', '600'],
  display: 'swap',
  preload: false,
  adjustFontFallback: true,
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['400', '500'],
  display: 'swap',
  preload: false,
  adjustFontFallback: true,
});

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  preload: false,
  adjustFontFallback: true,
});

import { APP_VERSION } from '@/lib/version';

export const metadata: Metadata = {
  title: 'Arch-Systems | Arch OS',
  description: 'Multi-departmental industrial operations portal',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Arch Portal',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: '#f5f5f7',
  viewportFit: 'cover',
};

import { ServiceWorkerRegister } from './ServiceWorkerRegister';
export default function RootLayout({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <html
      lang="en"
      data-theme="light"
      suppressHydrationWarning
      className={`${ibmPlexSans.variable} ${inter.variable} ${jetbrainsMono.variable} ${outfit.variable} bg-[#f3f4f6]`}
    >
      <head suppressHydrationWarning>
        <meta charSet="UTF-8" />
        {/* Preload primary LCP background asset off critical path (Desktop & Mobile) */}
        <link
          rel="preload"
          href="/background/global-background-poster.webp"
          as="image"
          type="image/webp"
          media="(min-width: 768px)"
          fetchPriority="high"
        />
        <link
          rel="preload"
          href="/background/global-background-poster-mobile.webp"
          as="image"
          type="image/webp"
          media="(max-width: 767px)"
          fetchPriority="high"
        />
        <link
          rel="preconnect"
          href={process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://*.supabase.co'}
        />
        <link
          rel="dns-prefetch"
          href={process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://*.supabase.co'}
        />
      </head>
      <body
        suppressHydrationWarning
        className={`${ibmPlexSans.variable} ${inter.variable} ${jetbrainsMono.variable} ${outfit.variable} relative min-h-screen overflow-x-hidden bg-transparent font-sans text-[var(--text-heading)] antialiased selection:bg-[var(--accent-blue)]/30 selection:text-[var(--accent-blue)]`}
      >
        {/* Skip navigation links for keyboard users (WCAG 2.4.1) */}
        <SkipLinks />

        {/* Announce SPA route changes to screen readers (WCAG 4.1.3) */}
        <RouteAnnouncer />

        <ArchThemeProvider>
          <ClientProviders>
            <AnimationProvider>
              {/* Global ambient background wallpaper */}
              <RouteBackground />

              {/* Global Navigation Header with proper landmark (WCAG 1.3.1) */}
              <header aria-label="Global navigation">
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
              <div className="relative mx-auto max-w-[1920px] shadow-window">
                <main id="main-content" aria-label="Main content" className="relative pt-16 pb-16">
                  <SplitWindowLayout>{children}</SplitWindowLayout>
                </main>

                {/* Global footer landmark (WCAG 1.3.1) matching top MacMenuBar floating pill geometry & effects */}
                <footer
                  role="contentinfo"
                  aria-label="Site footer"
                  className="liquid-glass-light gold-steel-border fixed inset-x-3 bottom-2 z-navigation flex h-11 items-center rounded-full border border-white/20 px-3.5 text-[10px] text-[var(--text-muted)] shadow-window"
                >
                  <div className="flex w-full items-center justify-between gap-2.5">
                    <div className="gold-steel-border gold-steel-border-slim inline-flex shrink-0 items-center gap-1.5 rounded-full border border-black/[0.08] bg-white/75 px-2.5 py-0.5 shadow-2xs ring-1 ring-white/80 ring-inset">
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent-green"
                        aria-hidden="true"
                      />
                      <span className="font-semibold text-[9.5px] text-[var(--text-heading)] uppercase tracking-wider">
                        Arch OS
                      </span>
                      <span className="rounded-full border border-arch-accent-blue/25 bg-arch-accent-blue/10 px-1.5 py-px font-mono font-semibold text-[9px] text-arch-accent-blue tabular-nums">
                        v{APP_VERSION}
                      </span>
                      <span className="hidden items-center gap-1 border-black/10 border-l pl-1 font-mono text-[9px] text-[var(--text-secondary)] tabular-nums sm:inline-flex">
                        99.95% SLA · 9 Modules
                      </span>
                    </div>

                    <div className="min-w-0 flex-1 overflow-hidden">
                      <DepartmentReviews />
                    </div>

                    <div className="gold-steel-border gold-steel-border-slim inline-flex shrink-0 items-center gap-1.5 rounded-full border border-black/[0.08] bg-white/75 px-2.5 py-0.5 shadow-2xs ring-1 ring-white/80 ring-inset">
                      <span className="hidden items-center gap-1 border-black/10 border-r pr-1.5 font-mono font-semibold text-[9px] text-accent-green md:inline-flex">
                        ● Sync Active
                      </span>
                      <EveLogo className="h-2.5 w-auto text-[var(--text-secondary)]" />
                      <span className="font-medium font-mono text-[9.5px] text-[var(--text-secondary)]">
                        eve
                      </span>
                    </div>
                  </div>
                </footer>
              </div>

              <CommandBar />
              <ClientOverlays />
              <Analytics />
              <SpeedInsights />
              <Toaster />
            </AnimationProvider>
          </ClientProviders>
        </ArchThemeProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
