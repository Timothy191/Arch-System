'use client';

import { X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from './ui/button';

const COOKIE_CONSENT_STORAGE_KEY = 'cookie_consent';
const COOKIE_CONSENT_COOKIE_NAME = 'arch_cookie_consent';
const COOKIE_MAX_AGE_SECONDS = 31536000;

function readStoredConsent(): string | null {
  try {
    const localValue = localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
    if (localValue) {
      return localValue;
    }
  } catch {
    // Ignore storage access errors in restricted browsing modes
  }

  if (typeof document !== 'undefined' && document.cookie) {
    const match = document.cookie
      .split('; ')
      .find((entry) => entry.startsWith(`${COOKIE_CONSENT_COOKIE_NAME}=`));
    if (match) {
      return match.split('=')[1] ?? null;
    }
  }

  return null;
}

function persistConsentChoice(choice: 'accepted' | 'declined'): void {
  try {
    localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, choice);
  } catch {
    // Ignore storage access errors in restricted browsing modes
  }

  if (typeof document !== 'undefined') {
    // biome-ignore lint/suspicious/noDocumentCookie: intentional first-party consent persistence cookie
    document.cookie = `${COOKIE_CONSENT_COOKIE_NAME}=${choice}; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
  }
}

export function CookieConsent() {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const storedChoice = readStoredConsent();
    if (!storedChoice) {
      setShowBanner(true);
    }
  }, []);

  const acceptCookies = () => {
    persistConsentChoice('accepted');
    setShowBanner(false);
  };

  const declineOptionalCookies = () => {
    persistConsentChoice('declined');
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
          onClick={declineOptionalCookies}
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
          onClick={declineOptionalCookies}
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
