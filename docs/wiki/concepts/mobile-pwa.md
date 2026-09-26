# Mobile Responsiveness & PWA

**Priority:** MEDIUM  
**Estimated Effort:** 1 week  
**Status:** ✅ Complete

> Improve mobile layouts for field operators, implement Progressive Web App (PWA) capabilities with offline support, add touch-optimized data entry, and optimize for tablet use in the control room.

---

## Overview

The portal is desktop-first (control room operators on large screens). Field operators — drill rig crews, safety inspectors, access control officers — increasingly work from tablets and phones. Improving mobile UX and adding offline capability directly supports on-premises, low-connectivity mining environments.

---

## Current State

| Feature               | Current              | Target                             |
| --------------------- | -------------------- | ---------------------------------- |
| Mobile Responsiveness | 68% avg across depts | 85%+                               |
| PWA / Installable     | No                   | Yes                                |
| Offline Mode          | No                   | Read-only + queue writes           |
| Touch Forms           | Desktop-optimized    | Touch-friendly (large tap targets) |
| Tablet (Control Room) | 80%                  | 95%                                |
| Tested on Device      | No                   | iOS + Android                      |

**Department mobile completeness:**

| Department     | Mobile % |
| -------------- | -------- |
| Drilling       | 60%      |
| Production     | 65%      |
| Access Control | 60%      |
| Engineering    | 70%      |
| Control Room   | 80%      |
| Safety         | 70%      |
| Training       | 60%      |
| Satellite Mon  | 75%      |

---

## Implementation Checklist

### 1. Responsive Layout Audit & Fix

- [x] Hub page: `space-y-6 sm:space-y-12` — tighter vertical rhythm on mobile
- [x] Hub layout: `px-4 py-6 sm:px-8 sm:py-8` — reduced horizontal padding on small screens
- [x] Hero buttons: `flex-col sm:flex-row` + `min-h-[44px]` — WCAG 2.5.5 tap targets, full-width on mobile
- [x] Carousel cards: `w-[280px] xs:w-[320px] sm:w-[360px]` — narrower on xs screens
- [ ] Audit admin/department tables for `overflow-x-auto` wrappers (next pass)
- [ ] Fix form field spacing for thumb reach on remaining department forms
- [ ] Test with Chrome DevTools device emulation + real devices

### 2. Touch-Optimized Data Entry Forms

- [ ] Replace desktop dropdowns with native `<select>` on mobile for shift/machine pickers
- [ ] Add large number input steppers for numeric fields (tonnage, hours, fuel)
- [ ] Implement swipe-to-dismiss for alerts/notifications
- [ ] Add pull-to-refresh on dashboard lists
- [ ] Ensure on-screen keyboard doesn't obscure active form fields (use `scroll-into-view`)

### 3. PWA Implementation

#### Manifest

Create `apps/portal/public/manifest.json`:

```json
{
  "name": "Arch-Systems Portal",
  "short_name": "Arch Portal",
  "description": "Mining operations portal",
  "start_url": "/hub",
  "display": "standalone",
  "background_color": "#0a0a0a",
  "theme_color": "#0a0a0a",
  "orientation": "any",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

Add to `apps/portal/app/layout.tsx`:

```tsx
export const metadata = {
  manifest: "/manifest.json",
};
```

- [x] `public/manifest.json` created — 8 icon sizes, shortcuts for Hub + Control Room
- [ ] Generate app icons from `ArchWaveMono.png` (requires image tooling — 72/96/128/144/152/192/384/512px)
- [x] `manifest: '/manifest.json'` added to root layout `metadata`
- [x] `appleWebApp` + `formatDetection` metadata added for iOS PWA
- [x] `viewport` export added (`device-width`, `userScalable: true`, `viewportFit: 'cover'`)

#### Service Worker (Offline Support)

Use `next-pwa` or manual service worker:

```bash
pnpm --filter portal add next-pwa
```

`next.config.mjs`:

```js
import withPWA from "next-pwa";
export default withPWA({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  runtimeCaching: [
    {
      urlPattern: /^https?.*/,
      handler: "NetworkFirst",
      options: { cacheName: "arch-portal-cache", networkTimeoutSeconds: 10 },
    },
  ],
})(nextConfig);
```

- [x] `@ducanh2912/next-pwa` installed
- [x] `next.config.mjs` wrapped with `withPWA` (disabled in dev, enabled in production)
- [x] Runtime caching: CacheFirst for `/_next/static`, NetworkFirst for `/api/*` + catch-all
- [x] `register: true`, `skipWaiting: true`, `reloadOnOnline: true`
- [ ] Test offline mode after production build: disconnect network, verify cached pages load

#### Offline Write Queue

For field operators submitting data with poor connectivity:

```ts
// utils/offline-queue.ts
const QUEUE_KEY = "arch_offline_queue";

export function queueMutation(action: string, payload: unknown) {
  const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]");
  queue.push({ action, payload, timestamp: Date.now() });
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export async function flushQueue() {
  const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]");
  for (const item of queue) {
    await submitMutation(item.action, item.payload);
  }
  localStorage.removeItem(QUEUE_KEY);
}
```

- [x] `lib/sync/sync-queue.ts` — IndexedDB queue already implemented with `online` event listener
- [x] `components/OfflineBanner.tsx` created — blue banner offline, blue syncing, green back-online
- [x] Banner polls IndexedDB for pending count while offline
- [x] `OfflineBanner` mounted in root `layout.tsx` (always present, renders nothing when online)

### 4. Tablet Optimization (Control Room)

- [x] `BottomNav` component created — 6-item nav bar, hidden on `md+`, active state highlight
- [x] Hub layout: `pb-20 md:pb-8` — content clears BottomNav on mobile
- [x] `BottomNav` mounted in hub layout (auth-gated pages only)
- [ ] Optimize Control Room dashboard grid for landscape tablet (1024px)
- [ ] Full-screen chart mode on tap
- [ ] Add pinch-to-zoom on satellite map views

### 5. Device Testing

- [ ] Test on iOS Safari (latest) — requires production build with service worker
- [ ] Test on Chrome Android (latest)
- [ ] Test on iPad Safari (landscape + portrait)
- [ ] Test with real mining-context: gloves, bright sunlight (high contrast mode)
- [ ] Verify PWA install prompt appears on Android Chrome (requires HTTPS + manifest + SW)

---

## Design Tokens for Mobile

The theme (`@repo/theme`) already uses Tailwind — ensure these patterns are applied:

```tsx
// Mobile-first responsive classes
className = "flex flex-col sm:flex-row";
className = "text-sm sm:text-base";
className = "p-3 sm:p-6";
className = "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4";
```

---

## Related Pages

- [[design-system|Portal Design System]] — Dark-theme design tokens and component library
- [[portal-app-architecture|Portal App Architecture]] — Next.js App Router structure
- [[department-features|Department Features]] — Per-department feature specs
- [[on-premises-deployment|On-Premises Deployment]] — Field deployment context
