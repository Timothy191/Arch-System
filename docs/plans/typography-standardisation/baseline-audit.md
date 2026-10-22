# Typography Standardisation — Baseline Audit Report

## 1. Executive Summary

This report audits the typography system across the `Arch-System` federated monorepo to guide the standardisation of **IBM Plex Sans** as the primary sans-serif typeface, with fallback to `Arial, Helvetica, sans-serif` and retention of the existing monospace stack (`JetBrains Mono`, `Geist Mono`, `ui-monospace`) for telemetry, identifiers, and tabular values.

## 2. Monorepo Structure & Application Entry Points

- **Monorepo Topology:** Turborepo + pnpm workspace root (`/home/tim/Fork`), application core (`Arch-System`).
- **Application App Router Entry:** `Arch-System/apps/portal/app/layout.tsx`.
- **CSS Design System Core:**
  - `Arch-System/packages/theme/src/css/variables.css` (CSS custom properties, `:root`)
  - `Arch-System/packages/theme/src/css/typography.css` (Headings, `@font-face` for Anurati)
  - `Arch-System/packages/theme/src/tokens/typography.ts` (SSoT font tokens)
  - `Arch-System/packages/theme/src/tailwind/preset.ts` (Tailwind font family presets)
  - `Arch-System/packages/ui/src/globals.css` (Global styles loaded by layout)

## 3. Existing Font Architecture

- **Font Loading Engine:** `next/font/google` in `apps/portal/app/layout.tsx`.
- **Active Fonts:**
  - Primary Sans (`--font-sans`): Configured with `IBM_Plex_Sans` (`weights: 400, 500, 600, 700`, `display: 'swap'`, `fallback: Arial, Helvetica, sans-serif`).
  - Monospace (`--font-mono`): `JetBrains_Mono` (`weights: 400, 500`, `display: 'swap'`).
  - Heading Accent (`--font-outfit`): `Outfit` (`weights: 400, 500, 600`, `display: 'swap'`).
  - Branded Display (`--font-anurati`): `@font-face` for `/fonts/Anurati-Regular.otf` used strictly for operational hero-card and module logo headers.
  - Secondary / Transition: `Inter` (`--font-inter`).

## 4. Typography Hierarchy & Tokens

- **Design Tokens (`packages/theme/src/tokens/typography.ts`):**
  - `fonts.sans`: `'var(--font-sans), "IBM Plex Sans", "Inter", ui-sans-serif, system-ui, sans-serif'`
  - `fonts.mono`: `'var(--font-mono), "JetBrains Mono", "Geist Mono", ui-monospace, "Cascadia Code", monospace'`
  - `fontWeights`: `normal: 400, medium: 500, semibold: 600, bold: 700`
- **Tailwind Font Presets (`packages/theme/src/tailwind/preset.ts`):**
  - `fontFamily.sans`: `['var(--font-sans)', 'IBM Plex Sans', 'var(--font-inter)', 'var(--font-outfit)', 'system-ui', 'sans-serif']`
  - `fontFamily.mono`: `['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace']`
  - `fontFamily.heading`: `['var(--font-outfit)', 'var(--font-sans)', 'IBM Plex Sans', 'system-ui', 'sans-serif']`

## 5. CSS Custom Properties (`packages/theme/src/css/variables.css`)

```css
--font-sans: 'IBM Plex Sans', Arial, Helvetica, sans-serif;
--font-inter: 'Inter', 'SF Pro', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
--font-outfit: 'Outfit', ui-sans-serif, system-ui, sans-serif;
--font-anurati: 'Anurati', var(--font-outfit), var(--font-sans), sans-serif;
--font-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
```

## 6. Baseline Verification Results

- **TypeScript Gate (`pnpm type-check`):** Passed with 0 errors across 21 workspace packages.
- **Linter & Formatter (`pnpm lint`):** Passed with 0 errors across 18 package checks.
- **Architectural Boundaries (`pnpm policy:check`):** Verified 100% compliant.
- **12-Step Agent Verification Gate (`agent-verify.sh`):** 100% PASS.

## 7. Implementation Plan

1. **Phase 1 (Global Font):** Ensure `IBM_Plex_Sans` is the unambiguous leading typeface in `--font-sans`, CSS `:root`, Tailwind preset, and Next.js font loader. Set fallback stack to `Arial, Helvetica, sans-serif`.
2. **Phase 2 (Typography Hierarchy):** Align standard heading hierarchy (600 weight, subtle tracking, 14–16px body, 12–14px table headers).
3. **Phase 3 (Preserve Technical Typography):** Protect `--font-mono` on telemetry IDs, counters, timestamps, badge codes, and apply `tabular-nums`.
4. **Phase 4 (Surface Audit):** Audit Hub, Control Room, Access Control, Drilling, Plant Processing, Engineering, Fleet, and Administration.
5. **Phase 5 & 6 (Verification & Report):** Run complete automated checks, visual audit, and produce final implementation report.
