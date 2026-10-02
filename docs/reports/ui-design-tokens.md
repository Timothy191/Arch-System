# Arch-System UI/UX Audit — Design Tokens & Styling Architecture

**Date:** 2026-10-01  
**Auditor:** UI/UX & Frontend Architecture Auditor  
**Scope:** Design tokens, Style Dictionary pipelines, CSS custom properties, Tailwind preset, and color systems in `packages/theme`.

---

## 1. Executive Design Token Architecture

The Arch-System design token architecture is composed of multiple overlapping layers:
1. **Raw Token Definition:** `packages/theme/tokens.json` (JSON format, 686 lines)
2. **Style Dictionary Compiler:** `packages/theme/sd.config.mjs` (compiles `tokens.json` to `src/css/variables-generated.css`, `src/tokens/generated-sd.ts`, `src/tokens/tokens-hsl.json`)
3. **Manual CSS Variables File:** `packages/theme/src/css/variables.css` (CSS custom properties, 505 lines)
4. **Secondary Token Generator:** `packages/theme/scripts/generate-tokens.mjs` (parses `variables.css` into `src/tokens/generated.ts`)
5. **TypeScript Token Constants:** `packages/theme/src/tokens/colors.ts`, `radii.ts`, `shadows.ts`, `motion.ts`, `typography.ts`
6. **Tailwind CSS Preset:** `packages/theme/src/tailwind/preset.ts` (exposes tokens via Tailwind utility classes and CSS variables)
7. **CSS Index:** `packages/theme/src/css/index.css` (imports both `variables.css` AND `variables-generated.css`)

```
   tokens.json ──[sd.config.mjs]──> variables-generated.css ┐
                                                              ├─> index.css ──> globals.css
   variables.css ─────────────────────────────────────────────┘
         │
         └──[generate-tokens.mjs]──> generated.ts ──> colors.ts / radii.ts / shadows.ts
```

---

## 2. The OKLCH Invariant vs Reality

**Documented Mandate (from AGENTS.md / GEMINI.md):**
> "All interfaces strictly render in light mode... All colors, radiuses, and glass styling must consume semantic OKLCH tokens from `@repo/theme/src/tokens/` (`color-bg-base`, `color-bg-elevated`, `color-text-primary`, `color-action-primary`). Raw hex/rgb color declarations are forbidden."

**Forensic Finding:**
- `tokens.json` contains **ZERO** OKLCH tokens (0 matches). It strictly defines Hex `#ffffff`, RGBA `rgba(...)`, and HSL numbers.
- Across all of `packages/theme`, `oklch()` appears only in:
  - 5 HUD overlay tokens in `variables.css` (`--color-bg-hud`, `--color-border-hud`, `--color-text-hud-primary`, `--color-text-hud-secondary`, `--color-text-hud-tertiary`)
  - 1 backdrop token (`--backdrop-dim: oklch(0% 0 0deg / 40%)`)
  - 3 shadow utilities (`--shadow-sm`, `--shadow-md`, `--shadow-lg`)
- The base tokens (`--color-bg-base`, `--color-bg-elevated`, `--color-text-primary`, etc.) are defined in `variables.css` (lines 375-384) as aliases pointing directly to **HEX/RGBA primitives**:
  - `--color-bg-base: var(--arch0);` (`#ffffff`)
  - `--color-bg-elevated: var(--arch1);` (`#f2f2f7`)
  - `--color-bg-sunken: var(--arch2);` (`#e5e5ea`)
  - `--color-border-subtle: var(--arch4);` (`rgba(60, 60, 67, 0.12)`)
  - `--color-text-primary: var(--arch11);` (`#1d1d1f`)
- **Status:** `PARTIALLY VERIFIED / MISMATCH`. The system is marketed as an OKLCH token architecture, but its underlying implementation is almost entirely Hex, RGBA, and HSL.

---

## 3. Master Color Token Inventory

| Token / Variable | Compiled Value | Semantic Purpose | Used Where | Forensic Observation | Status |
|---|---|---|---|---|---|
| `--white` | `#ffffff` | Absolute white base | Primitives | Background base | `VERIFIED` |
| `--arch0` | `#ffffff` | macOS pure white background | `--color-bg-base`, `--bg-primary` | Main surface | `VERIFIED` |
| `--arch1` | `#f2f2f7` | macOS system gray 6 | `--color-bg-elevated`, `--bg-secondary` | Elevated cards | `VERIFIED` |
| `--arch2` | `#e5e5ea` | macOS system gray 5 | `--color-bg-sunken`, `--bg-tertiary` | Input backgrounds | `VERIFIED` |
| `--arch3` | `#d1d1d6` | macOS system gray 4 | Inactive / pressed state | Skeletons | `VERIFIED` |
| `--arch4` | `rgba(60, 60, 67, 0.12)` | Hairline border | `--color-border-subtle`, `--border-subtle` | Dividers, card borders | `VERIFIED` |
| `--arch5` | `rgba(60, 60, 67, 0.20)` | Default border | `--border-default` | Active input borders | `VERIFIED` |
| `--arch6` | `rgba(60, 60, 67, 0.18)` | Border emphasis | `--border-emphasis` | Selected items | `VERIFIED` |
| `--arch7` | `rgba(60, 60, 67, 0.30)` | Strong border | High contrast divider | Modals | `VERIFIED` |
| `--arch8` | `#8e8e93` | macOS system gray (muted) | `--text-muted` | Inactive labels, hints | `VERIFIED` |
| `--arch9` | `#636366` | macOS system gray 2 (secondary) | `--text-secondary` | Subheadings, timestamps | `VERIFIED` |
| `--arch10` | `#3c3c43` | macOS system gray (body text) | `--text-body`, `--text-primary` | Standard paragraph text | `VERIFIED` |
| `--arch11` | `#1d1d1f` | macOS dark charcoal (heading) | `--text-heading`, `--color-text-primary` | Page titles, KPI numbers | `VERIFIED` |
| `--arch12` | `#ff3b30` / `#d22118` | System red (alert/danger) | `--accent-alert`, `--color-status-danger` | Critical error badges | `VERIFIED` |
| `--arch13` | `#ff9500` (Orange) | System orange (warning) | `--accent-charcoal` (Conflicting alias) | **Drift:** Named charcoal, is orange | `DUPLICATED` |
| `--arch14` | `#34c759` | System green (success/optimal) | `--accent-green`, `--color-status-positive` | Online status, KPI positive | `VERIFIED` |
| `--arch15` | `#d4af37` (Metallic Gold) | Brand primary interactive | `--accent-electric-blue` (Conflicting alias) | **Drift:** Named blue, is gold | `DUPLICATED` |
| `--accent-electric-blue` | `#d4af37` | Primary CTA, highlight | Button, links, focus rings | Hex is gold `#D4AF37`, not blue | `VERIFIED` |
| `--accent-electric-blue-hover` | `#c5a017` | Hover state for primary CTA | Button hover | Darker gold `#C5A017` | `VERIFIED` |
| `--accent-electric-blue-subtle` | `rgba(0, 122, 255, 0.08)` | Subtle badge/tint background | Badges | **Drift:** Value is actually blue RGBA | `DUPLICATED` |
| `--arch-brand-blue` | `#007aff` | System corporate blue | Logos, titlebar accents | True Apple system blue | `VERIFIED` |
| `--arch-brand-blue-hover` | `#0066eb` | Corporate blue hover | Links | True blue hover | `VERIFIED` |
| `--accent-mint` | `#10b981` | Optimal status / healthy | Badges, status pills | Mint green | `VERIFIED` |
| `--accent-amber` | `#f59e0b` | Warning status / degraded | Badges, delay warnings | Amber orange | `VERIFIED` |
| `--dept-drilling` | `#2563eb` | Drilling department accent | Nav, badges, icons | Blue-600 | `VERIFIED` |
| `--dept-production` | `#34c759` | Production department accent | Nav, badges, icons | Green-500 | `VERIFIED` |
| `--dept-access-control` | `#0284c7` | Access Control accent | Nav, badges, icons | Sky-600 | `VERIFIED` |
| `--dept-engineering` | `#7c3aed` | Engineering accent | Nav, badges, icons | Violet-600 | `VERIFIED` |
| `--dept-control-room` | `#dc2626` | Control Room accent | Nav, badges, icons | Red-600 | `VERIFIED` |
| `--dept-admin` | `#7c3aed` | Admin panel accent | Nav, badges, icons | Violet-600 | `VERIFIED` |
| `--mac-red` | `#ff5f56` | macOS close window button | `MacTitleBar.tsx` | Traffic light close | `VERIFIED` |
| `--mac-yellow` | `#ffbd2e` | macOS minimize window button | `MacTitleBar.tsx` | Traffic light minimize | `VERIFIED` |
| `--mac-green` | `#27c93f` | macOS zoom window button | `MacTitleBar.tsx` | Traffic light maximize | `VERIFIED` |
| `--dark-glass-surface` | `rgba(15, 23, 42, 0.75)` | Dark card glass (slate-900) | `.glass-dark` utility | Violates "strict light-mode" rule | `LEGACY` |
| `--text-on-dark-glass` | `rgba(248, 250, 252, 0.95)` | Text on dark glass | `.glass-dark` utility | Dark mode residual token | `LEGACY` |

---

## 4. Semantic Drift & Token Naming Anomalies

### 4.1 Gold Named "Electric Blue"
- **Definition in `variables.css` (line 68):**
  ```css
  /* Vivid Electric Blue — primary CTA, interactive highlights */
  --accent-electric-blue: #D4AF37;
  --accent-electric-blue-hover: #C5A017;
  --accent-electric-blue-subtle: rgba(0, 122, 255, 0.08);
  ```
- **Evidence:** `#D4AF37` is metallic gold. The hover `#C5A017` is dark gold. Yet its subtle variant `rgba(0, 122, 255, 0.08)` is blue.
- **Root Cause:** A brand update shifted CTA accents to gold/amber, but the CSS custom property names and comments were partially retained for backward compatibility.

### 4.2 Orange Named "Charcoal"
- **Definition in `variables.css` / `variables-generated.css`:**
  ```css
  --arch13: #ff9500; /* system orange */
  --accent-charcoal: var(--arch13);
  ```
- **Definition in `colors.ts` (lines 34-36):**
  ```ts
  export const arch13 = 'var(--arch13)'; // deep charcoal — accent-blue alias
  ```
- **Evidence:** The comment in `colors.ts` claims `--arch13` is "deep charcoal", but the actual value compiled into CSS is `#ff9500` (Apple system orange).

---

## 5. Competing Scale Invariants

### 5.1 Border Radius Scale Collisions

Four distinct, conflicting border radius scales exist across code and token files:

| Source | sm | md | lg | xl | card | button | window |
|---|---|---|---|---|---|---|---|
| `tokens.json` | `6px` | `10px` | `14px` | `24px` | `18px` | `9999px` | `22px` |
| `variables-generated.css` | `6px` | `10px` | `14px` | `24px` | `18px` | `9999px` | `22px` |
| `src/tokens/radii.ts` | `8px` | `12px` | `16px` | `24px` | `28px` | `12px` | undefined |
| `variables.css` (shadcn) | undefined | `0.75rem (12px)` | undefined | undefined | `16px (liquid)` | `9999px` | `22px` |

**Consequence:** A developer importing `{ radii } from '@repo/theme/tokens'` gets `radii.card = 28px` and `radii.button = 12px`. A developer writing `rounded-card` in Tailwind gets `18px`. A developer writing `rounded-button` gets `9999px`.

### 5.2 Diffusion Shadow Inconsistencies

| Shadow Token | `variables.css` Value | `shadows.ts` Value | Discrepancy |
|---|---|---|---|
| `--shadow-glow-blue` | `0 0 20px rgba(0, 122, 255, 0.18)...` (Blue) | `0 0 20px rgba(28, 28, 30, 0.18)...` (Charcoal) | Color mismatch (Blue vs Charcoal) |
| `--shadow-card` | `0 2px 8px rgba(0, 0, 0, 0.04)...` | `0 4px 6px -1px rgba(0, 0, 0, 0.05)...` | Blur & spread mismatch |
| `--shadow-card-hover` | `0 2px 4px rgba(0, 0, 0, 0.02)...` | `0 4px 6px -1px rgba(0, 0, 0, 0.06)...` | Formula mismatch |

### 5.3 Z-Index Layer Conflicts

Two competing Z-index matrices are declared in `variables.css`:

1. **Matrix A (lines 258-263):**
   ```css
   --z-background: 10;
   --z-telemetry: 20;
   --z-primary-card: 30;
   --z-navigation: 40;
   --z-overlay: 50;
   ```
2. **Matrix B (lines 446-451 - DESIGN.md scale):**
   ```css
   --z-base: 0;
   --z-sticky: 10;
   --z-dropdown: 50;
   --z-modal: 100;
   --z-toast: 200;
   ```
3. **Hardcoded CSS Utility Classes in `packages/ui/src/globals.css`:**
   `.z-dock: 45`, `.z-ai-launcher: 60`, `.z-offline-banner: 70`, `.z-toast: 90`, `.z-priority: 999`.

---

## 6. Hardcoded Colors Bypassing the Design System

Direct inline hex colors and raw Tailwind color classes that bypass the `@repo/theme` semantic tokens:

1. **Login Page (`apps/portal/app/(auth)/login/page.tsx` & `libs/features/auth/ui/src/LoginForm.tsx`):**
   - `from-[#c59837] via-[#a36c1e] to-[#71440d]` (Custom triple-stop gold button gradient)
   - `hover:from-[#d4a843] hover:via-[#b37824] hover:to-[#814e10]`
   - `border-amber-400/40`, `shadow-amber-950/20`, `text-amber-700`, `text-amber-600`
2. **WhatsApp Split-Window (`apps/portal/components/system/SplitWindowLayout.tsx`):**
   - Header: `bg-[#008069] text-white`
   - Background: `bg-[#efeae2]`
   - Tab pills: `bg-[#008069]`, `bg-[#f0f2f5]`
   - Channel icon colors: `emerald-700`, `emerald-800`
3. **Admin Console (`apps/portal/app/admin/layout.tsx` & `redis/page.tsx`):**
   - Redis icon: `color="#dc382d"`, `bg-[#dc382d]/10`
   - n8n icon: `color="#ea4b71"`
   - Admin badge: `bg-indigo-50 text-indigo-700 border-indigo-200`
   - General admin text: `text-zinc-500`, `text-zinc-900`, `bg-zinc-100`
4. **Eve Status Bar (`packages/ui/src/components/EveStatusBar.tsx`):**
   - `text-sky-800`
   - `bg-emerald-500`, `text-emerald-800`, `border-emerald-500/20`
   - `text-black/70`, `bg-black/10`
