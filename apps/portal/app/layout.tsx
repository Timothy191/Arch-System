import '@repo/ui/globals.css';
import { ArchThemeProvider } from '@repo/theme/react';
import { AnimationProvider } from '@repo/ui';
import { EveLogo } from '@repo/ui/EveLogo';
import { Toaster } from '@repo/ui/Toaster';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import type { Metadata, Viewport } from 'next';
import dynamic from 'next/dynamic';
import { Inter, JetBrains_Mono, Outfit } from 'next/font/google';
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
        <div className="w-7 h-7 rounded-full liquid-glass-light border border-white/20 animate-pulse" />
        <div className="w-20 h-7 rounded-full liquid-glass-light border border-white/20 animate-pulse" />
        <div className="w-7 h-7 rounded-full liquid-glass-light border border-white/20 animate-pulse" />
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

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
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
  weight: ['400', '500', '600'],
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
      className={`${inter.variable} ${jetbrainsMono.variable} ${outfit.variable} bg-[#f3f4f6]`}
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
        className={`${inter.variable} ${jetbrainsMono.variable} ${outfit.variable} text-[var(--text-heading)] min-h-screen font-sans antialiased selection:bg-[var(--accent-blue)]/30 selection:text-[var(--accent-blue)] relative overflow-x-hidden bg-transparent`}
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
              <div className="relative max-w-[1920px] mx-auto shadow-window">
                <main id="main-content" aria-label="Main content" className="relative pt-16">
                  <SplitWindowLayout>{children}</SplitWindowLayout>
                </main>

                {/* Global footer landmark (WCAG 1.3.1) merged with single-line codebase telemetry & eve branding */}
                <footer
                  role="contentinfo"
                  aria-label="Site footer"
                  className="relative z-10 mt-3 px-3 sm:px-5 py-1.5 border-t border-white/45 liquid-glass-light bg-white/45 backdrop-blur-xl text-[10px] text-[var(--text-muted)] select-none"
                >
                  <div className="flex items-center justify-between gap-2.5 w-full">
                    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/75 border border-black/[0.08] ring-1 ring-inset ring-white/80 shadow-2xs shrink-0">
                      <span
                        className="w-1.5 h-1.5 rounded-full bg-accent-green shrink-0"
                        aria-hidden="true"
                      />
                      <span className="uppercase tracking-wider font-semibold text-[9.5px] text-[var(--text-heading)]">
                        Arch OS
                      </span>
                      <span className="px-1.5 py-px rounded-full bg-arch-accent-blue/10 border border-arch-accent-blue/25 font-mono text-[9px] font-semibold text-arch-accent-blue tabular-nums">
                        v{APP_VERSION}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0 overflow-hidden">
                      <DepartmentReviews />
                    </div>

                    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/75 border border-black/[0.08] ring-1 ring-inset ring-white/80 shadow-2xs shrink-0">
                      <EveLogo className="h-2.5 w-auto text-[var(--text-secondary)]" />
                      <span className="font-mono font-medium text-[9.5px] text-[var(--text-secondary)]">
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
