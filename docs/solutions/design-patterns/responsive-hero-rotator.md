---
title: Responsive 2D Mobile Fallback for 3D Components
date: 2026-08-26
category: design-patterns
module: ui
problem_type: design_pattern
component: HeroRotator
severity: low
applies_when:
  - "Building complex 3D or layout-heavy components that degrade poorly on small viewports"
tags: ["responsive-design", "mobile-fallback", "css-snap", "framer-motion"]
---

# Responsive 2D Mobile Fallback for 3D Components

## Context

When building highly interactive 3D components like the `HeroRotator` (which uses Framer Motion for a 3D orbital cylinder effect), the math and layout often fail to scale down gracefully on mobile devices (e.g. viewports `< 768px`), leading to clipping and poor touch ergonomics.

## Guidance

Instead of attempting to scale down complex 3D physics for mobile, implement a structural fallback using native CSS features:

1. Wrap the desktop-only 3D layout in `hidden md:block`.
2. Extract the core card rendering logic (e.g., `HeroCardContent`) to be reusable.
3. Render a secondary mobile-only container with `flex md:hidden overflow-x-auto snap-x snap-mandatory`.
4. Render the extracted card component inside the scroll container, wrapping each card in a `snap-center` wrapper element.

Additionally, to handle ultra-wide command center displays gracefully, cap the entire layout using `max-w-[1920px] mx-auto` on the root body or layout container.

## Why This Matters

- **Ergonomics**: Native horizontal swipe with CSS snap points provides a familiar, highly responsive user experience on mobile.
- **Performance**: Bypassing complex `framer-motion` calculations on lower-end mobile devices saves battery and prevents jank.
- **Maintainability**: Extracting the inner card content prevents logic duplication while decoupling the presentation physics.

## When to Apply

- Creating layout-heavy widgets like carousels, 3D visualizations, or interactive maps.
- The component is usable on desktop but causes viewport clipping, bleeding, or layout shifts on screens smaller than 768px.

## Examples

### 1. Extract the Card Content

```tsx
// Extracted inner content component
function HeroCardContent({ panel, isActive }) {
  return <div className="relative h-full px-5 py-3.5 z-10">{/* Visual content... */}</div>;
}
```

### 2. Implement the Conditional Viewports

```tsx
export function HeroRotator({ panels }) {
  return (
    <div className="w-full">
      {/* Desktop 3D View */}
      <div className="hidden md:block relative w-full h-[500px]">
        {/* 3D physics logic and Framer Motion elements */}
        <HeroSlide panel={panel}>
          <HeroCardContent panel={panel} isActive={true} />
        </HeroSlide>
      </div>

      {/* Mobile 2D Fallback View */}
      <div className="flex md:hidden overflow-x-auto snap-x snap-mandatory gap-4 pb-4 px-4 w-full">
        {panels.map((panel) => (
          <div key={panel.id} className="snap-center shrink-0 w-[85vw] h-full relative rounded-2xl">
            <HeroCardContent panel={panel} isActive={true} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

## Related

- `apps/portal/app/layout.tsx` (Ultra-wide display constraints)
- `packages/ui/src/components/HeroRotator.tsx`
