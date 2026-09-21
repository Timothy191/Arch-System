/**
 * @module strata
 * Arch System — "Core Log" proposal token set.
 *
 * A deliberately parallel palette to the macOS-grey `arch0..arch15` range.
 * It is exported at `@repo/theme/tokens/strata` and its CSS ships via
 * `src/css/strata.css`, which ./index.css imports. It is deliberately absent from
 * the barrel `src/index.ts`, so nothing picks it up implicitly.
 *
 * Rationale: the current login surface is clad in macOS Ventura chrome (traffic
 * lights, scenic wallpaper, glass window). Nothing about that veneer is specific
 * to mining. This set is drawn from the materials a mining operator actually
 * handles — drill core, lithology banding, iron-oxide staining — so the portal
 * reads as an industrial instrument rather than a generic desktop.
 *
 * Colour values are OKLCH, per the design-token rule in CLAUDE.md.
 * Hex approximations are given in comments only (documentation context).
 * Light-mode only: every ground/surface value clears the luminance > 200 floor.
 */

// ═══════════════════════════════════════════════════════════════
// GROUND & SURFACE — cool mineral grey, NOT the warm cream default
// ═══════════════════════════════════════════════════════════════

/** Page ground — fresh core matrix, cool pale grey. (#EDEFEE, rel. lum ≈ 0.85) */
export const strataGround = "oklch(95% 0.003 165)";

/** Panel face — highest surface, log sheet. (#FAFBFA) */
export const strataSurface = "oklch(98.7% 0.002 145)";

// ═══════════════════════════════════════════════════════════════
// LITHOLOGY — the memorable band palette
// ═══════════════════════════════════════════════════════════════

/** Deep blue-grey — primary text and dark bands. (#4E5A63, 6.4:1 on ground) */
export const lithShale = "oklch(46% 0.021 238)";

/** Warm grey — secondary text, rules, tick marks. (#8A8578) */
export const lithMudstone = "oklch(61.7% 0.02 89)";

/** Ochre — the single warm accent. Primary action fill only. (#C9A25C) */
export const lithSandstone = "oklch(73.3% 0.1 81)";

/** Iron-oxide red — error and danger states only. (#A34B33) */
export const lithIronstone = "oklch(52% 0.122 36)";

/** Near-black warm ink — text that sits ON the ochre fill. (#221E18, 7.0:1) */
export const strataInk = "oklch(23.8% 0.013 79)";

// ═══════════════════════════════════════════════════════════════
// SEMANTIC ROLES
// ═══════════════════════════════════════════════════════════════

export const strata = {
  ground: strataGround,
  surface: strataSurface,
  text: {
    primary: lithShale,
    secondary: lithMudstone,
    onAccent: strataInk,
  },
  /** Hairlines, derived so they always agree with the palette. */
  rule: {
    subtle: `color-mix(in oklch, ${lithMudstone} 32%, transparent)`,
    strong: `color-mix(in oklch, ${lithMudstone} 52%, transparent)`,
  },
  accent: lithSandstone,
  danger: lithIronstone,
} as const;

/** Band palette, ordered light → dark, for schematic lithology columns. */
export const LITHOLOGY = [
  strataSurface,
  lithMudstone,
  lithSandstone,
  lithIronstone,
  lithShale,
] as const;

// ═══════════════════════════════════════════════════════════════
// TYPE — one superfamily, three widths
// ═══════════════════════════════════════════════════════════════

/**
 * Replaces Inter. Inter is the family one reaches for on every project; it
 * carries no point of view about mining. IBM Plex was drawn for engineering
 * documentation, and its condensed widths are the vernacular of survey stakes,
 * core logs and instrument panels.
 */
export const strataFonts = {
  /** Body, labels, inputs. */
  sans: "var(--font-plex), ui-sans-serif, system-ui, sans-serif",
  /** Headings and the wordmark — instrument labelling. */
  condensed: "var(--font-plex-cond), var(--font-plex), sans-serif",
  /** Measured values only: depth ticks, clock, version. A real role, not decoration. */
  mono: "var(--font-plex-mono), ui-monospace, monospace",
} as const;

/** Scale, ratio ≈ 1.25 (Elements of Typographic Style). */
export const strataScale = {
  rail: "9px",
  caption: "11px",
  label: "12px",
  body: "13px",
  lead: "15px",
  heading: "30px",
} as const;

// ═══════════════════════════════════════════════════════════════
// DEPTH — the measured section
// ═══════════════════════════════════════════════════════════════

/** Schematic section extent, in metres. Rendered as a scale, never as data. */
export const SECTION_DEPTH_M = 100;

/** Major tick interval, in metres. */
export const SECTION_TICK_M = 10;

/** Lithology identities a band can carry. The drawn tint lives in CSS. */
export type LithologyKey = "surface" | "mudstone" | "sandstone" | "ironstone" | "shale";

/**
 * Band composition for the schematic column, top to bottom.
 *
 * Thicknesses are relative flex-grow and irregular on purpose: uniform bands
 * would read as a generic timeline. Boundaries deliberately fall *between*
 * round depth marks — real lithological contacts do not land on tens of metres.
 */
export const SECTION_BANDS: ReadonlyArray<{ key: LithologyKey; h: number }> = [
  { key: "mudstone", h: 5 },
  { key: "surface", h: 2 },
  { key: "shale", h: 8 },
  { key: "sandstone", h: 3 },
  { key: "mudstone", h: 6 },
  { key: "surface", h: 1 },
  { key: "shale", h: 4 },
  { key: "ironstone", h: 1 },
  { key: "sandstone", h: 5 },
  { key: "shale", h: 9 },
  { key: "mudstone", h: 7 },
];
