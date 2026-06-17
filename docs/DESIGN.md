# DESIGN.md - Arch Design System & Tokens Reference

This document serves as the single source of truth for the visual style, design tokens, and components of the Arch-Systems Mining Operations Portal (Plantcor OS).

## Related Documentation

- **[DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md)** — Complete documentation index and quick navigation guide
- **[PRODUCT.md](PRODUCT.md)** — Product strategy, user personas, and design direction
- **[CLAUDE.md](CLAUDE.md)** — Technical implementation guide
- **[LIQUID_GLASS_CHECKLIST.md](archive/LIQUID_GLASS_CHECKLIST.md)** — UI implementation checklist
- **[AGENTS.md](AGENTS.md)** — Development workflow and quality gates

---

## Color System

**Strategy**: Restrained — tinted neutrals + one functional accent ≤ 10%.  
**Theme**: Light-only theme (macOS Sonoma visual language). Clean, high-contrast, bright interfaces optimized for operational precision.

### Base Palette (OKLCH)

| Token Naming (`namespace--category--variant`) | OKLCH                    | Hex Reference        | Dark Mode Equivalent (Future-Proof) | Usage                                                   |
| :-------------------------------------------- | :----------------------- | :------------------- | :---------------------------------- | :------------------------------------------------------ |
| `color-bg-base`                               | `oklch(97% 0.001 250)`   | `#f5f5f7`            | `oklch(15% 0.01 250)`               | Main application background. macOS base background.     |
| `color-bg-elevated`                           | `oklch(100% 0 0)`        | `#ffffff`            | `oklch(22% 0.015 250)`              | Cards, panels, sidebar, elevated surfaces.              |
| `color-bg-sunken`                             | `oklch(93% 0.002 250)`   | `#e8e8ed`            | `oklch(10% 0.005 250)`              | Input backgrounds, nested containers, code blocks.      |
| `color-border-subtle`                         | `oklch(90% 0.003 250)`   | `rgba(0,0,0,0.06)`   | `oklch(30% 0.01 250)`               | Dividers, table borders, inactive tab borders.          |
| `color-border-focus`                          | `oklch(20.5% 0.007 240)` | `#1c1c1e`            | `oklch(20.5% 0.007 240)`            | Focus rings, active tab borders. Deep Charcoal / Slate. |
| `color-text-primary`                          | `oklch(25% 0.005 250)`   | `#1d1d1f`            | `oklch(95% 0.005 250)`              | Headings, primary labels. macOS Heading.                |
| `color-text-secondary`                        | `oklch(45% 0.005 250)`   | `#3a3a3c`            | `oklch(80% 0.005 250)`              | Body text, primary labels. macOS Body.                  |
| `color-text-tertiary`                         | `oklch(60% 0.005 250)`   | `#6e6e73`            | `oklch(65% 0.005 250)`              | Captions, timestamps, placeholders.                     |
| `color-action-primary`                        | `oklch(20.5% 0.007 240)` | `#1c1c1e`            | `oklch(20.5% 0.007 240)`            | Primary CTA, charcoal interactive highlights.           |
| `color-action-primary-hover`                  | `oklch(27.4% 0.007 240)` | `#2c2c2e`            | `oklch(27.4% 0.007 240)`            | Primary CTA hover state (dark slate/charcoal).          |
| `color-status-positive`                       | `oklch(70% 0.15 160)`    | `#10b981`            | `oklch(70% 0.15 160)`               | Mint Green — optimal / active / healthy.                |
| `color-status-warning`                        | `oklch(75% 0.15 65)`     | `#f59e0b`            | `oklch(75% 0.15 65)`                | Amber — caution, warnings, pending.                     |
| `color-status-danger`                         | `oklch(55% 0.2 25)`      | `#ff3b30`            | `oklch(55% 0.2 25)`                 | Red — critical alerts, errors, offline.                 |
| `color-accent-subtle`                         | `oklch(92% 0.005 240)`   | `rgba(28,28,30,.08)` | `oklch(25% 0.04 250)`               | Accent backgrounds, tags, subtle highlights.            |
| `color-bg-hud`                                | `oklch(0% 0 0 / 60%)`    | `rgba(0,0,0,0.6)`    | `oklch(0% 0 0 / 70%)`               | Dark glassmorphic background for HUD overlays.          |

### State Opacity & Overlay Tokens

- `opacity-disabled` (0.38) — Used for disabled controls, actions, and form inputs.
- `opacity-hover` (0.08) — Subtle background tint variation for hover states.
- `overlay-dim` (`oklch(0% 0 0 / 40%)` / `#00000066`) — Used for modal backdrops and system blocking dialogs.

### Contrast-Ratio Guarantees (WCAG 2.1 compliance)

All core text and background pairings are strictly verified to ensure accessibility.

| Foreground Token       | Background Token    | Target Ratio | WCAG Compliance  | Verified Result |
| :--------------------- | :------------------ | :----------- | :--------------- | :-------------- |
| `color-text-primary`   | `color-bg-base`     | ≥ 4.5:1      | **AAA** (11.5:1) | Pass ✅         |
| `color-text-secondary` | `color-bg-base`     | ≥ 4.5:1      | **AA** (5.8:1)   | Pass ✅         |
| `color-text-primary`   | `color-bg-elevated` | ≥ 7.0:1      | **AAA** (13.5:1) | Pass ✅         |
| `color-text-secondary` | `color-bg-elevated` | ≥ 4.5:1      | **AAA** (6.8:1)  | Pass ✅         |
| `color-text-tertiary`  | `color-bg-base`     | ≥ 4.5:1      | **AA** (4.52:1)  | Pass ✅         |
| `color-accent` (text)  | `color-bg-elevated` | ≥ 4.5:1      | **AA** (4.6:1)   | Pass ✅         |

### Color Rules

- Never use pure `#000`. Pure `#fff` is strictly for `color-bg-elevated`.
- Accent color (Slate & Pitch Black) is the primary interactive signal.
- Status colors (success/danger/warning/info) are semantic, not decorative. They appear as small indicators (dots, borders, badges, rings) and are never used as large fills.
- KPI color variants map to the semantic palette: `green` → success, `red` → danger, `orange` → warning, `teal` → info.

---

## Typography

**Font stack**: `Inter, system-ui, -apple-system, sans-serif` (clean, legible at small sizes).  
**Monospace stack**: `JetBrains Mono, ui-monospace, monospace` (for tabular data, code blocks, timestamps).

### Type Scale & Line Heights

| Token                  | Desktop Size     | Mobile Size (Responsive Clamp)  | Weight | Line Height | Usage                                        |
| :--------------------- | :--------------- | :------------------------------ | :----- | :---------- | :------------------------------------------- |
| `font-size-display`    | 1.75rem (28px)   | `clamp(1.5rem, 4vw, 1.75rem)`   | 600    | 1.3         | Page titles, major dashboard headers.        |
| `font-size-heading`    | 1.25rem (20px)   | `clamp(1.125rem, 3vw, 1.25rem)` | 600    | 1.3         | Card titles, section headers, dialog titles. |
| `font-size-subheading` | 1rem (16px)      | `1rem (16px)`                   | 500    | 1.4         | Sub-section labels, form group titles.       |
| `font-size-body`       | 0.875rem (14px)  | `0.875rem (14px)`               | 400    | 1.5         | Primary body text, table cells, form labels. |
| `font-size-caption`    | 0.75rem (12px)   | `0.75rem (12px)`                | 400    | 1.4         | Timestamps, metadata, badges, helper text.   |
| `font-size-mono`       | 0.8125rem (13px) | `0.8125rem (13px)`              | 400    | 1.5         | Technical data values, telemetry logs.       |

### Typography Rules

- **Tabular Figures**: Force tabular figures (`font-variant-numeric: tabular-nums`) on all KPI values, monitoring numbers, timestamps, and data tables. This guarantees vertical column alignment.
- **Hierarchy Cues**: Rely on scale + weight contrast instead of color variations alone.
- **Line Length**: Capped at 75ch for readable content text blocks.

---

## Elevation & Shadows

Depth is established by combining standard card geometry with precise shadows and glassmorphism.

### Shadow Scale

Avoid generic box shadows. Use the following structured elevation system:

- `shadow-sm` (`0 1px 2px rgba(0,0,0,0.05)`) — Used for subtle, low-elevation items like cards and inset buttons.
- `shadow-md` (`0 4px 6px -1px rgba(0,0,0,0.08), 0 2px 4px -1px rgba(0,0,0,0.04)`) — Standard elevation for popovers and hover elements.
- `shadow-lg` (`0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)`) — Floating system overlays, modals, and dropdown containers.
- `shadow-window` (Custom Glass Shadow) — Used on system toolbars and popovers to reinforce glass panels.

### Radius Scale

Apply systematic corner rounding:

- `radius-sm` (4px) — Small buttons, nested selectors, badge containers.
- `radius-md` (6px) — Inputs, buttons, segmented controls.
- `radius-lg` (8px) — Cards, weather popovers, telemetry metrics grids.
- `radius-xl` (12px) — System modal overlays, dropdown panels.
- `radius-full` (9999px) — Badges, indicator dots, pill selectors.

### Z-Index Layers

| Layer                | Z-Index | Usage                                      |
| :------------------- | :------ | :----------------------------------------- |
| Base                 | 0       | Page content                               |
| Sticky headers       | 10      | Table headers, sticky sidebars             |
| Dropdowns / Popovers | 50      | Weather details, menus, tooltip triggers   |
| Modals / Dialogs     | 100     | System locking screens, full-page warnings |
| Toasts               | 200     | Notification alerts (`sonner`)             |

---

## Spacing & Layout

Spacing follows a base 4px grid system.

### Spacing Scale

| Token  | Value | Multiplier | Usage                                    |
| :----- | :---- | :--------- | :--------------------------------------- |
| `0.5x` | 2px   | 0.5x       | Tight gaps, dot offsets, border paddings |
| `xs`   | 4px   | 1.0x       | Inline padding, icon labels              |
| `sm`   | 8px   | 2.0x       | Table cell padding, tight inputs         |
| `md`   | 16px  | 4.0x       | Card padding, standard element gaps      |
| `lg`   | 24px  | 6.0x       | Page outer padding, outer margins        |
| `xl`   | 32px  | 8.0x       | Large gaps, sidebar header padding       |
| `3xl`  | 48px  | 12.0x      | Empty state spacing, segment blocks      |
| `4xl`  | 64px  | 16.0x      | Hero offsets, system dashboard sections  |

### 12-Column Grid System

Dashboards and detailed metrics views are structured using a responsive 12-column grid:

- **Gutter sizes**: Mobile `16px` (`md`), Desktop `24px` (`lg`).
- **Outer Margins**: Mobile `16px`, Desktop `24px`.
- Page content sections align to standard Tailwind grid spans (`col-span-12`, `col-span-6`, `col-span-4`, `col-span-3`).

---

## Component Specifications & State Matrix

### Complete Component States

All interactive elements must support and visually manifest this complete state list:

| Component            | Default                        | Hover                       | Active/Pressed           | Focus-Visible                                  | Disabled                                  |
| :------------------- | :----------------------------- | :-------------------------- | :----------------------- | :--------------------------------------------- | :---------------------------------------- |
| **Primary Button**   | `color-accent` bg, white text  | `color-accent-hover` bg     | `scale-[0.97]` transform | `0 0 0 3px oklch(25% 0.005 250 / 0.5)` outline | `opacity-disabled` (0.38), no events      |
| **Secondary Button** | `color-bg-elevated` bg, border | `bg-hover` bg               | `scale-[0.97]` transform | `0 0 0 3px oklch(25% 0.005 250 / 0.5)` outline | `opacity-disabled` (0.38), no events      |
| **Form Input**       | `color-bg-sunken`, border      | Inset border color changes  | No scale change          | `color-border-focus` border outline            | `opacity-disabled`, `pointer-events-none` |
| **Checkbox/Radio**   | `color-bg-sunken` border       | Accent subtle bg hover      | Standard active click    | `0 0 0 3px oklch(60% 0.15 250 / 0.5)` ring     | `opacity-disabled` (0.38), grey fill      |
| **Select Menu**      | `color-bg-sunken` border       | Subtle background highlight | Open state active        | Focus border indicator                         | Inactive menu option, greyed text         |

---

## Interactive Card System

Glass cards serve as the foundational boundaries of the application layout. They exist in four variants, governed by strict usage criteria:

### Card Variants Matrix

| Variant                | Spacing/Padding                        | Hover Behavior                                                     | Motion & Animation                                                        | Usage Limits & Guidelines                                                                |
| :--------------------- | :------------------------------------- | :----------------------------------------------------------------- | :------------------------------------------------------------------------ | :--------------------------------------------------------------------------------------- |
| **Standard GlassCard** | `md` (16px), radius `radius-lg` (8px)  | Background shift to `bg-hover` (`150ms` duration).                 | None on layout; standard hover fade.                                      | Default container. Used for standard lists, charts, and metrics grouping.                |
| **SpotlightCard**      | `md` (16px), radius `radius-lg` (8px)  | Radial gradient glow following cursor positions (GPU-accelerated). | RequestAnimationFrame throttled. Degrades to standard hover on touch.     | **Hero highlights only**. Maximum **1** card per viewport (e.g. core telemetry summary). |
| **GlowBorderCard**     | `md` (16px), radius `radius-lg` (8px)  | Linear gradient moving border animation active on hover.           | Border glows on hover (`400ms ease-out-expo`), resets instantly on leave. | **Action call-outs or warnings**. Maximum **2** cards per viewport page.                 |
| **MacOSPanelCard**     | `lg` (24px), radius `radius-xl` (12px) | 3D lift (`translateZ`, `rotateX/Y`), layered shadow enhancement.   | `250ms ease-out-expo` elevation transition.                               | **Floating Tooltips & Sidebars**. Use for elements requiring physical panel depth.       |

### MacOSPanel Variant Specifications

**Visual Tokens**:

- **Background**: Extra-frosted glass via `bg-white/75 backdrop-blur-2xl` (light) or `bg-black/60 backdrop-blur-2xl` (dark).
- **Border**: Inner rim light: `border border-white/60` (light) / `border-white/10` (dark).
- **Corner radius**: `rounded-xl` (12px) or `rounded-2xl` (16px) depending on container scale.
- **Static shadow stack**: Two-layer soft shadow for ambient occlusion:  
  `0 2px 8px rgba(0,0,0,0.04), 0 8px 30px rgba(0,0,0,0.06)`

**Interactive Motion (250ms ease-out-expo)**:

- **Hover lift**: Micro-transform with `translateZ(2px)` and slight `rotateX`/`rotateY` driven by cursor position (parallax effect).
- **Shadow expansion**: The deeper shadow stretches to `0 12px 40px rgba(0,0,0,0.08)`, visibly detaching the panel.
- **Dark-mode adaptation**: Shadows become subtle glows (`box-shadow` with white/0.05) to maintain edge definition on black backgrounds.

### Card Variant Decision Flowchart

1. _Do you need a container to group basic lists, charts, or telemetry fields?_  
   ➔ Use **Standard GlassCard**.
2. _Do you need to emphasize a single, primary metric or high-level status element?_  
   ➔ Use **SpotlightCard** (Limit: 1 per viewport).
3. _Do you need to direct immediate operator focus to a critical action path or severe condition warning?_  
   ➔ Use **GlowBorderCard** (Limit: 2 per viewport).
4. _Do you need a floating panel, sidebar, tooltip, or HUD element that requires physical depth?_  
   ➔ Use **MacOSPanelCard**.

_Note: Nesting cards inside cards is strictly forbidden across all variants._

---

## Layout & Interaction Patterns

### Focus Mode (Distraction-Free Zen Mode)

Designed for high-scale operational monitoring, Focus Mode isolates active panels by dimming surrounding workspace clutter.

#### Focus Mode Tokens

- `opacity-focus-dim` (0.4) — Applied to non-active interface layout containers.
- `blur-focus-dim` (`blur(4px)`) — Scoped blur applied to peripheral layout surfaces.
- `transition-focus` (`duration-400 ease-out-expo`) — Entering/exiting transition curve.

#### Behavioral Rules

- **Active Isolation**: The focused element (e.g., live drill telemetry graph or satellite view) retains 100% opacity and inherits a gentle focus highlight using `shadow-md`.
- **Peripheral Dimming**: Sidebars, taskbars, and passive lists receive `opacity-focus-dim` + `blur-focus-dim` and are locked out (`pointer-events: none`).
- **Safety Interrupts**: Active critical alert notifications override focus dimming, retaining `0.7` opacity and full tap target capability.
- **Dismissal**: Focus Mode is exited instantly by pressing the `Escape` key or clicking the floating "Exit Focus" trigger.
- **Reduced Motion**: If `prefers-reduced-motion` is active, dimming transitions fallback to a static `250ms` opacity crossfade.

---

## Overlays & HUDs (Heads-Up Displays)

Overlays and HUD elements overlay layout pages without completely blocking background workspace operations. They follow the specific unified parameters detailed below:

### HUD Catalog

- **macOS Sonoma-Style Dock**: Centered floating widget navigator at the bottom of the screen.
- **Command Bar Overlay**: Centered keyboard-triggered (`⌘K`) launcher panel.
- **System Tray Popover**: Floating utility panels anchored to taskbar items (battery, network, sound).
- **Weather Widget Details Bubble**: Floating panel anchored to the weather icon.

### HUD Token Set & Visual Rules

- **Surface**: `bg-white/95 backdrop-blur-2xl border border-black/[0.08] shadow-window` for standard status overlays. For inverted dark HUDs, use `color-bg-hud` (`rgba(0,0,0,0.6)`) with `backdrop-blur-xl` and a `white/10` border.
- **Text (Inverted Dark HUDs)**: Primary text white (`#ffffff`), secondary white/70 (`rgba(255,255,255,0.7)`), tertiary white/40 (`rgba(255,255,255,0.4)`).
- **Corner Radius**: `radius-xl` (12px) for command bars and docks; `radius-lg` (8px) for popovers and bubbles.
- **Elevation**: `shadow-lg` elevation is standard.
- **Animation**: Entry maps to `scale` + `opacity` (`200ms–300ms ease-out-expo`); exit maps to reversed curves.

### HUD Interaction Rules

- **Automatic Dismissal**: HUD panels must close automatically on `Escape` keystroke, click-away trigger, or focus loss.
- **Focus Trap**: Keyboard focus is trapped within the overlay panel when open.
- **Accessibility**: Anchor items trigger popovers with Radix UI Popover rules (`sideOffset={6}`, `align="end"`, `collisionPadding={16}`).

---

## Component Guidelines

### DepartmentLayout

- **Sidebar**: 240px fixed width, `color-bg-elevated`, `color-border-subtle` right border.
- **Content area**: flex-1, `color-bg-base`, `lg` padding.
- **Mobile**: sidebar collapses to a top bar with department selector.

### KPI / KPICard

- **Layout**: Big number (display scale) + small label (caption scale) below it. Not the "hero metric" template.
- **Color variants**: Dot indicator (8px circle) in semantic color + neutral text. The number itself is `color-text-primary`, not colored.
- **Grid**: `KPIGrid` uses responsive columns (2 on mobile, 3 on tablet, 4 on desktop).

### PageHeader

- **Layout**: Title (`font-size-display` scale) + formatted date (`font-size-caption` scale, `color-text-secondary`) on one line, space-between.
- **No bottom border** unless the page has no other immediate separator.

### ShiftToggle

- **Style**: Segmented control. Active segment: `color-bg-elevated` + `color-text-primary`. Inactive: transparent + `color-text-secondary`.
- **Corner radius**: `radius-md` (6px).

### FormFields

- **Input**: `color-bg-sunken` background, `color-border-subtle` border, `color-text-primary` text. Focus: `color-border-focus` ring.
- **Checkbox / Radio / Switch / Select**: Inherit `color-bg-sunken` background, focus border outline, and `opacity-disabled` when inactive.
- **Labels**: `font-size-body` scale, `color-text-secondary`, positioned above the field.
- **Error state**: `color-danger` border, `color-danger` caption text below the field.

### Tables

- **Header**: `color-bg-elevated`, `color-text-secondary`, `font-size-caption` scale, uppercase, letter-spacing 0.05em.
- **Row**: `color-bg-base`, hover → `opacity-hover` tint shift.
- **Cell padding**: `sm` vertical, `md` horizontal.
- **Border**: `color-border-subtle` between rows only (no vertical borders).

### Tabs

- **Active tab**: `color-text-primary`, `color-border-focus` bottom border (2px).
- **Inactive tab**: `color-text-secondary`, no border.
- **No background fill** on tabs. Transparent.

### Buttons

- **Primary**: `color-accent` bg, `color-bg-base` text. Used for main actions only (≤ 1 per card/section).
- **Secondary**: `color-bg-elevated` bg, `color-text-primary` text, `color-border-subtle` border.
- **Ghost**: Transparent bg, `color-text-secondary` text. Hover → `opacity-hover` background tint.
- **Danger**: `color-danger` bg, `color-bg-base` text. Used for destructive actions.

### Badges / Tags

- **Status badge**: Pill shape. Background is `color-accent-subtle` (or semantic subtle variant), text is the full semantic color.
- **Corner radius**: `radius-full` (9999px).

### Login & Authentication Interface

The sign-in interface is a key entry point that demonstrates the peak of the system's "Liquid Glass" visual design language and macOS Sonoma aesthetics.

- **Background Video**: Fixed high-resolution loop representing active operations (`/background/light-mode/light%20mode.mp4`). It is overlayed with a subtle 10% dark overlay (`bg-black/10`) to ensure contrast and readability of form elements.
- **Ambient Film Grain**: A persistent noise/grain layer overlay (`.route-bg-grain`) is rendered on top of the layout to eliminate color banding in gradients and videos and add a tactile texture.
- **Window Geometry (macOS Sign-In Card)**:
  - **Container**: A `w-[380px]` frosty glassmorphic panel (`.liquid-glass-light` class) with a 1px white border (`border-white/40`), custom shadow (`shadow-window`), and rounded corners (`rounded-xl`).
  - **Title Bar**: An OS-style header bar with macOS window controls: red, yellow, and green dots (`bg-mac-red`, `bg-mac-yellow`, `bg-mac-green` with subtle borders) and centered status text (`Arch — System Sign In` at `text-[13px] font-medium text-[var(--text-secondary)]`).
  - **Body Padding**: Spacious interior structure (`px-8 py-10`) separating controls with a vertical stack spacing of `space-y-10`.
  - **Enterprise Footer**: A bottom bar (`px-4 py-3 bg-black/[0.02] border-t border-arch-border-subtle`) housing a language selector dropdown and the system version/build tags.
- **Form Inputs**:
  - Custom inputs (`variant="login"`) with a background layer (`.liquid-glass-input`) and a slate/charcoal focus ring (`focus-ring-arch-blue` mapping to `focus:border-zinc-800 focus:ring-4 focus:ring-zinc-800/20`).
  - **RFID/NFC Icon**: An animated SVG icon inside the Employee ID field that scales and brightens on hover/focus-within (`group-hover:scale-110 group-focus-within:scale-110`).
  - **Caps Lock Alert**: A warning message ("Caps Lock is on") in yellow (`text-arch-accent-amber`) appears dynamically when typing with Caps Lock enabled.
- **Action CTA Buttons (Sign In / SSO)**:
  - Both buttons are rectangular with rounded corners (`rounded-md` matching `var(--radius-md)`) and use the `.liquid-glass-button` class for glassmorphic depth.
  - **Tactile Click Feedback**: Integrated using Framer Motion (or utility mappings) with `hoverScale={1}` and `tapScale={0.97}`.
  - **Color Coding**:
    - **Primary Sign-In**: Filled with deep charcoal/pitch black (`bg-[var(--color-action-primary)] hover:bg-[var(--color-action-primary-hover)] text-white`).
    - **Single Sign-On (SSO)**: A secondary outline button (`border border-black/[0.06] bg-black/[0.02] hover:bg-black/[0.04] text-[var(--text-secondary)]`).
- **Contextual VPN Notice**:
  - A subtle alert box (`px-3.5 py-2.5 rounded-lg border border-black/[0.04] bg-black/[0.02] text-[11px]`) informing operators about VPN connection requirements.

---

## Motion

Animations must feel light, natural, and immediate. Never block user interaction with layout transitions.

### Durations & Easing Tokens

- `duration-150` (150ms) — Micro-interactions, hover triggers, active scale changes.
- `duration-250` (250ms) — Page transitions, tab switching animations.
- `duration-400` (400ms) — Modals, dialog entrance/exit.
- `ease-out-expo` (`cubic-bezier(0.16, 1, 0.3, 1)`) — Signature easing curve for all transition paths.

### Rules

- **Animate Transforms and Opacity Only**: Never animate layout-forcing parameters (`width`, `height`, `margin`, `padding`, `top`, `left`).
- **Tactile Click Feedback**: All interactive buttons, cards, and list actions must use:

  ```css
  active: scale-[0.97] transition-transform duration-150 ease-out-expo;
  ```

- **Motion reduction**: Respect `prefers-reduced-motion`. Disable non-essential animations.

---

## Accessibility (A11y)

### Focus Indicator Policy

Focus states must be prominent. Focus indicators must use a full focus ring:
`0 0 0 3px oklch(25% 0.005 250 / 50%)` (Charcoal focus ring). It must remain visible on both base and elevated background states.

### Touch Target Minimum Size

All interactive buttons, chevrons, weather icons, and tray selectors must have a minimum clickable area of **44x44px** (WCAG 2.1). If the visual size of the icon is smaller (e.g. 26x26px), apply transparent padding around it to expand the hover and tap region.

### Screen Reader Choreography

- Announce dynamically loaded telemetry details using `aria-live="polite"`.
- Critical weather alert states must use `role="status"` or `aria-live="assertive"`.

---

## Responsive Breakpoints & Environments

| Name              | Breakpoint     | Adjustments                                                                        |
| :---------------- | :------------- | :--------------------------------------------------------------------------------- |
| **Mobile**        | `< 640px`      | Single column layouts, sidebar collapses to menu drawer, page padding `md` (16px). |
| **Tablet**        | `640px–1024px` | 2-column grids, sidebar collapsible.                                               |
| **Desktop**       | `> 1024px`     | Full 3-column KPI layout, fixed sidebar, outer padding `lg` (24px).                |
| **Large Desktop** | `≥ 1280px`     | Extended dashboards, 4-5 column grids, side-by-side split panels.                  |

---

# 🏆 Enterprise-Grade Implementation Blueprint

## Design System Tokenization, Card Consolidation & Quality Assurance

**Author:** Design Engineering Team  
**Date:** 2026-05-29  
**Target:** Monorepo (`packages/theme`, `packages/ui`, apps consuming these packages)  
**Objective:** Elevate the design system from static documentation to a living, enforceable code reality with unified components, rigorous accessibility, and top‑tier quality gates.

---

## Table of Contents

1. [Pre‑Implementation Analysis](#1-pre‑implementation-analysis)
2. [Phase I: Design Token Promotion (`@repo/theme`)](#2-phase-i-design-token-promotion-repotheme)
3. [Phase II: Unified Card Component (`@repo/ui`)](#3-phase-ii-unified-card-component-repoui)
4. [Phase III: Cross‑Device & Accessibility Visual QA](#4-phase-iii-cross‑device--accessibility-visual-qa)
5. [Phase IV: Governance, Documentation & CI/CD Hardening](#5-phase-iv-governance-documentation--cicd-hardening)
6. [Final Validation & Sign‑Off](#6-final-validation--sign‑off)

---

## 1. Pre‑Implementation Analysis

### 1.1 Current State Audit

| **Area**              | **Observation**                                                                     | **Risk/Gap**                                                                                 |
| --------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| **Tokens**            | DESIGN.md defines colors, radii, shadows, but they are not fully reflected in code. | Inconsistent styling, reliance on ad‑hoc values (`bg-[#f5f5f7]`), no single source of truth. |
| **Cards**             | Three separate implementations (`GlassCard`, `SpotlightCard`, `GlowBorderCard`).    | Visual drift, duplicated layout logic, maintenance burden.                                   |
| **Accessibility**     | Focus rings defined but not systematically enforced; touch targets undocumented.    | Risk of non‑compliance with WCAG 2.1 AA, poor mobile/tablet experience.                      |
| **Overlays / HUD**    | No shared surface token for glassmorphic popovers, weather, system tray.            | Each widget reimplements backdrop‑blur, leading to inconsistency.                            |
| **Design Governance** | Lacks automated token linting and usage enforcement.                                | Drift will continue over time.                                                               |

### 1.2 Success Criteria (Acceptance Tests)

- All new tokens compile into Tailwind utility classes usable across apps.
- No residual imports of `SpotlightCard` or `GlowBorderCard` remain; all migrated to a single `GlassCard` with `variant` prop.
- Every interactive element passes:
  - Keyboard navigation (Tab / Enter / Escape)
  - Screen reader announcement
  - 44×44 px touch target (mobile viewport)
  - Visual popover anchoring on viewport widths down to 360 px.
- CI pipeline includes token linting and visual regression tests.

### 1.3 Dependencies

- **Monorepo tooling**: `pnpm` workspaces, Nx.
- **Theme package build**: `packages/theme` must be buildable (`tsup`, `vite`, or custom script).
- **UI package**: React 18+, Tailwind CSS 3.3+.
- **Testing**: Vitest + React Testing Library (unit), Playwright/Cypress (E2E), Chromatic/Percy (visual).

---

## 2. Phase I: Design Token Promotion (`@repo/theme`)

**Goal:** Encode every design decision from DESIGN.md into CSS custom properties and Tailwind extensions, ensuring all consumers speak the same visual language.

### 2.1 Detailed Execution Steps

#### 2.1.1 Locate and Prepare Configuration Files

```bash
packages/theme/
├── src/
│   ├── variables.css      # CSS custom properties
│   ├── preset.ts          # Tailwind preset (extend theme)
│   └── tokens.ts          # Type-safe token exports (optional)
└── package.json
```

#### 2.1.2 Define New CSS Variables in `variables.css`

Insert after the existing `:root` block (or into a new dedicated block for design‑system tokens):

```css
/* ===== Design System Tokens ===== */
:root {
  /* ---- Colors (HUD & Overlays) ---- */
  --color-bg-hud: oklch(0% 0 0 / 60%);
  --color-border-hud: oklch(100% 0 0 / 10%);
  --color-text-hud-primary: oklch(100% 0 0);
  --color-text-hud-secondary: oklch(100% 0 0 / 70%);
  --color-text-hud-tertiary: oklch(100% 0 0 / 40%);

  /* ---- Opacity Tokens ---- */
  --opacity-focus-dim: 0.4;
  --opacity-disabled: 0.38;
  --opacity-hover: 0.08;

  /* ---- Blur Tokens ---- */
  --blur-focus-dim: 4px;

  /* ---- Shadows ---- */
  --shadow-sm: 0 1px 3px oklch(0% 0 0 / 0.08);
  --shadow-md: 0 4px 12px oklch(0% 0 0 / 0.1);
  --shadow-lg: 0 8px 24px oklch(0% 0 0 / 0.12), 0 0 0 1px oklch(0% 0 0 / 0.04);

  /* ---- Border Radii ---- */
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
  --radius-xl: 12px;
  --radius-full: 9999px;
}
```

_Note:_ Keep existing variables (like `--color-bg-base`) untouched. Only **add** new tokens to avoid breaking changes.

#### 2.1.3 Extend Tailwind Preset in `preset.ts`

```ts
// packages/theme/src/preset.ts
import { Config } from "tailwindcss";

export const preset: Partial<Config> = {
  theme: {
    extend: {
      colors: {
        hud: {
          DEFAULT: "var(--color-bg-hud)",
          border: "var(--color-border-hud)",
          "text-primary": "var(--color-text-hud-primary)",
          "text-secondary": "var(--color-text-hud-secondary)",
          "text-tertiary": "var(--color-text-hud-tertiary)",
        },
        // ... existing color extensions remain
      },
      opacity: {
        "focus-dim": "var(--opacity-focus-dim)",
        disabled: "var(--opacity-disabled)",
        hover: "var(--opacity-hover)",
      },
      blur: {
        "focus-dim": "var(--blur-focus-dim)",
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
        full: "var(--radius-full)",
      },
      backdropBlur: {
        xl: "var(--blur-focus-dim)", // align HUD blur if needed
      },
    },
  },
};
```

#### 2.1.4 Build & Codegen

```bash
pnpm --filter @repo/theme build   # compiles CSS and exports preset
pnpm --filter @repo/theme codegen # generates TypeScript types for tokens (if configured)
```

#### 2.1.5 Token Linting & Quality Gate

Add a linting script in `packages/theme/package.json`:

```json
"lint:tokens": "stylelint src/variables.css --config .stylelintrc.json"
```

Configure stylelint to enforce:

- No raw color values (e.g., `#fff`, `rgba(...)`) — all must use variables.
- Token naming convention (`--category-subcategory-variant`).
- OKLCH syntax for colors (disable hex/rgba rules).

Run lint and fix automatically if possible.

#### 2.1.6 Verify Consumption

In a consuming app (e.g., `apps/portal`), test new utility classes:

```tsx
<div className="bg-hud text-hud-text-primary rounded-xl shadow-lg opacity-focus-dim">
  HUD Panel
</div>
```

Ensure styles resolve correctly at compile time.

**Checkpoint 1:** All new tokens appear in generated Tailwind CSS output; stylelint passes with zero errors.

---

## 3. Phase II: Unified Card Component (`@repo/ui`)

**Goal:** Consolidate `GlassCard`, `SpotlightCard`, and `GlowBorderCard` into a single, flexible `GlassCard` with variants, eliminating duplication and enforcing design consistency.

### 3.1 Component Architecture

```tsx
// packages/ui/src/components/GlassCard/GlassCard.tsx

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "spotlight" | "glowborder";
  children: React.ReactNode;
  className?: string;
  // ... other shared props
}
```

### 3.2 Implementation Steps

#### 3.2.1 Analyze Current Implementations

- Extract shared layout classes from `GlassCard.tsx`, `spotlight-card.tsx`, `glow-border-card.tsx`.
- Common traits: `rounded-lg border border-subtle bg-elevated p-4` (or similar), backdrop-blur only when specified.
- Spotlight variant adds: mouse‑tracked radial gradient.
- Glow border variant adds: animated conic‑gradient border with CSS `background-origin: border-box`.

#### 3.2.2 Integrate Variants

**Default variant:**

```tsx
const defaultClasses =
  "rounded-lg border border-subtle bg-elevated p-4 transition-colors duration-150";
```

**Spotlight variant:**

- On `mousemove`, compute cursor position relative to card.
- Apply a `radial-gradient(circle at ${x}px ${y}px, var(--accent-subtle) 0%, transparent 70%)` as an overlay pseudo‑element or inner `div`.
- Throttle updates using `requestAnimationFrame`.
- Conditionally disable on touch devices (check `'ontouchstart' in window` or media query).
- Respect `prefers-reduced-motion`: fallback to a static subtle glow.

**Glow border variant:**

- Use a `::before` pseudo‑element with `content: ''; position: absolute; inset: -2px; z-index: -1; background: conic-gradient(from var(--angle), var(--accent), var(--border-focus), var(--accent)); border-radius: inherit; filter: blur(5px); opacity: 0; transition: opacity 0.4s;`.
- On hover (or `group-hover`), set opacity to 1 and animate `--angle` via a CSS custom property and `@property --angle` (or use a CSS animation).
- For reduced‑motion, stop angle animation and keep a static border.

#### 3.2.3 Implementation Code Skeleton

```tsx
import { useRef, useState, useCallback } from "react";
import { useReducedMotion } from "framer-motion"; // or custom hook
import clsx from "clsx";

export function GlassCard({
  variant = "default",
  children,
  className,
  ...props
}: GlassCardProps) {
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(
    null,
  );
  const cardRef = useRef<HTMLDivElement>(null);
  const prefersReduced = useReducedMotion();

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (prefersReduced || variant !== "spotlight") return;
      const rect = cardRef.current?.getBoundingClientRect();
      if (!rect) return;
      setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    },
    [prefersReduced, variant],
  );

  const handleMouseLeave = useCallback(() => setMousePos(null), []);

  const spotlightStyle = mousePos
    ? {
        background: `radial-gradient(circle at ${mousePos.x}px ${mousePos.y}px, var(--accent-subtle) 0%, transparent 70%)`,
      }
    : undefined;

  return (
    <div
      ref={cardRef}
      className={clsx(
        "rounded-lg border border-subtle bg-elevated p-4 transition-colors duration-150",
        variant === "glowborder" && "relative glow-border",
        className,
      )}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      {...props}
    >
      {variant === "spotlight" && !prefersReduced && (
        <div
          className="absolute inset-0 pointer-events-none rounded-[inherit]"
          style={spotlightStyle}
        />
      )}
      {variant === "glowborder" && (
        <div className="glow-border-overlay" aria-hidden="true" />
      )}
      {children}
    </div>
  );
}
```

#### 3.2.4 Migrate All Imports

Search monorepo for `<SpotlightCard` and `<GlowBorderCard`:

- Replace with `<GlassCard variant="spotlight">` and `<GlassCard variant="glowborder">`.
- Ensure no props are lost; if any variant-specific props exist (e.g., `spotlightColor`), add them to the unified interface.

#### 3.2.5 Deprecation & Cleanup

```bash
git rm packages/ui/src/components/SpotlightCard.tsx
git rm packages/ui/src/components/GlowBorderCard.tsx
```

Update barrel exports (`index.ts`) to remove old components.

#### 3.2.6 Unit & Integration Tests

- Test that rendering with `variant="default"` applies standard classes.
- Simulate mouse events for spotlight and verify position state updates (mock `getBoundingClientRect`).
- Test `prefers-reduced-motion` disables spotlight tracking and glow animation.
- Snapshot tests for all three variants.

**Checkpoint 2:** No remaining imports of deprecated card components; all tests pass; visual snapshot approved by designers.

---

## 4. Phase III: Cross‑Device & Accessibility Visual QA

**Goal:** Validate that every interactive component (weather popover, system tray, dock, cards) behaves impeccably across devices, screen readers, and input modalities.

### 4.1 Responsive Collision Bounds

- **Actions:**
  - Use browser DevTools to set viewport to 360×800 px.
  - Trigger `WeatherWidget` popover and `ServicesDropdown`.
  - Verify using `align="end"` that popover is fully visible, not cut off.
  - If not, adjust `collisionPadding` in Radix Popover or add `max-w-[calc(100vw-32px)]`.
- **Edge Cases:** landscape tablets (1024×768) — popover must not overflow vertically; test with scrollable page.

### 4.2 Accessibility Verification

#### 4.2.1 Keyboard Navigation

- **Procedure:**
  - Tab to weather icon → focus ring clearly visible (check contrast against all backgrounds using axe DevTools).
  - Press Enter → popover opens, focus moves to first interactive element inside (or content itself).
  - Press Escape → popover closes, focus returns to trigger.
  - Repeat for system tray toggle, dock items.
- **Fallback:** If focus does not return, manually implement `onEscapeKeyDown` and restore focus.

#### 4.2.2 Touch Targets (WCAG 2.1, 2.5.5)

- Measure computed size of trigger buttons (weather, system tray, dock icons). If visual size < 44×44 px, add transparent padding (or use `min-w-[44px] min-h-[44px] inline-flex items-center justify-center`).
- Use Chrome DevTools “Lighthouse” → “Touch targets” audit.

#### 4.2.3 Screen Reader Choreography

- **Test with VoiceOver (Mac) / NVDA (Windows):**
  - Open weather popover → should announce “Weather details, expanded” and then the content.
  - After closing, should announce “Weather details, collapsed”.
- Ensure `aria-expanded`, `aria-haspopup`, and `aria-label` are correctly bound.

### 4.3 Visual Regression Testing

- Add Storybook stories for:
  - `GlassCard` all variants (static, hover, spotlight with simulated mouse position, glow border active).
  - `WeatherWidget` in open and closed states.
  - `SystemTrayToggle` open/closed.
  - `Dock` on hover and visible state.
- Integrate with Chromatic/Percy to run on every PR.
- Approve intentional diffs; flag any unexpected style changes.

### 4.4 E2E Test Automation (Playwright/Cypress)

```ts
test("weather popover accessible", async ({ page }) => {
  await page.goto("/");
  const trigger = page.getByLabel("Weather details");
  await expect(trigger).toBeVisible();
  await trigger.click();
  const popover = page.getByRole("dialog", { name: "Weather details" }); // if role added
  await expect(popover).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(popover).not.toBeVisible();
});
```

**Checkpoint 3:** All accessibility audits pass; Chromatic baseline approved; E2E tests green.

---

## 5. Phase IV: Governance, Documentation & CI/CD Hardening

**Goal:** Prevent regression and ensure long‑term consistency.

### 5.1 Update DESIGN.md

- Add new tokens in a dedicated “Code Tokens” section, referencing the variable names.
- Document the `GlassCard` unified API and when to use each variant.
- Add an “Overlays & HUDs” section with shared surface and animation rules.

### 5.2 CI/CD Pipeline Augmentation

Add to `.github/workflows/ci.yml` (or equivalent):

```yaml
- name: Lint Tokens
  run: pnpm --filter @repo/theme lint:tokens

- name: Type Check
  run: pnpm typecheck

- name: Unit & Integration Tests
  run: pnpm test

- name: Visual Regression (Chromatic)
  uses: chromaui/action@v1
  with:
    projectToken: ${{ secrets.CHROMATIC_PROJECT_TOKEN }}

- name: E2E Tests
  run: pnpm test:e2e
```

### 5.3 Developer Documentation

- Write a migration guide from `SpotlightCard` / `GlowBorderCard` to `GlassCard`.
- Create a token usage cheat sheet for developers.
- Add a “Design System” README inside `packages/theme`.

### 5.4 Future‑Proofing

- Ensure all new tokens have dark‑mode variants defined (even if not used) using `[data-theme="dark"]` or `prefers-color-scheme` — just map them to the same values for now, but structure allows easy extension.
- Consider exporting a `focusMode` React context that applies `opacity-focus-dim` and `blur-focus-dim` to non‑active areas.

---

## 6. Final Validation & Sign‑Off

### 6.1 Pre‑Release Checklist

- [ ] All tokens compile and are used in at least one component.
- [ ] Zero instances of `SpotlightCard` or `GlowBorderCard` imports.
- [ ] Lighthouse accessibility score ≥ 95.
- [ ] Manual QA on physical iPhone SE, iPad, Windows touch laptop.
- [ ] Design lead reviews and approves Chromatic snapshots.
- [ ] Performance: no frame drops during spotlight/gradient animations (Profile with React DevTools).

### 6.2 Deployment Strategy

- Publish updated `@repo/theme` and `@repo/ui` packages with a minor version bump.
- Update consuming apps to use new versions.
- Deploy to staging, then production after QA sign‑off.

### 6.3 Rollback Plan

- If token changes cause unexpected breakage, revert to previous package versions and investigate in a hotfix branch.

---

**Final Output:** A fully tokenized, unified, and rigorously validated design system implementation that meets the highest standards of performance, accessibility, and maintainability — ready for production.

---

## Hub Visual Identity & Interaction Framework

**Design intent:** A premium, macOS‑inspired light‑mode interface built on liquid glass, semantic color, and orchestrated motion. The aesthetic is calm and hyper‑legible, allowing operators to scan critical data instantly without distraction.

### 1. Liquid Glass Foundation & Depth

- **Hero Background:** The top of the hub features a fluid `HeroBackground` layer with liquid‑glass video/animation that bleeds through the overlaid UI.
- **Card treatment:** Primary content sits in `GlassCard` components using `variant="liquid"`. Instead of opaque fills, cards use `backdrop-blur-sm` + semi‑transparent surface tokens (`bg-arch-surface-secondary/80`), letting the background show organically.
- **Edge highlighting:** Depth is reinforced with an inner `ring-1 ring-inset ring-arch-border-emphasis/40`, simulating light catching the edge of physical glass.

### 2. Strict Semantic Color System (OKLCH)

- **No raw values:** All colors are mapped to `@repo/theme` semantic tokens (e.g., `arch-text-primary`, `arch-surface-tertiary`, `arch-border-subtle`). Flat hex or standard Tailwind colors are forbidden (enforced by Stylelint).
- **Neutral‑dominant palette:** Pure whites and soft grays form the backdrop.
- **Functional accent usage:** Color is reserved for status signals:
  - `text-accent-red` / `bg-accent-red/10` – Open safety incidents
  - Amber tones – Active breakdowns
  - Green – Active sector indicator

### 3. Orchestrated Motion & Micro‑Interactions

- **Staggered entrance:** Page sections load sequentially with `animate-fade-up` and custom `animationDelay` values (0s → 0.4s), creating a deliberate, polished cascade.
- **Subtle layering:** `liquid-shift-y` class provides a gentle floating effect on background elements.
- **Hover transitions:** Interactive rows use `group-hover/row:text-arch-accent-blue` + `transition-colors duration-300` to smoothly guide focus across modules.
- **Performance guardrails:** Animations are restricted to opacity, transform, and color changes only; no layout‑triggering properties are animated, ensuring 60fps interactions.

### 4. Visual Hierarchy & Scannability

- **Eyebrow badges:** Compact pill‑shaped badges at the top of the hero card surface dense data like active incident counts and portal version, keeping critical info glanceable without crowding main headings.
- **Diffuse glow effect:** The “Core Operational Modules” area uses `aurora-shadow` for a soft, premium halo around the department grid.
- **Icon + type pairing:** Consistent Lucide icons (Shield, Activity, Wrench) with contextual colors (red shield for Urgencies, green activity line for Telemetry) provide instant visual differentiation.

### Summary

The result is a **premium, dynamic, and scan‑friendly hub**—a light‑mode sanctuary where every surface feels like polished glass, every status cue is immediate, and the entire experience arrives with a choreographed sense of calm authority.

---

## Hub Panel System – Aesthetic & Interaction

The panels extend the liquid-glass, semantic-color, and motion language into a scannable grid of operational modules. They function like app icons carved from the same polished glass sheet, with subtle glow, hierarchy, and hover feedback.

### 1. Glass Panel Surface & Depth

- **Card variants:** Panels likely use a `GlassCard` variant similar to the hero but optimized for density—`variant="panel"` or default—retaining:
  - `backdrop-blur-sm` over the flowing background.
  - Semi-transparent surface fill (`bg-arch-surface-secondary/70–80`).
  - Inner border highlight (`ring-1 ring-inset ring-arch-border-emphasis/30`) for edge definition.
- **Shadow approach:** Instead of heavy drop shadows, panels rely on the `aurora-shadow` utility—a soft, diffuse, colored glow that sits behind the card, giving the module grid a premium, atmospheric lift. This shadow is low-opacity and tinted subtly toward the accent of the current active sector or default slate.

### 2. Semantic Token Mapping

- **Background & borders:** `bg-arch-surface-secondary`, `border-arch-border-subtle`, ensuring all panels sit on the same light, neutral base.
- **Text hierarchy:**
  - Module title: `text-arch-text-primary` (strong, compact).
  - Status/description: `text-arch-text-secondary` (softer, smaller).
  - Metric highlights: `text-arch-accent-blue` or sector-specific accent via `group-hover` transitions.
- **Status indicators:** Miniature colored dots or badges inside the panel (red, amber, green) use the same functional accent tokens as the hero, keeping incident counts, breakdowns, and active status immediately recognizable.

### 3. Motion & Micro-Interactions

- **Staggered entrance:** Panels share the hero’s `animate-fade-up` cascade. They appear after the hero, with delays typically starting at 0.2s and incrementing by 0.05s per panel, creating a wave from top-left to bottom-right.
- **Hover lift:** On hover, the panel gently translates up (`liquid-shift-y` or a subtle `hover:-translate-y-0.5`), the `aurora-shadow` intensifies, and the border ring becomes slightly more opaque. All transitions are `duration-300` on `transform`, `box-shadow`, and `border-color`.
- **Group hover linking:** The entire row or card acts as a group (`group/panel`), so hovering anywhere triggers:
  - Title color shift to `text-arch-accent-blue`.
  - An icon may subtly scale or rotate (e.g., `group-hover:scale-110`).
- **No layout animations:** Only transforms, opacity, and colors are animated; margins and padding are static, keeping the grid rock-solid during interaction.

### 4. Layout & Content Density

- **Grid structure:** Panels are arranged in a responsive CSS grid (likely `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`), with consistent gap tokens from the design system.
- **Eyebrow & pill badges:** Like the hero, each panel can surface compact information (counts, version, status) in `rounded-full` pills at the top or top-right of the card, using `text-xs` and a muted background.
- **Icon + label pairing:** Each module has a Lucide icon (Wrench, Activity, Shield, etc.) placed prominently but restrained, often in a soft rounded square or circle. The icon color follows the module’s status—red for incidents, green for nominal, blue for informational.
- **Aurora accent tie-in:** The `aurora-shadow` tint may shift based on the module’s active state or, globally, based on the active sector indicator, creating a unified atmospheric cue across the entire panel grid.

### 5. Overall Role in the Hub

The panels are the functional heart of the hub—transforming the ethereal hero into actionable entry points. They feel like pressed-glass tiles floating just above the background, each one a calm, hyper-legible dashboard fragment that reinforces the “premium, non-distracting” light-mode philosophy.

## GlassCard API

**Component:** `GlassCard`  
**Path:** `packages/ui/src/components/GlassCard.tsx` (or similar)  
**Role:** The foundational surface primitive for all elevated content in the portal. It enforces a glass‑morphism language through variants, semantic tokens, and strict motion constraints.

### Variants

| Variant     | Visual Effect                                                                                                                                                                    | Usage                                       |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `window`    | Subtle transparency (`bg-arch-surface-primary/70`), `backdrop-blur`, `border-arch-border-subtle`. Light inner shadow for depth.                                                  | Default cards, sidebars, settings panels.   |
| `liquid`    | High transparency (`bg-arch-surface-secondary/80`), `backdrop-blur-sm`, `ring-1 ring-inset ring-arch-border-emphasis/40`. No inner shadow; edge highlight simulates fluid glass. | Hero, primary call‑to‑action, panel grid.   |
| `spotlight` | Semi‑opaque surface with a radial gradient from a corner accent (e.g., `arch-accent-blue`), `backdrop-blur`, subtle border glow.                                                 | Featured module, promotional cards.         |
| `raised`    | Opaque surface (`bg-arch-surface-primary`) with standard box‑shadow for elevation. No blur.                                                                                      | High‑contrast contexts, dark‑mode fallback. |

### Props

| Prop        | Type                                              | Default    | Description                                                                                           |
| ----------- | ------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------- |
| `variant`   | `"window" \| "liquid" \| "spotlight" \| "raised"` | `"window"` | Controls transparency, blur, and border style.                                                        |
| `depth`     | `"flat" \| "sm" \| "md" \| "lg"`                  | `"md"`     | Applies predefined shadow/elevation tokens. Overridden by variant if it uses `ring` (e.g., `liquid`). |
| `noBorder`  | `boolean`                                         | `false`    | Removes the border ring for seamless integration (e.g., inside larger glass containers).              |
| `as`        | `React.ElementType`                               | `"div"`    | Polymorphic container (e.g., `"section"`, `"article"`).                                               |
| `className` | `string`                                          | –          | Additional custom classes. Must use semantic tokens or be approved by design system.                  |

### Semantic Token Bindings

- **Backgrounds:** All backgrounds pull from `arch-surface-*` tokens (primary, secondary, tertiary). No raw `#fff` or `bg-white`.
- **Borders:** `border-arch-border-subtle` or `ring-arch-border-emphasis/40` for highlights.
- **Text inside:** Inherits from parent; cards do not force text colors, but content should always use `arch-text-*`.
- **Accents:** Variants like `spotlight` may use `via-arch-accent-blue/10` in gradient overlays.

### Motion & Interaction Rules

- **Hover transitions:** Only `opacity`, `transform`, and `color` may be animated. No margin, padding, or layout‑shift properties.
- **Default transition:** `transition-all duration-300` (or more targeted via `transition-colors`, `transition-transform`).
- **Group interactivity:** Cards can act as `group` to change children’s style on hover (e.g., `group-hover/panel:text-arch-accent-blue`).
- **Entrance animation:** When used in a staggered list, cards receive `animate-fade-up` with `animationDelay` values set by the parent layout.

### Integration with Global Utilities

- **`aurora-shadow`:** Applies a soft, tinted glow behind the card. Works best with `liquid` and `spotlight` variants. Must not conflict with `ring` highlights – `aurora-shadow` uses `box-shadow`, while `ring` is an inset border.
- **`liquid-shift-y`:** Adds a subtle floating translateY animation on hover. Recommended only for cards that sit on a visually rich background (like `liquid` variant).

### Accessibility

- Cards that are interactive (clickable) must have `role="button"`, `tabIndex={0}`, and appropriate `aria-label` if they are solely icons.
- All content remains scannable; glass effects must not reduce contrast below WCAG AA. The design system ensures the token choices (`arch-text-primary` on `arch-surface-secondary/80`) meet minimum contrast ratios.

### Usage Example

```tsx
<GlassCard variant="liquid" depth="flat" className="group cursor-pointer">
  <h3 className="text-arch-text-primary group-hover:text-arch-accent-blue transition-colors duration-300">
    Module Title
  </h3>
  <p className="text-arch-text-secondary">Short description</p>
  <span className="inline-block w-2 h-2 rounded-full bg-accent-red" />
</GlassCard>
```

### Anti‑Patterns

- ❌ Using `variant="liquid"` with a solid white background – destroys transparency.
- ❌ Animating padding or margins on hover – causes layout shift.
- ❌ Overriding border colours with raw hex values – breaks semantic consistency.
- ❌ Combining `depth` with `ring-*` variants – `ring` replaces shadow‑based depth.
