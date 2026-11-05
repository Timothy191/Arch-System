import '@repo/ui/globals.css';
import '@/styles/print-report.css';
import { ArchThemeProvider } from '@repo/theme/react';
import { AnimationProvider } from '@repo/ui';
import { EveLogo } from '@repo/ui/EveLogo';
import { Toaster } from '@repo/ui/Toaster';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import type { Metadata, Viewport } from 'next';
import dynamic from 'next/dynamic';
import { IBM_Plex_Sans, JetBrains_Mono, Space_Grotesk } from 'next/font/google';
import { Suspense } from 'react';
import { SkipLinks } from '@/components/accessibility/SkipLinks';
import { ClientOverlays } from '@/components/ClientOverlays';
import { MenuIdentity, MenuIdentitySkeleton } from '@/components/nav/MenuIdentity';
import { RouteAnnouncer } from '@/components/RouteAnnouncer';
import { SpeculationRules } from '@/components/SpeculationRules';
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
      <div className="flex items-center gap-1.5" aria-hidden="true">
        <div className="h-4 w-14 animate-pulse rounded-full bg-black/5" />
        <div className="h-4 w-4 animate-pulse rounded-full bg-black/5" />
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

// Font strategy (measured, latin woff2, self-hosted + immutable-cached by next/font):
//   --font-sans    IBM Plex Sans  ~40 KB  body/UI
//   --font-display Space Grotesk  ~22 KB  headings + `.font-anurati`
//   --font-mono    JetBrains Mono ~31 KB  telemetry/tables (below the fold)
// All three stay `preload: false`: next/font also injects these preloads into the
// RSC prefetch `Link` header, which Chrome reports as unused preloads on client
// navigations (fixed in 79333bf7). Fonts are discovered from the CSS chunk instead.
// A fourth family (Inter) used to be loaded here, but no CSS rule ever referenced
// `--font-inter`, so it only added @font-face rules to the render-blocking CSS.
const ibmPlexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  weight: ['400', '500', '600', '700'],
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

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-display',
  weight: 'variable',
  display: 'swap',
  preload: false,
  adjustFontFallback: true,
});

import { APP_VERSION } from '@/lib/version';

const SITE_NAME = 'Arch-Systems';
const SITE_TITLE = 'Arch-Systems | Arch OS';
const SITE_DESCRIPTION = 'Multi-departmental industrial operations portal';
const LOCAL_SITE_ORIGIN = 'http://localhost:3000';

/**
 * Resolves the canonical origin used to absolutize metadata URLs (Open Graph images,
 * canonical links). `metadataBase` must be an absolute URL, so the local dev origin is
 * the safe final fallback rather than an undefined value.
 */
function resolveSiteOrigin(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  return LOCAL_SITE_ORIGIN;
}

export const metadata: Metadata = {
  metadataBase: new URL(resolveSiteOrigin()),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  manifest: '/manifest.json',
  // AGENT-TRACE: This is an authenticated industrial operations portal (SCADA telemetry,
  // employee records, shift closeout). Nothing here belongs in a search index. Enforced in
  // three places: this directive, `app/robots.ts`, and the `X-Robots-Tag` response header in
  // next.config.mjs (which also covers static assets that never hit a React render).
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nosnippet: true,
  },
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    locale: 'en_GB',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: '/',
  },
  // `app/opengraph-image.tsx` supplies the 1200x630 card to both Open Graph and
  // Twitter via Next's file-convention fallback, so no manual image list is needed.
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
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
      className={`${ibmPlexSans.variable} ${jetbrainsMono.variable} ${spaceGrotesk.variable} bg-[#f3f4f6]`}
    >
      <head suppressHydrationWarning>
        <meta charSet="UTF-8" />
        <link
          rel="preconnect"
          href={process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://*.supabase.co'}
        />
        <link
          rel="dns-prefetch"
          href={process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://*.supabase.co'}
        />
        <SpeculationRules />
      </head>
      <body
        suppressHydrationWarning
        className={`${ibmPlexSans.variable} ${jetbrainsMono.variable} ${spaceGrotesk.variable} relative min-h-dvh overflow-x-hidden bg-transparent font-sans text-[var(--text-heading)] antialiased selection:bg-[var(--accent-blue)]/30 selection:text-[var(--accent-blue)]`}
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
                  userSlot={
                    <Suspense fallback={<MenuIdentitySkeleton />}>
                      <MenuIdentity />
                    </Suspense>
                  }
                  rightSlot={
                    <nav id="navigation" aria-label="Main menu">
                      <div
                        data-testid="taskbar-unified-pill"
                        className="gold-steel-border gold-steel-border-slim flex h-7 items-center gap-1.5 rounded-full border border-white/20 bg-[var(--material-ultra-thin)] px-2.5 shadow-diffusion-sm backdrop-blur-md transition-colors"
                      >
                        <SystemTrayPill embedded />
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

                {/* Global footer landmark (WCAG 1.3.1) — clean enterprise status bar */}
                <footer
                  role="contentinfo"
                  aria-label="Site footer"
                  className="liquid-glass-light gold-steel-border gold-steel-border-slim fixed inset-x-3 bottom-2 z-navigation flex h-9 items-center rounded-full border border-white/25 bg-[var(--material-ultra-thin)] px-3.5 text-[10px] text-[var(--text-muted)] shadow-diffusion-sm backdrop-blur-md"
                >
                  <div className="flex w-full items-center justify-between gap-3">
                    <div className="inline-flex shrink-0 items-center gap-2">
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent-green"
                        aria-hidden="true"
                      />
                      <span className="font-semibold text-[10px] text-[var(--text-heading)] tracking-wider">
                        Arch OS
                      </span>
                      <span className="rounded-md border border-arch-accent-blue/25 bg-arch-accent-blue/10 px-1.5 py-px font-mono font-semibold text-[9px] text-arch-accent-blue tabular-nums">
                        v{APP_VERSION}
                      </span>
                      <span className="hidden items-center gap-1.5 border-black/10 border-l pl-2 font-mono text-[9.5px] text-[var(--text-secondary)] tabular-nums sm:inline-flex">
                        99.95% SLA · 9 Modules
                      </span>
                    </div>

                    <div className="min-w-0 flex-1 overflow-hidden">
                      <DepartmentReviews />
                    </div>

                    <div className="inline-flex shrink-0 items-center gap-2">
                      <span className="hidden items-center gap-1 border-black/10 border-r pr-2 font-mono font-semibold text-[9.5px] text-accent-green md:inline-flex">
                        <span
                          className="h-1.5 w-1.5 rounded-full bg-accent-green"
                          aria-hidden="true"
                        />
                        Sync Active
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
              <Analytics scriptSrc="/va/script.js" />
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
