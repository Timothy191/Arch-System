'use client';

import { Download, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export function PWAInstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent Chrome 67 and earlier from automatically showing the prompt
      e.preventDefault();
      // Stash the event so it can be triggered later
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowInstallPrompt(true);
    };

    // Listen for app installed event
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowInstallPrompt(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = useCallback(async () => {
    if (!deferredPrompt) {
      return;
    }

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      // eslint-disable-next-line no-console
      console.log('User accepted the install prompt');
    } else {
      // eslint-disable-next-line no-console
      console.log('User dismissed the install prompt');
    }

    // Clear the deferred prompt
    setDeferredPrompt(null);
    setShowInstallPrompt(false);
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    setShowInstallPrompt(false);
    // Don't clear deferredPrompt - user can trigger install via other means
  }, []);

  if (isInstalled || !showInstallPrompt) {
    return null;
  }

  return (
    <div
      role="alert"
      className="slide-in-from-bottom-4 fade-in fixed right-4 bottom-4 z-toast flex animate-in items-center gap-3 rounded-lg border border-black/[0.08] bg-white/90 p-4 shadow-card backdrop-blur-xl duration-300"
    >
      <div className="flex-1">
        <p className="font-medium text-[var(--text-heading)] text-sm">Install Arch Portal</p>
        <p className="text-[var(--text-muted)] text-xs">Add to home screen for offline access</p>
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
