# Arch-System Internal Coloring System & Visual Animation Schema

## 1. Architectural Philosophy

Arch-System (Plantcor / Arch OS) implements a **strictly light-mode macOS Ventura/Sonoma Liquid-Glass + Metallic Gold Steel** visual system. Rather than switching between separate light and dark stylesheets, frosted translucent materials (`--material-ultra-thin` through `--material-thick`) layer adaptively over both high-key studio backgrounds (`#f3f4f6`) and ambient department video scrims (`DepartmentVideoBackground`), guaranteeing WCAG 2.1 AA legibility in every lighting and display context.

---

## 2. Internal Coloring System Specification

### 2.1 Three-Tier Token Hierarchy (`packages/theme/src/css/variables.css`)

1. **Tier 1 — Primitives (Internal Only)**:
   - Base surfaces (`--arch0` `#ffffff`, `--arch1` `#f5f5f7`, `--arch2` `#e8e8ed`) and ink ramps (`--arch11` `#1d1d1f`, `--arch10` `#3a3a3c`, `--arch9` `#6e6e73`).
   - Components **never** reference raw hex/RGB values directly; Gate `pnpm audit:tokens` enforces semantic token usage.
2. **Tier 2 — Semantic Surface, Text & Brand Tokens**:
   - **Text Hierarchy**:
     - `--text-heading` (`#1d1d1f`): Primary headings, KPI numerals, machine identifiers (`>= 14.5:1` contrast on white/regular glass).
     - `--text-secondary` (`#3a3a3c` / `#52525b`): Table metadata, form labels, subtitles (`>= 7.2:1` contrast).
     - `--text-muted` (`#6e6e73`): Column headers, timestamps, helper captions (`>= 4.8:1` contrast).
   - **Canonical Metallic Gold Trim & Brand Accent**:
     - `--accent-gold` (`#d4af37`): Official `<Logo />`, section icons, active indicators, and horizontal header separators.
     - `--accent-gold-subtle` (`rgba(212, 175, 55, 0.08)`): Selected menu/chip surface fill.
     - `--accent-gold-border` (`rgba(212, 175, 55, 0.28)`): Structural hairline perimeter.
   - **Apple HIG Frosted Materials**:
     - `--material-ultra-thin`: `rgba(255, 255, 255, 0.45)` + `blur(12px)`
     - `--material-thin`: `rgba(255, 255, 255, 0.65)` + `blur(16px)`
     - `--material-regular`: `rgba(255, 255, 255, 0.82)` + `blur(20px)`
     - `--material-thick`: `rgba(255, 255, 255, 0.92)` + `blur(24px)`
3. **Tier 3 — Department & Operational Status Palette**:
   - `--dept-engineering`: `#7c3aed` (Engineering Violet emblem accent)
   - **Optimal / Operational**: `emerald-700` / `--accent-mint` (`#10b981` fill / `#047857` text for `>= 5.4:1` light-surface contrast)
   - **Warning / Preventative Trigger**: `amber-700` / `--accent-amber` (`#b45309` text on `rgba(245, 158, 11, 0.12)`)
   - **Critical / Active Breakdown**: `rose-700` / `--accent-red` (`#be123c` text on `rgba(244, 63, 94, 0.12)`)
   - **Telemetry / Spare Stock**: `sky-700` (`#0369a1` text on `rgba(14, 165, 233, 0.12)`)

### 2.2 State-Based Color Application Rules

| Interaction State     | Surface Treatment                                                 | Border Treatment                                    | Text / Icon Treatment                                      |
| :-------------------- | :---------------------------------------------------------------- | :-------------------------------------------------- | :--------------------------------------------------------- |
| **Default (Rest)**    | `bg-white/90` or `bg-[var(--material-regular)]`                   | `gold-steel-border-slim` (`1.75px` masked gradient) | `text-[var(--text-heading)]`                               |
| **Hover**             | `bg-white` (`96–100%` opacity)                                    | `gold-shimmer` (`1.8s` specular sweep)              | `text-[var(--text-heading)]` + subtle icon scale           |
| **Focus-Visible**     | `bg-white`                                                        | `ring-2 ring-[var(--accent-gold)]/55`               | High-contrast ink preserved                                |
| **Active / Selected** | `bg-[var(--accent-gold-subtle)]` or `bg-[var(--accent-charcoal)]` | `border-[var(--accent-gold)]/60`                    | `font-semibold text-[var(--text-heading)]` or `text-white` |
| **Disabled**          | `opacity-45` (`--opacity-disabled: 0.38`)                         | Static muted border, pointer events disabled        | Non-interactive cursor                                     |

---

## 3. Visual Animation Schema

### 3.1 Timing Parameters & Easing Curves

| Token / Curve                      | Duration        | Cubic-Bezier / Physics                                  | Primary Use Case                                                                                                      |
| :--------------------------------- | :-------------- | :------------------------------------------------------ | :-------------------------------------------------------------------------------------------------------------------- |
| `--dur-fast` / `--transition-fast` | `120ms–150ms`   | `cubic-bezier(0.4, 0, 0.2, 1)`                          | Button press, chevron rotation, focus ring, menu item highlight                                                       |
| `--dur-panel`                      | `160ms–200ms`   | `cubic-bezier(0.16, 1, 0.3, 1)` (`ease-mac-decelerate`) | `GoldenPanel` drawer open/close, card hover lift (`-2px`), tab content swap                                           |
| `Tab Pill Spring`                  | `~220ms` settle | Framer `stiffness: 420, damping: 34`                    | Shared `layoutId` active tab indicator in `BreakdownsDashboard`                                                       |
| `gold-trim-shine`                  | `4.2s` infinite | `ease-in-out`                                           | Ambient specular metallic sheen along `.gold-steel-border::before`                                                    |
| `gold-shimmer`                     | `1.8s` infinite | `ease-in-out`                                           | Accelerated border shimmer on `:hover` / `:focus-visible` for cards, `input`, `select#machine-select`, and `textarea` |

### 3.2 GPU Compositor & Performance Optimization Invariants

1. **Zero Layout-Thrashing Keyframes**: `@keyframes` are strictly audited by `tools/audits/audit-design-tokens.cjs` to forbid `width`, `height`, `margin`, `padding`, `top`, `left`, `right`, and `bottom`. Only compositor-friendly `transform`, `opacity`, `filter`, and `background-position` are permitted.
2. **Masked Pseudo-Element Borders**: `.gold-steel-border::before` renders the 9-stop metallic gold gradient (`#5c4004 → #e5bc4b → #fff4c2 → #5c4004`) via `mask-composite: exclude` with `pointer-events: none`, avoiding extra DOM wrapper nodes.
3. **Native Form Control Adaptation**: Replaced elements (`input.gold-steel-border`, `select.gold-steel-border`, `textarea.gold-steel-border`) cannot host `::before` pseudo-elements; they use dual `background-clip: padding-box, border-box` layers so `#machine-select` and all workshop inputs share identical golden border physics.
4. **Reduced Motion Compliance (`WCAG 2.3.3`)**:
   - CSS `@media (prefers-reduced-motion: reduce)` halts `gold-trim-shine`, `gold-shimmer`, and hover `transform` translations.
   - React components query `useReducedMotion()` to bypass entrance/exit vertical offsets and spring motion when requested by the operating system.

---

## 4. Verification & Testing Criteria

1. **Automated Design Token Gate (`pnpm audit:tokens`)**: Verifies `0` `dark:` classes, `0` unapproved Tailwind shadows, `0` forbidden layout keyframes, and valid `tokens.json` schema.
2. **CSS Bundle Performance Gate (`pnpm lint:css-perf`)**: Enforces total source CSS across `packages/{theme,ui}/src/**/*.css <= 115 KB`.
3. **Tailwind Composition Gate (`pnpm audit:tailwind`)**: Enforces per-element utility ceiling and zero `@apply` leakage into `apps/` or `libs/`.
4. **Unit & Accessibility Assertions (`Jest + Testing Library`)**: Verifies keyboard/click/hover dropdown triggers, header drawer state transitions, `#machine-select` profile hydration, and ARIA roles.
