# ISR with Cache Components

## 1. cacheComponents replaces ISR as the prerendering model

- Source: <https://nextjs.org/docs/app/guides/incremental-static-regeneration-cache-components>
- Rule: `apps/portal` enables `cacheComponents: true` in `next.config.mjs`. Prerendering is done via `'use cache'` + `cacheLife`/`cacheTag`, not the `revalidate` route-segment export. ISR-without-Cache-Components is not used.

## 2. generateStaticParams prerenders known dynamic routes

- Source: <https://nextjs.org/docs/app/guides/incremental-static-regeneration-cache-components>
- Rule: When adopting ISR, use `generateStaticParams()` to define which param values to prerender at build time. Unlisted params serve the App Shell instantly and upgrade on first visit; subsequent visits get the upgraded result from cache.

## 3. Partial Prefetching pairs with ISR App Shells

- Source: <https://nextjs.org/docs/app/guides/incremental-static-regeneration-cache-components>
- Rule: With `partialPrefetching: true`, `await params` sits inside `<Suspense>` so unlisted paths render the App Shell immediately and stream URL-specific content after. Without Partial Prefetching, await `params` outside Suspense so the first request blocks and builds an ISR entry.

## 4. ISR is not used with static export

- Source: <https://nextjs.org/docs/app/guides/incremental-static-regeneration>
- Rule: ISR requires the Node.js server runtime and is not supported under `output: "export"`. `apps/portal` deploys as a Node.js server / standalone output, so ISR is available; static export is not a target.
