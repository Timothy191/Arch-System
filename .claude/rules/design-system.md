# Design System

## Theme

**Light-only** (macOS Sonoma visual language). Dark mode does not exist. The Tailwind preset lives in `@repo/theme/tailwind/preset.ts` and does not define a `darkMode` strategy. The root layout hardcodes `data-theme="light"` via an inline `<script>` in `<head>` — do not add theme toggles or dark variants.

## Performance

Icon imports must be scoped (e.g. `import { Drill } from "lucide-react"`, never `import * as Icons from "lucide-react"`). The portal previously shipped a 1.3MB lucide chunk due to unscoped imports. Lazy-load heavy libraries (e.g. `html5-qrcode`) and avoid bundling `framer-motion` in root layouts.

## Colors

OKLCH-based palette exposed as CSS variables (`--arch0`–`--arch15`) and semantic aliases (`bg-primary`, `text-heading`, `accent-blue`, etc.). Reference semantic aliases in components; use primitives only in theme definitions.

## Glass Pattern

Elevated surfaces use `bg-white/70 backdrop-blur-xl border border-black/[0.08]`.

## Shadows

Forbidden raw Tailwind `shadow-sm/md/lg` and raw `box-shadow` CSS. Use named custom tokens only: `shadow-card`, `shadow-window`, `shadow-diffusion-*`.

## Class Merging

Always use `cn()` from `@repo/ui/lib/utils` for conditional class names.

## Typography

Inter + Outfit for UI, JetBrains Mono for tabular data/code.

## Animation

Never animate layout properties (`width`, `height`, `margin`, `padding`, `top`, `left`). Only `opacity`, `transform`, `background-color`, `border-color`, `color`. Use `cubic-bezier(0.16, 1, 0.3, 1)` easing.
