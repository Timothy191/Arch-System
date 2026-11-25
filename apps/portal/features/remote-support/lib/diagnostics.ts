'use client';

import type { ClientDiagnostics } from '@repo/contract';

const MAX_RECENT_ERRORS = 10;
const MAX_ERROR_LENGTH = 360;

const capturedErrors: string[] = [];

/**
 * Strips bearer tokens, JWTs, query secrets, and email addresses from text
 * before attaching diagnostics to a remote support session.
 */
export function redactDiagnosticText(rawText: string): string {
  return rawText
    .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [REDACTED]')
    .replace(/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, '[JWT_REDACTED]')
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[EMAIL_REDACTED]')
    .replace(/([?&](?:token|key|secret|password|auth)=)[^&\s]+/gi, '$1[REDACTED]')
    .slice(0, MAX_ERROR_LENGTH);
}

/**
 * Records a sanitized client error snippet in memory for support diagnostics.
 */
export function recordClientDiagnosticError(message: string): void {
  const sanitized = redactDiagnosticText(message);
  if (!sanitized) return;
  if (capturedErrors.length >= MAX_RECENT_ERRORS) {
    capturedErrors.shift();
  }
  capturedErrors.push(sanitized);
}

export function clearClientDiagnosticErrors(): void {
  capturedErrors.length = 0;
}

/**
 * Collects a minimal, SSR-safe, redacted diagnostics snapshot for support staff.
 */
export function captureClientDiagnostics(offlineQueueCount = 0): ClientDiagnostics {
  const isBrowser = typeof window !== 'undefined';
  const rawRoute = isBrowser ? window.location.pathname : '/';
  const rawUserAgent =
    isBrowser && typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown';

  return {
    route: redactDiagnosticText(rawRoute),
    portalVersion: process.env.NEXT_PUBLIC_PORTAL_VERSION ?? 'portal',
    viewportWidth: isBrowser ? window.innerWidth : 0,
    viewportHeight: isBrowser ? window.innerHeight : 0,
    isOnline: isBrowser && typeof navigator !== 'undefined' ? navigator.onLine : true,
    offlineQueueCount: Math.max(0, offlineQueueCount),
    userAgentSummary: redactDiagnosticText(rawUserAgent).slice(0, 200),
    capturedAt: new Date().toISOString(),
    recentErrors: [...capturedErrors],
  };
}
