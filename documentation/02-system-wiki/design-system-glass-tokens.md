# Design System: Frosted Glass & Volumetric Tokens

This document serves as the living architecture reference for the frosted glass and volumetric surface tokens across the Arch-Systems Mining Operations Portal.

## Architectural Principles

1. **Frosted Translucency Over Solid Blocks**:
   - Surfaces render with `backdrop-filter: blur(20px) saturate(140%)` and a 75% white base fill (`rgba(255, 255, 255, 0.75)`).
   - This allows the underlying operational wallpaper to subtly refract through containers while maintaining WCAG AAA/AA text legibility.

2. **Specular Rim Lighting & Bevels**:
   - Glass cards and form controls incorporate a dual-edge lighting model:
     - **Top Specular Edge**: `inset 0 1px 0 0 rgba(255, 255, 255, 0.8)` mimics overhead industrial lighting hitting the physical bevel.
     - **Subtle Gradient Border**: `linear-gradient(135deg, rgba(255, 255, 255, 0.65) 0%, rgba(255, 255, 255, 0.2) 40%, rgba(180, 195, 220, 0.15) 100%)` creates cool, crisp edge definition.

3. **Volumetric Ambient Occlusion**:
   - Shadows avoid harsh black drop shadows and instead use layered micro-diffusion:
     - `shadow-glass-depth`: `0 4px 20px -2px rgba(15, 23, 42, 0.05), 0 2px 6px -1px rgba(0, 0, 0, 0.03)`
     - `shadow-glass-depth-hover`: `0 10px 30px -4px rgba(15, 23, 42, 0.08), 0 4px 12px -2px rgba(0, 0, 0, 0.04)`

4. **Negative Constraints (Strict Anti-Patterns)**:
   - **No low contrast**: Text tokens (`var(--text-heading)`, `var(--text-body)`) are strictly high contrast.
   - **No harsh shadows**: Multi-stop soft RGBA ambient diffusion only.
   - **No neon saturation**: Functional accents remain <= 10% of surface area.
   - **No layout clutter**: Minimalist composition with a strict 4px grid spacing system.

## Component Token Usage

| Component | Class / Token Formula | Purpose |
| :--- | :--- | :--- |
| `<Card />` | `border border-white/50 bg-white/75 backdrop-blur-2xl text-card-foreground shadow-glass-depth glass-depth-card` | Base container for all operational dashboards, charts, and metrics grids. |
| `<Input />` | `bg-white/60 backdrop-blur-md border border-white/60 shadow-[inset_0_1px_2px_rgba(0,0,0,0.03),inset_0_-0.5px_0_rgba(255,255,255,0.7)]` | Standard form fields, shift inputs, telemetry search boxes. |
| `<FormFields />` | `bg-white/60 backdrop-blur-md border border-white/60 focus:bg-white/80 focus:border-[var(--accent-blue)]` | Reusable form components with integrated validation states. |
| `<GlassCard />` | `glassVariants: subtle \| moderate \| intense \| glossy` | Configurable Framer Motion glass cards with spotlight, glow, and liquid variants. |
