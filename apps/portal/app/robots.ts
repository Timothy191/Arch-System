import type { MetadataRoute } from 'next';

/**
 * Arch-System is an authenticated industrial operations portal — SCADA telemetry,
 * employee records, shift closeout, and access-control logs. No route is intended
 * for public crawling, so there is deliberately no `sitemap` entry: there is
 * nothing a crawler should index.
 *
 * Emitting an explicit `Disallow` is not redundant with the `robots` metadata
 * directive and the `X-Robots-Tag` header:
 *   - `X-Robots-Tag` covers static assets and API responses that never render React.
 *   - the metadata directive covers rendered routes.
 *   - this file covers crawlers that probe `/robots.txt` before fetching anything.
 *
 * `server/proxy.ts` already lists `/robots.txt` in `PUBLIC_ROOT_FILES`, so this is
 * served without an auth redirect (a 302-to-login would make the file unreadable).
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        disallow: '/',
      },
    ],
  };
}
