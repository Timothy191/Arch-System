import '@repo/ui/globals.css';
import { ArchThemeProvider } from '@repo/theme/react';
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

const RouteBackground = dynamic(() =>
  import('@/components/RouteBackground').then((m) => ({ default: m.RouteBackground }))
);

import { SplitWindowLayout } from '@/components/system/SplitWindowLayout';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  weight: ['400', '500', '600'],
  display: 'swap',
  adjustFontFallback: true,
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['400', '500'],
  display: 'swap',
  adjustFontFallback: true,
});

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  weight: ['400', '500', '600'],
  display: 'swap',
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
        {/* Preload primary LCP background asset off critical path */}
        <link
          rel="preload"
          href="/background/global-background-poster.webp"
          as="image"
          type="image/webp"
          fetchPriority="high"
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
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
        className="text-[var(--text-heading)] min-h-screen font-sans antialiased selection:bg-[var(--accent-blue)]/30 selection:text-[var(--accent-blue)] relative overflow-x-hidden bg-transparent"
      >
        {/* Skip navigation links for keyboard users (WCAG 2.4.1) */}
        <SkipLinks />

        {/* Announce SPA route changes to screen readers (WCAG 4.1.3) */}
        <RouteAnnouncer />

        <ArchThemeProvider>
          <ClientProviders>
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
            <div className="relative z-primary-card max-w-[1920px] mx-auto shadow-window">
              <main id="main-content" aria-label="Main content" className="relative pt-16">
                <SplitWindowLayout>{children}</SplitWindowLayout>
              </main>

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
                    <span>v{APP_VERSION}</span>
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
            </div>

            <CommandBar />
            <ClientOverlays />
            <Analytics />
            <SpeedInsights />
            <Toaster />
          </ClientProviders>
        </ArchThemeProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
