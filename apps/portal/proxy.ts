import type { NextRequest } from 'next/server';
import { normalizeTraceId, parseTraceparentTraceId } from './lib/observability/tracing';
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
  const requestUuid = crypto.randomUUID();
  const nonce = Buffer.from(requestUuid).toString('base64');
  const traceId =
    parseTraceparentTraceId(request.headers.get('traceparent')) ??
    normalizeTraceId(request.headers.get('x-trace-id')) ??
    requestUuid.replace(/-/g, '');
  const requestId =
    request.headers.get('x-request-id')?.trim() ||
    request.headers.get('x-vercel-id')?.trim() ||
    requestUuid;

  request.headers?.set?.('x-nonce', nonce);
  request.headers?.set?.('x-trace-id', traceId);
  request.headers?.set?.('x-request-id', requestId);
  request.headers?.set?.('x-arch-pathname', request.nextUrl.pathname);

  const response = await handleProxy(request);

  let gatewayConnectOrigin = '';
  const rawGatewayUrl =
    process.env.REMOTE_DESKTOP_GATEWAY_URL ?? process.env.NEXT_PUBLIC_REMOTE_DESKTOP_GATEWAY_URL;
  if (rawGatewayUrl) {
    try {
      const parsedGateway = new URL(rawGatewayUrl);
      const httpOrigin = parsedGateway.origin;
      const wsProtocol =
        parsedGateway.protocol === 'https:' || parsedGateway.protocol === 'wss:' ? 'wss:' : 'ws:';
      const wsOrigin = `${wsProtocol}//${parsedGateway.host}`;
      gatewayConnectOrigin =
        httpOrigin === wsOrigin ? ` ${wsOrigin}` : ` ${httpOrigin} ${wsOrigin}`;
    } catch {
      gatewayConnectOrigin = '';
    }
  }

  const isProduction = process.env.NODE_ENV === 'production';
  const scriptSrc = isProduction
    ? "script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com https://challenges.cloudflare.com;"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com https://challenges.cloudflare.com;";
  const frameSrc = isProduction
    ? "frame-src 'self' https://challenges.cloudflare.com https://*.grafana.net https://arch-system-nest-proxy.vercel.app https://n8n-vercel-alpha.vercel.app https://web.whatsapp.com https://*.whatsapp.com https://calendar.google.com https://docs.google.com https://drive.google.com;"
    : "frame-src 'self' http://localhost:* http://127.0.0.1:* https://*.ngrok-free.app https://challenges.cloudflare.com https://*.grafana.net https://arch-system-nest-proxy.vercel.app https://n8n-vercel-alpha.vercel.app https://web.whatsapp.com https://*.whatsapp.com https://calendar.google.com https://docs.google.com https://drive.google.com;";
  const connectSrc = isProduction
    ? `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.supabase.in wss://*.supabase.in https://us.cloud.langfuse.com https://*.r2.cloudflarestorage.com https://*.grafana.net https://api.open-meteo.com https://arch-system-nest-proxy.vercel.app wss://arch-system-nest-proxy.vercel.app https://plantcor-redis-serverless.vercel.app https://n8n-vercel-alpha.vercel.app https://va.vercel-scripts.com https://web.whatsapp.com https://*.whatsapp.com wss://*.whatsapp.com wss://*.web.whatsapp.com${gatewayConnectOrigin};`
    : `connect-src 'self' http://localhost:* ws://localhost:* http://127.0.0.1:* ws://127.0.0.1:* https://*.supabase.co wss://*.supabase.co https://*.supabase.in wss://*.supabase.in https://us.cloud.langfuse.com https://*.r2.cloudflarestorage.com https://*.grafana.net https://api.open-meteo.com https://arch-system-nest-proxy.vercel.app wss://arch-system-nest-proxy.vercel.app https://plantcor-redis-serverless.vercel.app https://n8n-vercel-alpha.vercel.app https://va.vercel-scripts.com https://web.whatsapp.com https://*.whatsapp.com wss://*.whatsapp.com wss://*.web.whatsapp.com${gatewayConnectOrigin};`;

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
  response.headers.set('x-trace-id', traceId);
  response.headers.set('x-request-id', requestId);

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
