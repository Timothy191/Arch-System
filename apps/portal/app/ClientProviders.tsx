'use client';

import { type ReactNode, useEffect } from 'react';
import { initializeGlobalErrorHandler } from '@/lib/errors/global-error-handler';
import { ReactQueryProvider } from './ReactQueryProvider';

// AGENT-TRACE: SmoothScrollProvider (Lenis) removed — cosmetic rAF loop overhead on every page.
// Native CSS scroll-behavior: smooth handles anchor links. Remove this comment if smooth scroll is re-added.

export default function ClientProviders({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && 'serviceWorker' in navigator) {
      // Unregister service workers in development to avoid cache conflicts
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        if (registrations.length > 0) {
          Promise.all(registrations.map((r) => r.unregister())).then((results) => {
            if (results.some(Boolean)) {
              // eslint-disable-next-line no-console
              console.log('Unregistered stale service worker(s) in development mode.');
            }
          });
        }
      });
    } else if (process.env.NODE_ENV === 'production' && 'caches' in window) {
      // Purge legacy cache-first v1 cache so stale HTML/RSC payloads cannot persist.
      // Primary /sw.js registration & hardware-scaled asset warmup is handled by ServiceWorkerRegister.
      caches.delete('arch-system-offline-v1').catch(() => {});
    }

    // Initialize offline queue sync listeners with proper cleanup
    import('@repo/shared/hooks').then((mod) => {
      const cleanup = mod.initOfflineQueueListeners();
      return cleanup;
    });

    // Initialize global error handling with autonomous recovery
    initializeGlobalErrorHandler({
      reportErrors: process.env.NODE_ENV !== 'development',
      onError: (error: Error, info: { type: string; error: Error }) => {
        // eslint-disable-next-line no-console
        console.error('Global error handled:', error, info);
      },
    });
  }, []);

  return <ReactQueryProvider>{children}</ReactQueryProvider>;
}
