---
title: Portal Design System
created: 2026-05-14
updated: 2026-05-16
type: concept
tags: [design, system, convention]
sources:
  [raw/articles/arch-systems-project-overview.md, raw/articles/deepeval-integration-design.md]
confidence: high
---

# Portal Design System

Arch-Systems uses a macOS Sonoma-inspired light-only theme built on Tailwind CSS with custom design tokens. The system is designed for high-contrast visibility and operational clarity, and is enforced via shared components in `@repo/ui` and linted via custom check gates.

## Design Tokens

- **Main background (`color-bg-base`)**: Tinted neutral `oklch(97% 0.001 250)` (`#f5f5f7`).
- **Elevated background (`color-bg-elevated`)**: Pure white `oklch(100% 0 0)` (`#ffffff`) for cards, panels, sidebars.
- **Sunken background (`color-bg-sunken`)**: Soft neutral `oklch(93% 0.002 250)` (`#e8e8ed`) for inputs and code blocks.
- **Borders (`color-border-subtle`)**: Delicate overlay `rgba(0,0,0,0.06)` for dividers.
- **Interactive Accent (`color-action-primary` / `color-border-focus`)**: Deep charcoal / pitch black `oklch(20.5% 0.007 240)` (`#1c1c1e` / `#18181b`).
- **Status Green (`color-status-positive`)**: Mint green `oklch(70% 0.15 160)` (`#10b981`).
- **Status Amber (`color-status-warning`)**: Amber warning indicator `oklch(75% 0.15 65)` (`#f59e0b`).
- **Status Red (`color-status-danger`)**: Danger warning indicator `oklch(55% 0.2 25)` (`#ff3b30`).

## CSS Variable Reference

All variables are defined in `@repo/theme` and consumed via Tailwind:

| Variable                  | OKLCH                    | Hex/RGB Reference  | Usage                           |
| :------------------------ | :----------------------- | :----------------- | :------------------------------ |
| `--color-bg-base`         | `oklch(97% 0.001 250)`   | `#f5f5f7`          | Main page background            |
| `--color-bg-elevated`     | `oklch(100% 0 0)`        | `#ffffff`          | Elevated cards, panels          |
| `--color-bg-sunken`       | `oklch(93% 0.002 250)`   | `#e8e8ed`          | Inset elements, input fields    |
| `--color-border-subtle`   | `oklch(90% 0.003 250)`   | `rgba(0,0,0,0.06)` | Standard dividers               |
| `--color-border-focus`    | `oklch(20.5% 0.007 240)` | `#1c1c1e`          | Focus states, active indicators |
| `--color-text-primary`    | `oklch(25% 0.005 250)`   | `#1d1d1f`          | Headers and active text         |
| `--color-text-secondary`  | `oklch(45% 0.005 250)`   | `#3a3a3c`          | Standard body text              |
| `--color-text-tertiary`   | `oklch(60% 0.005 250)`   | `#6e6e73`          | Captions, placeholders          |
| `--color-action-primary`  | `oklch(20.5% 0.007 240)` | `#1c1c1e`          | Primary CTA, action links       |
| `--color-status-positive` | `oklch(70% 0.15 160)`    | `#10b981`          | Positive/Optimal status dots    |
| `--color-status-warning`  | `oklch(75% 0.15 65)`     | `#f59e0b`          | Caution / pending alerts        |
| `--color-status-danger`   | `oklch(55% 0.2 25)`      | `#ff3b30`          | Critical alarms / errors        |

## Forbidden Patterns

- **No Dark Mode**: Portal is strictly light-mode. Dark mode block is scaffolded but not enabled.
- **No Raw Shadows**: Tailwind's `shadow-sm/md/lg` and raw `box-shadow` styles are forbidden. Use token shadows (`shadow-card`, `shadow-window`, `shadow-diffusion-*`).
- **No Layout Animations**: Never animate layout-forcing parameters (`width`, `height`, `margin`, `padding`). Animate only `opacity` and `transform`.
- **No Unscoped Icon Imports**: Always import Lucide icons as named items (`import { Drill } from "lucide-react"`), never `import * as Icons`.

## Required Patterns

- **Tactile Click Feedback**: All interactive elements must apply click scale transformation: `active: scale-[0.97] transition-transform duration-150 ease-out-expo`.
- **Class Merging**: Always use `cn()` from `@repo/ui/lib/utils` for class merging.
- **Unified Card Component**: Always use `GlassCard` (with `variant` prop for spotlight or glowborder variants instead of legacy separate components).
- **Tabular Figures**: Force `font-variant-numeric: tabular-nums` on monitoring values, timestamps, and tables.

## Login & Authentication Interface

The login interface implements the absolute peak of the system's "Liquid Glass" language:

- **Background Video**: Fixed high-resolution loop (`light-mode/light mode.mp4`) with a 10% dark overlay.
- **Ambient Film Grain**: A noise/grain overlay prevents banding and adds physical texture.
- **macOS Window Card**: A `w-[380px]` container (`.liquid-glass-light`) with macOS-style red/yellow/green header dots and an enterprise footer showing the version tag.
- **Rounded Rectangular Buttons**: Sign-in and SSO actions are styled as rectangular with rounded corners (`rounded-md`) with `tapScale={0.97}`.

## Related

- [[arch-systems]] — the product using this design system
- [[auth-middleware]] — auth proxy rules for role gates
- [[nx-monorepo]] — monorepo structure for UI and Theme packages
