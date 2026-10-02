# Arch-System Design & UI Architecture

This document tracks the core design philosophy and UI constraints for the Arch-System workspace. It should be referenced by all agents and engineers building components.

## Core Aesthetic
- **Industrial Precision:** Clean lines, subtle lighting, and data-dense but readable layouts.
- **Theme:** OKLCH light-mode design system. Avoid deep dark-mode themes unless explicitly building a dual-mode component.

## Component Toolchain
- **Framework:** Next.js (React 19) + Tailwind CSS.
- **Motion:** Framer Motion for complex gesture-based or layout animations. CSS Transitions for simple micro-interactions.
- **Patterns:** Radix UI primitives where applicable for accessible overlays, dialogs, and popovers.

## "Anti-Slop" Constraints
To maintain a high craft floor and avoid generic "AI-generated" UI artifacts:

1. **No Layout Animation:** `will-change: transform` and `opacity` are the only acceptable animation targets. Layout properties (`width`, `height`, `margin`) must not transition.
2. **Custom Curves:** Use custom `cubic-bezier` curves or Framer springs. `ease-in-out` and `linear` are banned for layout motions.
3. **Physical Interactions:** Interactive elements must have visual feedback (e.g., `active:scale-95`).
4. **Nested Cards:** Avoid generic "card inside a card inside a card" syndrome. Use spacing and typography for hierarchy instead of borders and backgrounds.

## Reference Implementations
- `HeroRotator.tsx`: 3D perspective cover-flow carousel with strict transform/opacity animations, correct hardware acceleration, and dynamic variants.
- `SplitWindowLayout.tsx`: The primary layout shell representing industrial data portal aesthetics.

*Note: Always verify changes via `pnpm agent:verify` and visually check animations in the browser.*
