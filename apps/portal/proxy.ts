import type { NextRequest } from 'next/server';
import { proxy as handleProxy } from './server/proxy';

/**
 * Next.js edge proxy (Next.js 16 standard replacing deprecated middleware.ts)
 * Delegates to server/proxy.ts for:
 * - Supabase session refresh
 * - Role / department route gating (employees table)
 * - Redis-cached department slug → UUID resolution
 * - API exemptions (/api/c66, /api/health, /api/metrics)
 */
export async function proxy(request: NextRequest) {
  const response = await handleProxy(request);

  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const cspHeader = `
    frame-src 'self' https://scada.example.com;
    frame-ancestors 'none';
    script-src 'self' 'nonce-${nonce}' 'unsafe-eval';
    connect-src 'self' https://*.supabase.co wss://*.supabase.co;
    object-src 'none';
    base-uri 'self';
    form-action 'self';
  `
    .replace(/\s{2,}/g, ' ')
    .trim();

  response.headers.set('Content-Security-Policy', cspHeader);
  response.headers.set('x-nonce', nonce);

  return response;
}

// Backward-compatible alias for transitional tooling and tests
export const middleware = proxy;
export default proxy;

export const config = {
  // Exclude static assets, API routes, and the Aria assistant overlay (which is
  // proxied to the aria-overlay sidecar and handles its own session checks) from proxy.
  matcher: [
    '/((?!_next/static|_next/image|api/|assistant(?:/|$)|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|avif|gif|ico|woff|woff2|ttf|otf|eot|mp4|webm|mp3|wav)$).*)',
  ],
};
