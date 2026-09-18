# 🎛️ Arch Systems (Plantcor) — Visual Architecture Add-On

> **Document Version:** 1.0.0  
> **Supplement to:** `Report.md` (Version 4.2.0)  
> **Purpose:** To capture the remaining "orphan" knowledge, legacy systems, and supplementary CSS architectures that were read and scoped but not deeply detailed in the primary report.

---

## 1. Supplementary CSS Modules & Structural Details

While `Report.md` covered the primary glass engine and animations, several other crucial CSS modules drive the Arch OS architecture:

### 1.1 Layout & Grids (`layout.css`)
- **App/OS Scaffolding**: Defines the global `#root` and `#app` containment boundaries. It establishes the rigid, non-scrollable desktop metaphor, ensuring that scrolling only happens within specific pane containers (`.scroll-pane`), never on the document body itself.
- **Split Panes**: Provides the flex and grid boundaries for the `SplitWindowLayout`, managing edge snapping and gutter widths between interactive tiles.

### 1.2 Card Specifics (`cards.css`)
- **Legacy Fallbacks**: Before the unification into `GlassCard.tsx`, individual `.card-dashboard`, `.card-telemetry`, and `.card-metric` classes were heavily relied upon. 
- **Inner Borders & Padding**: Details the specific nested paddings and pseudo-elements used to create the double-beveled edges found in legacy data cards.

### 1.3 Fluid Transitions (`transitions.css`)
- **Hardware Acceleration**: Enforces `transform, opacity, filter` transitions on interactive elements to ensure GPU rendering.
- **Hover Micro-Interactions**: Captures the exact timing (typically `150ms` to `250ms`) for button presses, input field focus, and dropdown menu scaling, supplementing the Framer Motion spring physics for purely CSS-driven elements.

---

## 2. Token Generation Pipeline

### 2.1 `variables-generated.css` vs `variables.css`
- **`variables.css`**: The hand-authored semantic layer where the design system's intent is defined (e.g., mapping `--arch13` to `--bg-primary`).
- **`variables-generated.css`**: The compiled output (likely from a Style Dictionary or similar build step) that flattens complex design token logic into raw CSS variables for production consumption. This split ensures that developers author in a human-readable format while the browser consumes a highly optimized, flat variable tree.

---

## 3. Legacy Department Logic & Technical Debt

As noted during the audit, there remains some architectural drift between the modern token system and legacy implementations:

### 3.1 Hardcoded Tailwind Utilities
Some older department modules still construct Tailwind utility classes dynamically at runtime (e.g., `text-${dept.color}-500`). 
- **The Problem**: This defeats PurgeCSS/Tailwind JIT compiling unless explicitly safelisted, and it bypasses the strict CSS custom property tiers (`--palette-semantic-*`).
- **The Fix**: The recommended path forward is to ensure all department colors are routed strictly through CSS variables (e.g., `style={{ '--dept-accent': dept.hex }}` and consuming it via Tailwind as `text-[var(--dept-accent)]`).
*(Note: Fixed in `DepartmentsTab.tsx`)*

### 3.2 Orphaned Design System Artifacts
- Certain components in `apps(legacy)/` might still reference deprecated tokens or rely on `dark:` variants that are no longer supported by the global `color-scheme: light` directive outlined in `DECISIONS.md`.
*(Note: Scanned and confirmed zero `dark:` variants remain in the UI layer)*

---

*This add-on completes the full read/scope documentation for the Plantcor Visual Architecture audit.*
