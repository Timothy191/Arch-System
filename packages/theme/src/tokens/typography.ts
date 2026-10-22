/**
 * @module typography
 * Arch System — Font Family Tokens
 */

export const fonts = {
  sans: 'var(--font-sans), "IBM Plex Sans", Arial, Helvetica, sans-serif',
  mono: 'var(--font-mono), "JetBrains Mono", "Geist Mono", ui-monospace, "Cascadia Code", monospace',
} as const;

export const fontWeights = {
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const;
