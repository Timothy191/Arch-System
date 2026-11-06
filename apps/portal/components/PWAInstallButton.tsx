'use client';

import { analytics } from '@repo/utils/client';
import { Download, Share, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

const DISMISS_STORAGE_KEY = 'arch-pwa-install-dismissed-at';
const DISMISS_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua);
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  return isIos && isSafari;
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches;
}

function wasRecentlyDismissed(): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    const dismissedAt = Number(localStorage.getItem(DISMISS_STORAGE_KEY));
    if (!Number.isFinite(dismissedAt) || dismissedAt <= 0) return false;
    return Date.now() - dismissedAt < DISMISS_COOLDOWN_MS;
  } catch {
    return false;
  }
}

function recordDismissal(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(DISMISS_STORAGE_KEY, String(Date.now()));
  } catch {
    // ignore storage failures
  }
}

export function PWAInstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => {
    if (isStandalone()) {
      setIsInstalled(true);
      return;
    }

    if (wasRecentlyDismissed()) {
      return;
    }

    if (isIosSafari()) {
      setShowIosHint(true);
      return;
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowInstallPrompt(true);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowInstallPrompt(false);
      setDeferredPrompt(null);
      analytics.track({
        eventName: 'PWA Installed',
        properties: { platform: 'web' },
      });
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = useCallback(async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    analytics.track({
      eventName: outcome === 'accepted' ? 'PWA Install Accepted' : 'PWA Install Dismissed',
      properties: { outcome },
    });

    setDeferredPrompt(null);
    setShowInstallPrompt(false);
    if (outcome === 'dismissed') {
      recordDismissal();
    }
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    setShowInstallPrompt(false);
    recordDismissal();
  }, []);

  const handleIosDismiss = useCallback(() => {
    setShowIosHint(false);
    recordDismissal();
  }, []);

  if (isInstalled) return null;

  if (showIosHint) {
    return (
      <div
        role="status"
        className="slide-in-from-bottom-4 fade-in fixed right-4 bottom-4 z-toast flex animate-in items-center gap-3 rounded-lg border border-black/[0.08] bg-white/90 p-4 shadow-card backdrop-blur-xl duration-300"
      >
        <div className="flex-1">
          <p className="font-medium text-[var(--text-heading)] text-sm">Install Arch Portal</p>
          <p className="text-[var(--text-muted)] text-xs">
            Tap <Share className="inline h-3.5 w-3.5" /> then "Add to Home Screen" for offline
            access
          </p>
        </div>
        <button
          onClick={handleIosDismiss}
          className="p-1 text-[var(--text-muted)] transition-colors hover:text-[var(--text-heading)]"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  if (!showInstallPrompt) return null;

  return (
    <div
      role="alert"
      className="slide-in-from-bottom-4 fade-in fixed right-4 bottom-4 z-toast flex animate-in items-center gap-3 rounded-lg border border-black/[0.08] bg-white/90 p-4 shadow-card backdrop-blur-xl duration-300"
    >
      <div className="flex-1">
        <p className="font-medium text-[var(--text-heading)] text-sm">Install Arch Portal</p>
        <p className="text-[var(--text-muted)] text-xs">
          Add to home screen for offline access to dashboards and telemetry
        </p>
      </div>
      <button
        onClick={handleInstallClick}
        className="flex items-center gap-2 rounded-md bg-[var(--accent-blue)] px-3 py-2 font-medium text-sm text-white transition-opacity hover:opacity-90"
      >
        <Download className="h-4 w-4" />
        Install
      </button>
      <button
        onClick={handleDismiss}
        className="p-1 text-[var(--text-muted)] transition-colors hover:text-[var(--text-heading)]"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
