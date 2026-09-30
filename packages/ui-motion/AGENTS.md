# @repo/ui-motion - Agent Guidelines

## Scope & Purpose

**Motion and animation utilities package**. This package contains:
- Animated component wrappers
- Motion hooks and utilities
- Complex animation sequences
- Industrial-grade animation presets for mining operations UI

## Architectural Invariants

### Hard Boundaries
- **NO** direct database access
- **NO** domain-specific business logic
- **Pure animation and motion utilities only**
- **Must work in SSR environments** (use `useEffect` guards)

### Motion Standards
- **Must** use Framer Motion as the primary animation library
- **Must** respect `prefers-reduced-motion` media query
- **Must** have configurable animation durations and easing
- **Must NOT** use CSS transitions for complex animations

### Dependencies
- **Allowed**: `@repo/theme`, `@repo/ui-primitives`, `framer-motion`
- **Prohibited**: Any animation library other than Framer Motion
- **Prohibited**: Any application or feature packages

## Component Classification

### Animated Components
- AnimatedButton
- AnimatedDialog
- AnimatedList
- AnimatedNumber
- AnimatedGridPattern
- RevealLoader
- Loader
- LoadingDots
- ShineBorder
- Marquee

### Motion Hooks
- useAnimate
- useScroll
- useTransform
- useMotionValue
- Custom industrial-specific hooks

### Animation Presets
- Fade animations
- Slide animations
- Scale animations
- Bounce animations
- Industrial-specific animations (for mining equipment telemetry)

### Motion Utilities
- Easing presets
- Duration presets
- Spring configurations
- Variant definitions

## Performance Rules

### SSR Safety
```typescript
// WRONG - Will cause hydration errors
const AnimatedComponent = () => {
  const controls = useAnimation();
  // ...
};

// CORRECT - Guard with useEffect
const AnimatedComponent = () => {
  const controls = useAnimation();
  
  useEffect(() => {
    controls.start({ ... });
  }, [controls]);
  
  return <motion.div animate={controls}>...</motion.div>;
};
```

### Reduced Motion Support
```typescript
const useReducedMotion = () => {
  const [prefersReducedMotion] = useMediaQuery('(prefers-reduced-motion: reduce)');
  return prefersReducedMotion;
};

// Always check for reduced motion
const AnimatedComponent = ({ children }) => {
  const reducedMotion = useReducedMotion();
  
  if (reducedMotion) {
    return <>{children}</>;
  }
  
  return <motion.div animate={{ ... }}>{children}</motion.div>;
};
```

## Public API

All motion utilities must be exported through `src/index.ts`.

## Testing

- Test that animations don't break SSR
- Test that reduced motion preference is respected
- Test animation performance (no layout thrashing)
- Visual regression tests for animated components
