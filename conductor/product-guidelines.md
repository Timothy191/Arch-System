<!-- cspell:ignore Anurati oklch GlassCard ArchThemeProvider -->

# Product Guidelines — Visual Identity, UX & Copy Standards

## Visual System & Theming

1. **Light Mode Only**:
   - Canvas background `#f3f4f6` (`data-theme="light"` via `ArchThemeProvider`).
   - All colors MUST reference semantic CSS custom properties (`var(--*)`) and OKLCH tokens from `@repo/theme`.
   - Zero `dark:` utility classes and zero hardcoded raw hex/RGB colors in application UI (`pnpm audit:tokens`).

2. **Liquid-Glass Surfaces & Golden Steel Branding (Canonical Template)**:
   - All cards, panels, forms, headers, modal surfaces, and floating bars MUST use `@repo/ui/GlassCard` (`variant="default" | "window" | "spotlight" | "glowborder" | "liquid"`) or inherit the taskbar-derived glass + golden steel branding defined in `packages/theme/src/tokens/glass.ts` (`glassSurfaceBranding.taskbarTemplate`):
     ```text
     liquid-glass-light gold-steel-border gold-steel-border-slim border border-white/25 bg-[var(--material-ultra-thin)] shadow-diffusion-sm backdrop-blur-md
     ```
   - Section breaks should use subtle diamond-accented golden or accent-blue dividers (`SystemGoldenSeparator` or module separator styling) to maintain clear visual hierarchy without crowding panels.

3. **Typography & Layout**:
   - Body font: `IBM Plex Sans`; monospace metrics and SMR/tabular telemetry: `JetBrains Mono` (`font-mono tabular-nums`); technical headings: `Space Grotesk`; hero display headings: `font-anurati`.
   - Layout density: Use `next/image` with explicit dimensions and descriptive `alt` text; clamp variable-length card subtitles (`line-clamp-2`) and size SVG viewBoxes with adequate margins so labels, graphs, and media never clip across desktop or mobile viewports.

4. **CSS & Tailwind Composition Budgets**:
   - Keep `<= 20` Tailwind utility classes per JSX element (target `<= 12`); extract repeated chains (`>= 10` utilities used `>= 3` times) into module `cn()` constants, CVA variants, or shared `@repo/ui` primitives (`pnpm audit:tailwind`).
   - Total shipped portal CSS budget must stay `<= 115 KB` (`pnpm lint:css-perf`).

## UX, Accessibility & Messaging Standards

- **Accessibility**: Maintain semantic landmarks (`header`, `main`, `footer`), keyboard focus visibility, `aria-label` attributes on interactive controls, adequate touch targets on mobile/tablet field views, and WCAG contrast on light glass surfaces (`>= 4.5:1` for body copy).
- **Industrial Operational Clarity**:
  - Append explicit units to field labels and identifiers (`h`, `t`, `BCM`, `m`, `m/h`, `Start SMR`, `Stop SMR`, `Hours Worked = Shift Stop SMR - Start SMR`).
  - Surface clear inline warnings when operational invariants are approached or violated (e.g., `> 14h` shift delta indicating a missing/zero `Start SMR`, or `> 12h` combined Engineering + Control Room shift delay).
- **Zero Speculation & Safe Error Handling**: Never fabricate metrics, sample pins, or placeholder status counts; surface actionable user-facing toast/form errors while logging diagnostic context securely server-side (`@repo/logger`, `logError`).
