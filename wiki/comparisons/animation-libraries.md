---
title: Animation Library Comparison
created: 2026-05-15
updated: 2026-05-15
type: comparison
tags: [animation, ui, decision]
sources: [apps/portal/package.json, wiki/concepts/design-system.md, CLAUDE.md]
confidence: medium
---

# Animation Library Comparison: Framer Motion vs React Spring vs GSAP vs CSS-only

## What is Being Compared

Selection of animation approach for a mining operations portal with real-time dashboards, data updates, and motion-rich UI components.

## Dimensions of Comparison

| Dimension             | Framer Motion 12            | React Spring 9        | GSAP 3                   | CSS-only              |
| --------------------- | --------------------------- | --------------------- | ------------------------ | --------------------- |
| **React Integration** | Native (hooks API)          | Native (hooks API)    | Ref-based (useGSAP)      | N/A                   |
| **Bundle Size**       | ~40KB                       | ~30KB                 | ~100KB                   | 0KB                   |
| **Performance**       | Excellent (GPU-accelerated) | Excellent             | Best (most optimized)    | Best (no JS)          |
| **Gesture Support**   | Built-in (drag, pan, hover) | Requires addon        | Draggable plugin         | Limited (:hover only) |
| **Layout Animations** | LayoutGroup (auto)          | useTransition         | Flip plugin              | Impossible            |
| **Server Components** | Requires 'use client'       | Requires 'use client' | Requires 'use client'    | RSC-compatible        |
| **Spring Physics**    | Yes                         | Yes (best-in-class)   | Custom easing            | CSS cubic-bezier      |
| **Scroll Animations** | useScroll, useTransform     | Parallax addon        | ScrollTrigger (superior) | CSS scroll-timeline   |
| **SVG/Morphing**      | Good                        | Good                  | Excellent                | Limited               |
| **Learning Curve**    | Moderate                    | Moderate              | Steep                    | Low                   |

## Project Implementation

The portal uses a **hybrid approach**:

### Primary: Framer Motion / Motion

```typescript
import { motion, AnimatePresence } from 'framer-motion'

// Dashboard card entrance
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.3, ease: 'easeOut' }}
>
  <KPICard {...props} />
</motion.div>

// Real-time alert panel
<AnimatePresence>
  {alerts.map(alert => (
    <motion.div
      key={alert.id}
      initial={{ x: -100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 100, opacity: 0 }}
    >
      <Alert {...alert} />
    </motion.div>
  ))}
</AnimatePresence>
```

### Supporting: CSS Animations

```css
/* tailwindcss-animate for simple effects */
.animate-pulse-slow {
  animation: pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
```

### Advanced: Motion Primitives

Custom components in `components/motion-primitives/`:

- `spotlight.tsx` — Mouse-following spotlight effect
- `glow-effect.tsx` — Ambient glow animations
- `border-trail.tsx` — Animated gradient borders

## Why Framer Motion Was Chosen

1. **React-native API** — Declarative motion components fit React patterns
2. **Layout animations** — Automatic FLIP animations for dashboard rearrangement
3. **Gesture support** — Drag for mobile control room interfaces
4. **AnimatePresence** — Enter/exit animations for real-time data updates
5. **Vercel ecosystem** — Same team as Next.js, well-integrated

## Why Not React Spring

React Spring is excellent but:

- Slightly steeper learning curve for simple transitions
- Smaller community/examples for dashboard patterns
- Both are excellent; Framer Motion's layout animations tipped the decision

## Why Not GSAP

GSAP is the performance king but:

- ~100KB bundle is heavy for this use case
- Ref-based API is less React-idiomatic
- Would require `'use client'` on more components

Reserved for potential future complex data visualization needs.

## Why Not CSS-only

CSS animations are used for:

- Simple hover effects
- Pulse/loading indicators
- `tailwindcss-animate` micro-interactions

But cannot handle:

- Layout transitions (FLIP)
- Gesture-based interactions
- Dynamic enter/exit with `AnimatePresence`
- Coordinated staggered animations

## Verdict

**Framer Motion as primary with CSS animations for simple cases** is optimal for a dashboard with real-time updates and moderate gesture needs. GSAP reserved for future complex visualization requirements.

## Related

- [[design-system]] — Animation guidelines and motion primitives
- [[portal-app-architecture]] — Client component patterns for animations
