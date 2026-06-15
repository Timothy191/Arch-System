/**
 * @module colors
 * Arch System — Color System v4.0
 * macOS Ventura/Sonoma light palette (arch0-arch15) with semantic aliases.
 * Mirrors CSS custom properties in variables.css for JS/TS usage (charts, shaders, dynamic values).
 */

// ═══════════════════════════════════════════════════════════════
// ARCH COLOR PALETTE — macOS Ventura/Sonoma Light
// ═══════════════════════════════════════════════════════════════

/** Background range — macOS system grays */
export const arch0 = "#f5f5f7"; // macOS base background
export const arch1 = "#ffffff"; // elevated surface / card
export const arch2 = "#e8e8ed"; // sunken / input bg
export const arch3 = "#d2d2d7"; // pressed / deeply sunken

/** Border range — hairline to emphasis (stored as hex approximations for JS use) */
export const arch4 = "rgba(0,0,0,0.06)"; // border subtle
export const arch5 = "rgba(0,0,0,0.12)"; // border default
export const arch6 = "rgba(0,0,0,0.20)"; // border emphasis
export const arch7 = "rgba(0,0,0,0.30)"; // border strong

/** Text range — macOS type hierarchy */
export const arch8 = "#a1a1a6"; // muted / placeholder
export const arch9 = "#6e6e73"; // secondary / caption
export const arch10 = "#3a3a3c"; // body
export const arch11 = "#1d1d1f"; // heading / primary

/** Aurora Accents — macOS system colors */
export const arch12 = "#ff3b30"; // red — error / danger
export const arch13 = "#007aff"; // blue — warning
export const arch14 = "#34c759"; // green — success
export const arch15 = "#007aff"; // blue — macOS system blue

/** Complete palette array (for iteration) */
export const ARCH_PALETTE = [
  arch0,
  arch1,
  arch2,
  arch3,
  arch4,
  arch5,
  arch6,
  arch7,
  arch8,
  arch9,
  arch10,
  arch11,
  arch12,
  arch13,
  arch14,
  arch15,
] as const;

// ═══════════════════════════════════════════════════════════════
// SEMANTIC ALIASES
// ═══════════════════════════════════════════════════════════════

export const colors = {
  bg: {
    primary: arch0,
    secondary: arch1,
    tertiary: arch2,
  },
  border: {
    subtle: arch4,
    default: arch5,
    emphasis: arch6,
  },
  text: {
    muted: arch8,
    secondary: arch9,
    body: arch10,
    primary: arch10,
    heading: arch11,
  },
  accent: {
    red: arch12,
    blue: arch13,
    green: arch14,
  },
} as const;

/** @deprecated light-only — kept for backward compatibility */
export const colorsDark = colors;

// ═══════════════════════════════════════════════════════════════
// TIER 3 — DEPRECATED ALIASES
// @deprecated — Migrate all usages to the canonical accent-* names.
// Stylelint will emit warnings on var(--accent-cyan/indigo/violet) usage.
// ═══════════════════════════════════════════════════════════════
/** @deprecated → use colors.accent.blue */
export const accentCyan = arch15;
/** @deprecated → use colors.accent.blue */
export const accentIndigo = arch15;
/** @deprecated → use colors.accent.blue */
export const accentViolet = arch15;
/** @deprecated → use colors.accent.red */
export const accentAlert = arch12;
/** @deprecated → use colors.accent.blue */
export const accentBlue = arch13;
/** @deprecated → use colors.accent.green */
export const accentEmerald = arch14;

// ═══════════════════════════════════════════════════════════════
// GLASSMORPHISM TOKENS (RGBA for runtime use)
// ═══════════════════════════════════════════════════════════════

export const glass = {
  surface: "rgba(255, 255, 255, 0.72)",
  surfaceHover: "rgba(255, 255, 255, 0.88)",
  surfaceStrong: "rgba(255, 255, 255, 0.92)",
  border: "rgba(255, 255, 255, 0.15)",
  borderTop: "rgba(255, 255, 255, 0.25)",
  text: "rgba(10, 10, 20, 0.92)",
  textMuted: "rgba(10, 10, 20, 0.55)",
  vibrancy: "rgba(246, 246, 250, 0.82)",
  /** @deprecated use top-level properties */
  light: {
    surface: "rgba(255, 255, 255, 0.72)",
    surfaceHover: "rgba(255, 255, 255, 0.88)",
    border: "rgba(255, 255, 255, 0.15)",
    borderTop: "rgba(255, 255, 255, 0.25)",
    text: "rgba(10, 10, 20, 0.92)",
    textMuted: "rgba(10, 10, 20, 0.55)",
  },
} as const;

// ═══════════════════════════════════════════════════════════════
// HSL VALUES (for shadcn/ui compatibility - macOS Light Mode)
// ═══════════════════════════════════════════════════════════════ */

export const hsl = {
  primary: "211 100% 50%", // #007aff macOS blue
  primaryForeground: "0 0% 100%",
  background: "240 5% 96%", // #f5f5f7
  foreground: "240 6% 10%", // #1d1d1f
  card: "0 0% 100%",
  cardForeground: "240 6% 10%",
  popover: "0 0% 100%",
  popoverForeground: "240 6% 10%",
  secondary: "240 5% 91%",
  secondaryForeground: "240 6% 10%",
  muted: "240 5% 91%",
  mutedForeground: "240 3% 44%",
  accent: "240 5% 91%",
  accentForeground: "240 6% 10%",
  destructive: "4 86% 58%", // #ff3b30
  destructiveForeground: "0 0% 100%",
  border: "240 6% 87%",
  input: "240 5% 91%",
  ring: "211 100% 50%",
  chart1: "211 100% 50%",
  chart2: "142 71% 45%",
  chart3: "37 100% 50%",
  chart4: "4 86% 58%",
  chart5: "270 60% 55%",
} as const;

/** @deprecated light-only — kept for backward compatibility */
export const hslDark = hsl;

/** Generate a themer-compatible ColorSet for external tool export */
export function generateThemerColorSet() {
  return {
    shade0: arch0,
    shade1: arch1,
    shade2: arch2,
    shade3: arch3,
    shade4: arch4,
    shade5: arch5,
    shade6: arch6,
    shade7: arch7,
    accent0: arch12,
    accent1: arch13,
    accent2: arch14,
    accent3: arch15,
    accent4: arch12,
    accent5: arch13,
    accent6: arch14,
    accent7: arch15,
  };
}
