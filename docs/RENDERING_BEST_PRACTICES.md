# 🚀 Rendering & Data Strategy Best Practices

This document covers the architectural patterns for rendering, data fetching, and file-based routing in the Arch-Systems portal. It complements the 7 Design Best Practices by ensuring visual design is matched with technical implementation excellence.

---

## 1. Server-Side Rendering (SSR) vs Static Site Generation (SSG) vs Incremental Static Regeneration (ISR)

### 1.1 Decision Matrix

| Content Type                                 | Strategy | When to Use                                          | Performance Profile              | Notes                                                 |
| :------------------------------------------- | :------- | :--------------------------------------------------- | :------------------------------- | :---------------------------------------------------- |
| Real-time dashboards, control-room telemetry | **SSR**  | User-contextual, auth-gated, data changes frequently | Fast FCP + good TTFB             | Use `cacheLife` profiles for server-rendered segments |
| Marketing/reference content                  | **SSG**  | Content that is mostly static                        | Fastest possible LCP             | Pre-rendered at build time, served as static files    |
| Department pages, KPI reports                | **ISR**  | Content that updates hourly/daily                    | Fast static + periodic freshness | `revalidate` between 60s–86400s                       |

### 1.2 SSR

- **When to use**: Dynamic content that changes frequently or depends on user context (auth, permissions, real-time data).
- **How it works**: Server renders the page per request (or cacheable interval) with full HTML, then hydrates with React.
- **Performance**: Higher initial TTFB but better First Contentful Paint (FCP) for dynamic content.
- **SEO**: Excellent — search engines see fully rendered HTML.
- **Data flow**:
  1. Request → Next.js Server Component → Supabase/Redis → Data → HTML response.
  2. Client receives HTML → React hydration → Client-side data fetching (React Query).

### 1.3 SSG

- **When to use**: Content that is mostly static (documentation, reference guides).
- **How it works**: Pages are pre-rendered at build time and served as static files.
- **Performance**: Best LCP — static HTML, no server rendering.
- **Data flow**: Build → Next.js generates static HTML → CDN serves static files. Data captured at build time via `generateStaticParams` or cached `fetch`.

### 1.4 ISR

- **When to use**: Hybrid approach — static pages with periodic revalidation.
- **How it works**: Pages pre-rendered and served statically, but regenerated on demand or on a schedule.
- **Performance**: Fast static delivery with fresh content.

### 1.5 Hybrid Usage in Arch Portal

The portal uses a hybrid pattern:

- **SSR**: Dashboards, control room, real-time telemetry (needs fresh data).
- **SSG**: Documentation pages, reference guides, static marketing content.
- **ISR**: Department pages, KPI reports (update daily/hourly).

---

## 2. File-Based Routing (Next.js 16 App Router)

Next.js 16 App Router uses file-based routing by default — the file system is the route map.

### 2.1 Routing Structure

- **Pages directory**: `app/` contains all route segments.
- **Segmented routing**: `app/hub/page.tsx` → `app/hub/departments/` → `app/hub/departments/drilling/`.
- **Dynamic segments**: `[departmentId]/`, `[jobId]/` use square brackets.
- **Layouts**: `app/layout.tsx` (root), `app/hub/layout.tsx` (hub-specific).

### 2.2 Best Practices

- **Use descriptive filenames**: `app/hub/page.tsx` > `app/page.tsx`.
- **Group related routes**: `/app/hub/` for hub content, `/app/api/` for API routes.
- **Avoid deep nesting**: Keep route depth ≤ 3 segments for maintainability.
- **Use `generateStaticParams`** for dynamic routes that need SSG:
  ```tsx
  // app/hub/departments/[departmentId]/page.tsx
  export async function generateStaticParams() {
    const depts = await getDepartments();
    return depts.map((dept) => ({ departmentId: dept.id }));
  }
  ```

### 2.3 Performance Considerations

- **Route-level code splitting**: Use dynamic imports for large components.
- **Suspense**: Use React 19 `<Suspense>` for data-fetching components.
- **Cache control**: Use `cacheLife` profiles for data-fetching routes.

---

## 3. API Routes with Fallback Patterns

The portal uses a systematic approach to API routes with fallback mechanisms for resilience.

### 3.1 Fallback Patterns

#### Pattern A: Tiered Fallback (Most Common)

- **Primary service**: Preferred API (e.g., Groq).
- **Secondary service**: Fallback API (e.g., OpenRouter).
- **Fallback response**: Generic error message if all services fail.
- **Example**: `apps/portal/app/api/ai/operations-copilot/route.ts` (Groq → OpenRouter).

#### Pattern B: Graceful Degradation

- **Strategy**: Use simplified responses when primary service is unavailable.
- **Example**: Health check routes return minimal data when primary service is degraded.

#### Pattern C: Circuit Breaker

- **Implementation**: Track service health and disable endpoints temporarily during outages.
- **Tools**: Custom middleware or service health checks.

### 3.2 API Response Structure

All API routes follow this structure:

```json
{
  "status": "healthy" | "degraded" | "unhealthy",
  "timestamp": "ISO string",
  "latencyMs": 123,
  "services": {
    "[serviceName]": {
      "status": "healthy" | "degraded" | "unhealthy",
      "latencyMs": 45,
      "...optional error": "string"
    }
  }
}
```

### 3.3 Error Handling

- Use the `AppError` hierarchy from `@repo/errors` for standardized errors.
- Use machine-readable error codes for automation (e.g., `API_ERROR`, `TIMEOUT`).
- Use clear, concise messages for end users.

---

## 4. Built-in Image Optimization

The portal uses Next.js's built-in image optimization system with a conservative approach to avoid Vercel transformation costs.

### 4.1 Image Optimization Strategy

| Component        | Strategy                                             | Rationale                                                                 |
| :--------------- | :--------------------------------------------------- | :------------------------------------------------------------------------ |
| Hero images      | Pre-generated AVIF/WebP with `sharp` at build time   | Avoid Vercel transformation costs, ensure consistent quality              |
| Content images   | `next/image` with `unoptimized: true` (Vercel layer) | Prevents per-request transformation billing; relies on pre-built variants |
| Remote images    | `remotePatterns` in `next.config.mjs`                | Allows CDN-based optimization without Vercel charges                      |
| Format support   | AVIF, WebP, JPEG, PNG                                | Modern formats for better compression and quality                         |
| Quality settings | `qualities: [75]`                                    | Balances quality and file size                                            |

### 4.2 Image Optimization Configuration

```js
// apps/portal/next.config.mjs
images: {
  unoptimized: true, // OFF at Vercel layer - no runtime optimization
  formats: ['image/avif', 'image/webp'],
  minimumCacheTTL: 14400,
  qualities: [75],
  dangerouslyAllowSVG: true,
  contentDispositionType: 'attachment',
  contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  localPatterns: [
    { pathname: '/images/**', search: '' },
    { pathname: '/background/**', search: '' },
    { pathname: '/error-pages/**', search: '' },
    { pathname: '/icons/**', search: '' },
    { pathname: '/logo.svg', search: '' },
    { pathname: '/whatsapp-logo.jpeg', search: '' },
  ],
  remotePatterns: [
    { protocol: 'https', hostname: '*.supabase.co' },
    { protocol: 'https', hostname: '*.supabase.in' },
    { protocol: 'https', hostname: 'res.cloudinary.com' },
    { protocol: 'https', hostname: '*.whatsapp.net' },
    { protocol: 'https', hostname: '*.whatsapp.com' },
  ],
},
```

### 4.3 Image Optimization Implementation

1. **Pre-generation**: Use `sharp` scripts in build pipeline to generate AVIF/WebP variants.
2. **Configuration**: `next.config.mjs` with `unoptimized: true` and appropriate patterns.
3. **Component usage**: Use `next/image` with appropriate `src`, `width`, and `height`.

### 4.4 Performance Metrics

- **Target LCP**: < 2.5s (preferably < 1.5s).
- **Image size**: < 500KB for hero images, < 200KB for content images.
- **Format**: AVIF preferred, WebP fallback.

---

## 5. Verification & Testing

### 5.1 Testing Strategy

- **SSR/SSG**: Use Playwright to verify initial HTML content; Lighthouse for LCP.
- **ISR**: Simulate build triggers and verify content updates.
- **File routing**: Test deep nesting with Playwright navigation.
- **API fallbacks**: Mock service failures to verify fallback behavior.
- **Image optimization**: Confirm optimized images exist in build output.

### 5.2 Testing Checklist

- [ ] All dynamic routes have `generateStaticParams` where appropriate.
- [ ] SSR routes use appropriate `cacheLife` profiles.
- [ ] API routes have fallback mechanisms implemented.
- [ ] Image optimization is pre-generated for all hero content.
- [ ] File-based routing follows logical grouping.

---

## 6. Migration Guide

### 6.1 From Pages Router to App Router

- **Pages Router**: `/pages/` directory, `getServerSideProps`, `getStaticProps`.
- **App Router**: `app/` directory, Server Components by default, `use client` for interactivity.

### 6.2 Migration Steps

1. Move pages from `/pages/` to `/app/`.
2. Replace `getServerSideProps` with Server Components.
3. Replace `getStaticProps` with `generateStaticParams` or cached `fetch`.
4. Add `layout.tsx` files for nested layouts.
5. Update imports from `next/navigation` to `next/app`.

### 6.3 Common Pitfalls

- ❌ Using `use client` in server components.
- ❌ Mixing client and server components in same route.
- ❌ Using `getServerSideProps` in App Router (replaced by Server Components).
- ❌ Not using `generateStaticParams` for dynamic routes.

---

## 7. Implementation Checklist

### 7.1 Rendering & Data

- [ ] SSR routes use `cacheLife` profiles.
- [ ] SSG/ISR routes use `generateStaticParams` or cached fetches.
- [ ] File-based routing follows logical grouping.
- [ ] API routes have fallback mechanisms.

### 7.2 Performance

- [ ] Image optimization pre-generated with `sharp`.
- [ ] `unoptimized: true` set in `next.config.mjs`.
- [ ] Responsive images with `srcSet` and `sizes`.

### 7.3 Verification

- [ ] Type-check passes.
- [ ] Lint passes.
- [ ] Policy checks pass.

---

## 8. Final Notes

The portal's rendering strategy balances performance, cost, and reliability. SSR is used where data is dynamic, SSG/ISR for static content, and image optimization is pre-generated to avoid runtime transformation costs.

**Key References**:

- `apps/portal/next.config.mjs` — Next.js configuration (images, cacheLife, cacheComponents).
- `apps/portal/lib/server-cache.ts` — Server cache profiles and invalidation.
- `packages/theme/README.md` — Design tokens and quality gates.
- `docs/DESIGN.md` — Design system and best practices.
- `docs/UX_Design_Rules.md` — UX laws and principles.
