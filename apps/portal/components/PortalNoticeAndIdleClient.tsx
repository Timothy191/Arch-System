'use client';

import type { AdminPortalSettings } from '@repo/contract';
import { Bell, Clock, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

interface PortalNoticeAndIdleClientProps {
  readonly settings: AdminPortalSettings;
}

const DISMISS_STORAGE_KEY = 'arch_dismissed_portal_notice';
const MS_PER_MINUTE = 60_000;
const IDLE_CHECK_INTERVAL_MS = 30_000;

export function PortalNoticeAndIdleClient({ settings }: PortalNoticeAndIdleClientProps) {
  const bannerText = settings.operationalNoticeBanner.trim();
  const shouldShowBanner = settings.operationalNoticeActive && bannerText.length > 0;
  const [dismissedText, setDismissedText] = useState<string | null>(null);
  const [idleWarningVisible, setIdleWarningVisible] = useState(false);
  const lastActivityRef = useRef<number>(Date.now());
  const idleNotifiedRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = window.sessionStorage.getItem(DISMISS_STORAGE_KEY);
      if (stored) setDismissedText(stored);
    } catch {
      // Ignore storage access errors in restricted browsers
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const thresholdMs = Math.max(5, settings.sessionIdleWarningMinutes) * MS_PER_MINUTE;

    const recordActivity = () => {
      lastActivityRef.current = Date.now();
      if (idleNotifiedRef.current) {
        idleNotifiedRef.current = false;
        setIdleWarningVisible(false);
      }
    };

    const events = ['pointerdown', 'keydown', 'scroll'] as const;
    for (const evt of events) {
      window.addEventListener(evt, recordActivity, { passive: true });
    }

    const intervalId = window.setInterval(() => {
      const elapsedMs = Date.now() - lastActivityRef.current;
      if (elapsedMs >= thresholdMs && !idleNotifiedRef.current) {
        idleNotifiedRef.current = true;
        setIdleWarningVisible(true);
        toast.warning(
          `Session idle for ${settings.sessionIdleWarningMinutes} minutes. Save active shift edits or interact to stay signed in.`
        );
      }
    }, IDLE_CHECK_INTERVAL_MS);

    return () => {
      for (const evt of events) {
        window.removeEventListener(evt, recordActivity);
      }
      window.clearInterval(intervalId);
    };
  }, [settings.sessionIdleWarningMinutes]);

  const handleDismissNotice = () => {
    setDismissedText(bannerText);
    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage.setItem(DISMISS_STORAGE_KEY, bannerText);
      } catch {
        // Ignore storage errors
      }
    }
  };

  const showNotice = shouldShowBanner && dismissedText !== bannerText;
  if (!showNotice && !idleWarningVisible) {
    return null;
  }

  return (
    <div className="mx-auto mb-3 flex w-full max-w-6xl flex-col gap-2 px-4">
      {showNotice && (
        <div
          role="status"
          aria-live="polite"
          data-testid="portal-operational-notice-banner"
          className="liquid-glass-light gold-steel-border gold-steel-border-slim flex items-center justify-between gap-3 rounded-xl border border-accent-gold/40 bg-[var(--material-ultra-thin)] px-4 py-2.5 text-[var(--text-heading)] text-sm shadow-diffusion-sm backdrop-blur-md"
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <Bell className="h-4 w-4 shrink-0 text-accent-gold" aria-hidden="true" />
            <p className="truncate font-medium">{bannerText}</p>
            <span className="hidden shrink-0 rounded-full border border-[var(--border-default)] bg-[var(--bg-secondary)] px-2 py-0.5 font-mono text-[10px] text-[var(--text-muted)] sm:inline-block">
              {settings.siteTimezone} · {settings.dayShiftStart}–{settings.nightShiftStart}
            </span>
          </div>
          <button
            type="button"
            onClick={handleDismissNotice}
            aria-label="Dismiss operational notice"
            className="shrink-0 rounded-md p-1 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-heading)]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {idleWarningVisible && (
        <div
          role="alert"
          data-testid="portal-idle-warning-banner"
          className="liquid-glass-light flex items-center justify-between gap-3 rounded-xl border border-accent-amber/40 bg-[var(--material-ultra-thin)] px-4 py-2 text-[var(--text-heading)] text-xs shadow-diffusion-sm backdrop-blur-md"
        >
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 shrink-0 text-accent-amber" aria-hidden="true" />
            <span>
              Inactivity threshold ({settings.sessionIdleWarningMinutes} min) reached. Confirm any
              unsaved form entries.
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              lastActivityRef.current = Date.now();
              idleNotifiedRef.current = false;
              setIdleWarningVisible(false);
            }}
            className="shrink-0 rounded border border-[var(--border-default)] bg-[var(--bg-secondary)] px-2.5 py-1 font-medium text-[var(--text-heading)] hover:bg-[var(--bg-hover)]"
          >
            I&apos;m still here
          </button>
        </div>
      )}
    </div>
  );
}
