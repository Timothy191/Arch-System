import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');

  // Basic CSP following PR-2 goals.
  // 'report-only' usually goes in Content-Security-Policy-Report-Only,
  // but we enforce strict frame rules directly here.
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

  const response = NextResponse.next();

  response.headers.set('Content-Security-Policy', cspHeader);
  response.headers.set('x-nonce', nonce);

  return response;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
