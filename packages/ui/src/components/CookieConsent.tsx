'use client';

import { X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from './ui/button';

export function CookieConsent() {
  // AGENT-TRACE: Default the banner to VISIBLE so it is server-rendered into the
  // initial HTML and paints at first paint. Previously it started hidden and only
  // appeared post-hydration, making it a late-painting LCP candidate (the largest
  // contentful paint on the login page). The useEffect below hides it on return
  // visits where consent already exists (brief flash, acceptable tradeoff).
  const [showBanner, setShowBanner] = useState(true);

  useEffect(() => {
    const hasConsented = localStorage.getItem('cookie_consent');
    if (hasConsented) {
      setShowBanner(false);
    }
  }, []);

  const acceptCookies = () => {
    localStorage.setItem('cookie_consent', 'true');
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[100] flex max-h-[45vh] flex-col gap-4 overflow-y-auto border-border border-t bg-background/95 p-4 shadow-lg backdrop-blur-xl sm:max-h-none sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div className="flex-1 text-muted-foreground text-sm">
        <p>
          We use cookies to improve your experience, analyze site traffic, and support operational
          security. By continuing to use the Arch Portal, you consent to our use of cookies as
          described in our{' '}
          <Link href="/privacy" className="font-medium text-[var(--accent-blue)] hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
      <div className="flex w-full shrink-0 items-center gap-3 sm:w-auto">
        <Button
          type="button"
          onClick={() => setShowBanner(false)}
          variant="ghost"
          className="flex-1 sm:flex-none"
        >
          Decline Optional
        </Button>
        <Button type="button" onClick={acceptCookies} className="flex-1 sm:flex-none">
          Accept All
        </Button>
        <Button
          type="button"
          onClick={() => setShowBanner(false)}
          variant="ghost"
          size="icon"
          className="hidden sm:inline-flex"
          aria-label="Close"
        >
          <X data-icon="inline-start" />
        </Button>
      </div>
    </div>
  );
}
