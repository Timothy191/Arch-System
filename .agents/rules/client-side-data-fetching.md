# Client-Side Data Fetching

## 1. TanStack Query is the client data-fetching library standard

- Source: <https://nextjs.org/docs/app/guides/client-side-data-fetching>
- Rule: Client Components that need a shared browser cache use TanStack Query (`useQuery` / `useSuspenseQuery`). SWR is prohibited across `apps/portal`.

## 2. Provide initial data from Server Components

- Source: <https://nextjs.org/docs/app/guides/client-side-data-fetching>
- Rule: When the server knows the initial render need, pass fallback data through the RSC payload (e.g. `<HydrationBoundary>` / query fallback) so the client library continues managing it in the browser; do not duplicate the fetch after hydration.

## 3. Query keys mirror server cache tags

- Source: <https://nextjs.org/docs/app/guides/client-side-data-fetching>
- Rule: TanStack Query key identities and server `cacheTag()` values live in the same canonical contract (`lib/cache-tags.ts`) so mutation invalidation stays coordinated across the server and browser cache layers.

## 4. Mutations invalidate the server cache after the write

- Source: <https://nextjs.org/docs/app/guides/client-side-data-fetching>
- Rule: After a Server Action or Route Handler mutates data, call `updateTag()` / `revalidateTag()` so the next cached server read returns a fresh value; optimistic updates roll back on error.

## 5. Suspense coordinates client loading states

- Source: <https://nextjs.org/docs/app/guides/client-side-data-fetching>
- Rule: Use inline loading states when each component owns its loading UI; wrap shared boundaries in `<Suspense>` to coordinate which parts of the interface reveal together. The data library and component structure determine when requests start.
