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
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  request.headers?.set?.('x-nonce', nonce);

  const response = await handleProxy(request);

  const isProduction = process.env.NODE_ENV === 'production';
  const scriptSrc = isProduction
    ? "script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com;"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com;";
  const frameSrc = isProduction
    ? "frame-src 'self' https://scada.example.com https://arch-system-nest-proxy.vercel.app https://n8n-vercel-alpha.vercel.app https://web.whatsapp.com https://*.whatsapp.com https://calendar.google.com https://docs.google.com https://drive.google.com;"
    : "frame-src 'self' http://localhost:* http://127.0.0.1:* https://scada.example.com https://arch-system-nest-proxy.vercel.app https://n8n-vercel-alpha.vercel.app https://web.whatsapp.com https://*.whatsapp.com https://calendar.google.com https://docs.google.com https://drive.google.com;";
  const connectSrc = isProduction
    ? "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.open-meteo.com https://arch-system-nest-proxy.vercel.app wss://arch-system-nest-proxy.vercel.app https://plantcor-redis-serverless.vercel.app https://n8n-vercel-alpha.vercel.app https://va.vercel-scripts.com https://web.whatsapp.com https://*.whatsapp.com wss://*.whatsapp.com;"
    : "connect-src 'self' http://localhost:* ws://localhost:* http://127.0.0.1:* ws://127.0.0.1:* https://*.supabase.co wss://*.supabase.co https://api.open-meteo.com https://arch-system-nest-proxy.vercel.app wss://arch-system-nest-proxy.vercel.app https://plantcor-redis-serverless.vercel.app https://n8n-vercel-alpha.vercel.app https://va.vercel-scripts.com https://web.whatsapp.com https://*.whatsapp.com wss://*.whatsapp.com;";

  const cspHeader = `
    default-src 'self';
    ${frameSrc}
    frame-ancestors 'none';
    ${scriptSrc}
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: blob: https://*.supabase.co https://*.supabase.in https://*.whatsapp.net https://*.whatsapp.com https://res.cloudinary.com;
    media-src 'self' data: blob: https://res.cloudinary.com;
    ${connectSrc}
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
  // Exclude static assets, API routes, Vercel telemetry, and SEO files from proxy.
  matcher: [
    '/((?!_next/static|_next/image|_vercel|api/|.well-known/workflow/|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|webp|avif|gif|ico|woff|woff2|ttf|otf|eot|mp4|webm|mp3|wav)$).*)',
  ],
};
