# Design Specification: Global White with Silver Tint UI Panel System

## 1. Architectural Overview

The **Globally White with Silver Tint** panel enhancement updates the foundational CSS token layers and component wrappers across `@repo/theme` and `@repo/ui`.

```
┌────────────────────────────────────────────────────────┐
│                   @repo/theme                          │
│                                                        │
│   variables.css        glass.css          cards.css    │
│   (--silver-tint,      (.glass-card,      (.uiverse-   │
│    --silver-border,     .glass-panel,      card)       │
│    --silver-glow)       .glass)                        │
└───────────────────────────┬────────────────────────────┘
                            │ imports / consumes
┌───────────────────────────▼────────────────────────────┐
│                    @repo/ui                            │
│                                                        │
│   Card.tsx             GlassCard.tsx      globals.css  │
│   (white + silver      (silver sheen      (silver-     │
│    tint border)         refraction)        tint utils) │
└────────────────────────────────────────────────────────┘
```

---

## 2. Design Tokens

### CSS Variables (`variables.css` & `glass.css`)

```css
:root {
  /* Silver Tint Palette */
  --silver-tint: #f8fafc;
  --silver-tint-subtle: rgba(241, 245, 249, 0.6);
  --silver-border: rgba(203, 213, 225, 0.5);
  --silver-border-light: rgba(226, 232, 240, 0.6);
  --silver-glow: 0 8px 30px -4px rgba(203, 213, 225, 0.35);
  --silver-border-gradient: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.95) 0%,
    rgba(226, 232, 240, 0.7) 45%,
    rgba(203, 213, 225, 0.4) 100%
  );

  /* White-Silver Glass Panel Surface */
  --panel-bg-white: rgba(255, 255, 255, 0.88);
  --panel-bg-white-hover: rgba(255, 255, 255, 0.96);
  --panel-border-silver: var(--silver-border-light);
  --panel-shadow-silver: var(--silver-glow);
}
```

---

## 3. Component Patterns

- **`Card` Component (`card.tsx`)**:
  Updated base styling to `bg-white/90 backdrop-blur-2xl border border-slate-200/60 shadow-sm shadow-slate-200/50 hover:border-slate-300/80 hover:shadow-md hover:shadow-slate-300/40`.

- **`GlassCard` & Glass Variants (`glassVariants`)**:
  Standardized glass intensity options (`subtle`, `moderate`, `intense`, `glossy`) to use white surface opacity paired with silver border highlight sheen (`rgba(226, 232, 240, 0.6)`).

- **`uiverse-card` (`cards.css`)**:
  Updated background from low-contrast translucency to high-clarity white glass (`rgba(255, 255, 255, 0.88)`) with silver specular border (`rgba(203, 213, 225, 0.4)`).
