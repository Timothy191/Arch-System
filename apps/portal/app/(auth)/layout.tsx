'use client';

import * as Sentry from '@sentry/nextjs';

// 4rem (pt-16) is the global header offset — subtract it so the auth area sizes
// against the space actually available, not the full viewport.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <Sentry.ErrorBoundary fallback={<p>An error has occurred in the authentication view.</p>}>
      <div className="relative min-h-[calc(100vh-4rem)] w-full h-full flex overflow-hidden">
        {children}
      </div>
    </Sentry.ErrorBoundary>
  );
}
