# Global UI Taste & Motion Guidelines

This rule enforces high-end UI/UX, motion physics, and design craft standards across the Arch-System workspace to prevent boilerplate "AI slop" and ensure a polished, production-grade aesthetic. 

These guidelines are inspired by tools like `pbakaus/impeccable`, `Leonxlnx/taste-skill`, and Emil Kowalski's motion standards.

## 1. Motion & Physics
- **Animate only composite properties:** Strictly animate `transform` and `opacity`. **Never** animate `width`, `height`, `margin`, `padding`, `top/left`, or `all`. This ensures hardware acceleration and prevents layout thrashing.
- **Spring Physics over Linear Timing:** Avoid linear easing. Use physical curves (e.g., `cubic-bezier(0.32, 0.72, 0, 1)` or Framer Motion's `spring` with customized stiffness and damping).
- **Asymmetric Durations:** Exit animations should be faster than entrance animations (e.g., `200ms` out vs. `300ms` in).
- **Hardware Acceleration:** Ensure 3D and heavy transforms explicitly declare `will-change: transform`, `transform-style: preserve-3d`, and optionally `backface-visibility: hidden`.

## 2. Visual Hierarchy & Craft
- **Avoid Generic Slop:** Do not default to boilerplate dashboard layouts, uninspired purple gradients, or nested generic cards. 
- **Borders & Shadows:** Use subtle border luminescence (e.g., `border-white/10` or `border-black/[0.06]`) instead of stark borders. Use layered, diffused shadows (like `shadow-[0_20px_40px_-12px_rgba(0,0,0,0.15)]`) instead of hard drop shadows.
- **Glassmorphism:** When using translucent backgrounds (`backdrop-blur-3xl`), combine them with subtle opacities (`bg-white/90`) rather than fully transparent tinted panels that break text contrast.

## 3. Micro-Interactions & State
- **Click Targets:** Inactive 3D or flanking cards must either be non-interactive (`pointer-events-none`) or cleanly capture click-to-activate events without intercepting internal clicks.
- **Focus Rings:** Always provide high-contrast, accessible focus states (`focus-visible:ring-2`, never `outline-none` alone).
- **Sensory Feedback:** Provide scale or opacity feedback on active interactions (e.g., `active:scale-95`).

When modifying UI components, run self-audits to ensure these constraints are met before finalizing the implementation.
