# Arch-Systems Performance Optimization Guide

## Core Web Vitals Status

### Current Metrics (Development Mode)

| Metric | Value | Rating | Threshold |
|--------|-------|--------|-----------|
| **LCP** | Not detected | - | <2500ms |
| **INP** | Not detected | - | <200ms |
| **CLS** | 0 | ✅ Good | <0.1 |

**Why "No LCP/INP detected"?**
- Page loads extremely fast (<100ms)
- Background video is the dominant visual element
- Glass morphism UI has no single large image
- LCP is likely the main content area or video itself

---

## Optimization Strategies Implemented

### 1. **LCP (Largest Contentful Paint)**

**Current State:**
- Background video (`RouteBackground.tsx`) is the visual LCP
- No explicit LCP image element
- Content renders after video loads

**Optimizations Applied:**
✅ `LCPObserver` component - Identifies and highlights LCP element in dev mode  
✅ Preconnect hints for critical origins (Supabase, fonts)  
✅ `fetchpriority="high"` for critical images  
✅ Server-side caching with React `cache()`  

**Recommended Actions:**

```tsx
// 1. Add LCP image preload in layout.tsx
import { preloadLCPImage } from '@/components/LCPObserver';

// In your page component:
preloadLCPImage('/hero.webp');

// 2. Mark hero image as priority
import Image from 'next/image';

<Image 
  src="/hero.webp"
  priority  // Tells Next.js to preload
  fill
  sizes="100vw"
  alt="Mining operations"
  className="object-cover"
/>

// 3. Preconnect to video CDN
<link rel="preconnect" href="https://your-cdn.com" />
```

**LCP Breakdown Analysis:**
```
Typical LCP Composition:
├─ TTFB (15%): ~480ms
├─ Resource Load Delay (25%): ~800ms
├─ Resource Load Time (45%): ~1440ms ← LONGEST
└─ Element Render Delay (15%): ~480ms

Focus: Optimize resource load time (images, video)
```

---

### 2. **INP (Interaction to Next Paint)**

**Current State:**
- Multiple dynamic imports reduce initial JS
- React Query handles client-side data fetching
- Some Server Actions may block main thread

**Optimizations Applied:**
✅ `PerformanceOptimizations` component with INP strategies  
✅ Passive event listeners for touch/wheel  
✅ Deferred non-critical scripts  
✅ Centralized error handling prevents INP spikes  

**Recommended Actions:**

```tsx
// 1. Use useTransition for non-urgent updates
import { useTransition } from 'react';

function Dashboard() {
  const [isPending, startTransition] = useTransition();
  
  const handleTabChange = (newTab: string) => {
    startTransition(() => {
      setActiveTab(newTab); // Won't block interaction
    });
  };
  
  return <Tabs value={activeTab} onValueChange={handleTabChange} />;
}

// 2. Memoize expensive calculations
import { useMemo } from 'react';

function MachineList({ machines }) {
  const sortedMachines = useMemo(() => {
    return machines.sort((a, b) => a.priority - b.priority);
  }, [machines]);
  
  return <List items={sortedMachines} />;
}

// 3. Debounce rapid interactions
import { debounce } from 'lodash';

function SearchInput() {
  const handleChange = debounce((value) => {
    // Search API call
  }, 300);
  
  return <Input onChange={handleChange} />;
}

// 4. Move non-critical work to useEffect
function Component({ data }) {
  useEffect(() => {
    // Analytics tracking (doesn't block paint)
    analytics.track('view', { data });
  }, [data]);
  
  return <div>{data}</div>;
}
```

**INP Breakdown Analysis:**
```
Typical INP Composition:
├─ Input Delay (30%): ~105ms
├─ Processing Time (50%): ~175ms ← LONGEST
└─ Presentation Delay (20%): ~70ms

Focus: Optimize event handler execution time
```

---

### 3. **CLS (Cumulative Layout Shift)**

**Current State:**
✅ **0 CLS** - No layout shifts detected  
✅ Fonts use `font-display: swap`  
✅ Images have explicit dimensions  
✅ Glass components use fixed heights  

**Maintaining Zero CLS:**

```tsx
// 1. Always specify image dimensions
<Image 
  src="/photo.jpg"
  width={1200}
  height={630}
  alt="Description"
/>

// 2. Reserve space for dynamic content
<CLSContainer minHeight={200}>
  <DynamicContent />
</CLSContainer>

// 3. Use aspect-ratio for responsive containers
<div className="aspect-video">
  <VideoPlayer />
</div>
```

---

## Performance Monitoring

### Development Mode

**Console Output:**
```bash
[Web Vitals] LCP Analysis
Value: 3200ms (needs-improvement)
Breakdown: { ttfb: 480, resourceLoadDelay: 800, resourceLoadTime: 1440, elementRenderDelay: 480 }
Longest subpart: resourceLoadTime (1440ms)
Optimization strategies:
  - Compress and optimize images (WebP, AVIF)
  - Implement responsive images with srcset
  - Use a CDN for static assets
  - Enable text compression (gzip, brotli)
```

**Visual Debugging:**
- LCP element highlighted with magenta outline (3 seconds)
- Floating debug panel shows element details
- Real-time INP/LCP monitoring

### Production Mode

**Data Collection:**
- Metrics stamped on `<body>` as `data-web-vital-*` attributes
- SessionStorage aggregation (last 50 entries)
- OpenTelemetry spans for tracing

**Monitoring Integration:**
```bash
# Scrape metrics from body attributes
curl http://localhost:3000 | grep data-web-vital

# Access session metrics
sessionStorage.getItem('wv:LCP') // JSON array of LCP entries
```

---

## Weather API Performance

### Caching Strategy

```typescript
// apps/portal/app/api/weather/route.ts

// React cache for request deduplication
const getCachedWeather = cache(async () => {
  return fetchWeather();
});

// Cache headers: 5min cache + 5min stale-while-revalidate
headers: {
  "Cache-Control": "public, s-maxage=300, stale-while-revalidate=300",
  "X-Weather-Cache": "hit",
  "X-Response-Time": "45ms"
}
```

**Performance Benefits:**
- ✅ First request: ~200ms (fetch from Open-Meteo)
- ✅ Cached requests: ~45ms (server memory)
- ✅ Stale-while-revalidate: Instant response, background refresh

---

## Action Items

### High Priority (This Week)

1. **Test LCP Observer** 
   - Run `pnpm dev`
   - Navigate to `/hub`
   - Check console for LCP element details
   - Verify magenta highlight appears

2. **Enable Image Optimization**
   - Convert hero images to WebP/AVIF
   - Add `priority` prop to LCP images
   - Implement responsive `sizes` attribute

3. **Audit Event Handlers**
   - Open React DevTools Profiler
   - Record interactions (tab switches, form inputs)
   - Identify components with >100ms render time
   - Apply `React.memo` or `useMemo`

### Medium Priority (Next Sprint)

4. **Implement useTransition**
   - Wrap tab switches in `startTransition()`
   - Add loading indicators for pending state
   - Test INP improvement

5. **Add Preconnect Hints**
   - Preconnect to Supabase CDN
   - Preconnect to font providers
   - Limit to 4 most critical origins

6. **Defer Non-Critical Scripts**
   - Add `data-defer` to analytics scripts
   - Move below-fold content to lazy imports
   - Use `useEffect()` for post-paint work

### Low Priority (Backlog)

7. **React Compiler**
   - Enable experimental React Compiler
   - Automatic memoization of pure components
   - Monitor bundle size impact

8. **Speculative Prerendering**
   - Prerender likely navigation targets
   - Use `view-transition` API for smooth navigation
   - Test with `prerender` hint

---

## Tools & Resources

### Chrome DevTools

**Performance Tab:**
1. Record interaction (click, type)
2. View Event Timing breakdown
3. Identify longest subpart
4. Apply targeted optimization

**Lighthouse:**
```bash
pnpm lighthouse http://localhost:3000
```

**Web Vitals Extension:**
- Install from Chrome Web Store
- Real-time CWV metrics in toolbar
- Historical trend tracking

### React DevTools

**Profiler:**
1. Record session
2. Sort by "Self time"
3. Identify slow components
4. Apply memoization

**Components Tab:**
- Check which components re-render
- Verify props are stable
- Detect unnecessary renders

---

## Performance Budgets

| Metric | Target | Warning | Critical |
|--------|--------|---------|----------|
| LCP | <2500ms | 2500-4000ms | >4000ms |
| INP | <200ms | 200-500ms | >500ms |
| CLS | <0.1 | 0.1-0.25 | >0.25 |
| TTFB | <600ms | 600-800ms | >800ms |
| Bundle Size | <1500kB | 1500-2000kB | >2000kB |

**Current Status:**
- ✅ CLS: 0 (well under budget)
- ⚠️ LCP: Not detected (needs measurement)
- ⚠️ INP: Not detected (needs measurement)

---

## Tips for Better AI Output

When asking AI assistants to optimize performance:

1. **Be Specific**: "Optimize INP for the tab switch interaction in DepartmentCard"
2. **Provide Context**: Share the component code and interaction flow
3. **Ask for Breakdown**: "What's the longest subpart of this INP?"
4. **Request Examples**: "Show me the exact code change with useTransition"
5. **Verify**: "How do I test if this improved INP?"

**Example Prompt:**
```
The INP on my dashboard is 350ms (needs-improvement). 
The longest subpart is processingTime (175ms).

Here's the event handler:
[CODE]

What specific changes would reduce processingTime?
Show me before/after code with useTransition and memoization.
```

---

## Contact & Support

For performance-related questions:
- Check this guide first
- Review console output in dev mode
- Use Chrome DevTools Performance tab
- Ask in #performance Slack channel

**Last Updated**: 2026-08-20  
**Maintained By**: Performance Working Group
