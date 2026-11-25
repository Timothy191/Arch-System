import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.NODE_ENV,
  beforeSend(event) {
    // Edge requests reach the same routes as the Node runtime; apply the same
    // credential scrubbing before events leave the platform.
    if (event.request?.headers) {
      const scrubbed = new Set(['authorization', 'cookie', 'x-internal-secret']);
      for (const key of Object.keys(event.request.headers)) {
        if (scrubbed.has(key.toLowerCase())) {
          event.request.headers[key] = '[redacted]';
        }
      }
    }
    return event;
  },
});
