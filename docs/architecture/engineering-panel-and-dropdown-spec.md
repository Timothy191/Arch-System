# Engineering Panel System & Professional Dropdown Menu Specification

## 1. Overview & Purpose

This specification defines the modular `GoldenPanel` component architecture (`@repo/ui/GoldenPanel`) and WCAG 2.1 AA `ProfessionalDropdownMenu` (`@repo/ui/ProfessionalDropdownMenu`) deployed across the Engineering Department (`/engineering`, `/engineering/tire-management`, `/engineering/breakdowns`, `/engineering/daily-log`, and `/engineering/reports`).

---

## 2. `GoldenPanel` Component System

### 2.1 Layout, Spacing & Typography Hierarchy

- **Perimeter & Material**: Uses `liquid-glass-light gold-steel-border gold-steel-border-slim rounded-card border border-white/30 backdrop-blur-md` with four CVA elevation variants:
  - `default`: `bg-[var(--material-regular)] shadow-diffusion-sm` (`rgba(255, 255, 255, 0.82)`)
  - `elevated`: `bg-[var(--material-thick)] shadow-glass-depth` (`rgba(255, 255, 255, 0.92)`)
  - `interactive`: Hover elevation (`hover:-translate-y-0.5 hover:shadow-card-hover`)
  - `subtle`: `bg-[var(--material-thin)] shadow-card` (`rgba(255, 255, 255, 0.65)`)
- **Header Anatomy**:
  - Padding: `px-5 py-4` (`20px × 16px`), responsive flex stack (`flex-col sm:flex-row sm:items-center sm:justify-between`).
  - Official Branding: Optional `showLogo` renders the scalable `<Logo />` (`@repo/ui/Logo`) in canonical Metallic Gold (`#d4af37`).
  - Typography: `h1`/`h2` at `text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-heading)]`; `h3`/`h4` at `text-lg font-bold`; subtitle at `text-sm text-[var(--text-secondary)]`.
  - Horizontal Separator: Positioned directly beneath the header bar using a metallic gold hairline (`h-px w-full bg-gradient-to-r from-[var(--accent-gold)]/55 via-[var(--accent-gold)]/25 to-transparent`).
- **Interactive Header Drawer (`headerItems`)**:
  - Selecting a header toolbar item activates a GPU-animated configuration/telemetry drawer (`AnimatePresence` + `motion.div` animating `opacity` and `translateY(-6px -> 0)` over `180ms` with `cubic-bezier(0.16, 1, 0.3, 1)`).
  - Accessible bindings: `role="toolbar"`, `aria-expanded`, and `aria-controls` linking each trigger to the active drawer region.
- **Collapsible Body (`collapsible`)**:
  - Toggles body visibility smoothly (`160ms` `cubic-bezier(0.16, 1, 0.3, 1)`) while respecting `useReducedMotion()`.

---

## 3. `ProfessionalDropdownMenu` Specification

### 3.1 Feature Breakdown & Configuration Options

| Prop           | Type                                  | Default   | Description                                                                                           |
| :------------- | :------------------------------------ | :-------- | :---------------------------------------------------------------------------------------------------- |
| `triggerLabel` | `string`                              | required  | Visible label inside the golden-bordered trigger button                                               |
| `triggerIcon`  | `ReactNode`                           | —         | Optional leading icon rendered in `--accent-gold`                                                     |
| `triggerBadge` | `string \| number`                    | —         | Monospace count or active sub-filter pill                                                             |
| `items`        | `readonly ProfessionalDropdownItem[]` | required  | Menu hierarchy supporting icons, descriptions, dividers, disabled states, check icons, and `subItems` |
| `triggerMode`  | `'click' \| 'hover' \| 'both'`        | `'both'`  | Supports hybrid click + hover intent opening                                                          |
| `align`        | `'start' \| 'center' \| 'end'`        | `'start'` | Radix collision-aware viewport alignment                                                              |

### 3.2 Event Handling & `< 100ms` Performance Architecture

- **Click & Keyboard Trigger (`< 16ms`)**: Immediate state transition via Radix `DropdownMenuPrimitive.Root` without blocking main-thread layout reads.
- **Hover Trigger (`65ms` open / `160ms` grace close)**: Uses `onPointerEnter` / `onPointerLeave` timers shared across trigger and portal content so diagonal cursor movement into menu items or nested `DropdownMenuSubContent` never prematurely closes the menu, while responding well within the **`100ms` latency benchmark**.
- **Nested Multi-Level Hierarchy**: Recursive `renderMenuNode` renders `DropdownMenuPrimitive.Sub`, `SubTrigger`, and portaled `SubContent` with matching `gold-steel-border gold-steel-border-slim` surfaces.

### 3.3 Accessibility Matrix (WCAG 2.1 AA)

- **Keyboard Support**:
  - `Enter` / `Space` / `ArrowDown` on trigger: Opens menu and focuses first enabled item.
  - `ArrowDown` / `ArrowUp`: Roving focus across enabled items (skipping `data-[disabled]`).
  - `ArrowRight` on `SubTrigger`: Opens nested sub-menu and focuses first child item.
  - `ArrowLeft` inside `SubContent`: Closes sub-menu and returns focus to parent `SubTrigger`.
  - `Escape`: Closes menu and restores focus to trigger button.
  - `Tab`: Dismisses non-modal menu cleanly into standard document tab order.
- **ARIA & Contrast**:
  - Trigger exposes `aria-haspopup="menu"` and `aria-expanded`.
  - Menu items expose `role="menuitem"`, `aria-disabled`, and selected visual + screen-reader indicator (`Check` with `aria-label="Selected"`).
  - Text contrast on `bg-white/95` (`#1d1d1f` primary text, `#52525b` secondary) exceeds `12:1` and `7:1` WCAG AAA/AA thresholds.

---

## 4. Cross-Browser & Viewport Verification Matrix

| Viewport Tier | Breakpoint       | Expected Layout Behavior                                                                                                                                                          |
| :------------ | :--------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mobile        | `375px × 812px`  | Header stacks vertically (`flex-col`), action buttons wrap cleanly, tables scroll horizontally inside `overflow-x-auto`, dropdown portals collision-shift within viewport bounds. |
| Tablet        | `768px × 1024px` | 2-column KPI grids (`sm:grid-cols-2`), inline header title + wrapped toolbar controls.                                                                                            |
| Desktop       | `1440px × 900px` | 4-column KPI strips (`lg:grid-cols-4`), 3-column reliability + donut grid (`lg:grid-cols-3`), inline segmented + dropdown controls.                                               |
