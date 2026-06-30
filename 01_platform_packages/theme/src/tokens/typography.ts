/**
 * @module typography
 * Arch System — Font Family Tokens
 */

export const fonts = {
  display: 'var(--font-display), "Anurati", "Montserrat", ui-sans-serif, sans-serif',
  sans: 'var(--font-sans), "Montserrat", "Gotham", "Proxima Nova", ui-sans-serif, sans-serif',
  meta: 'var(--font-meta), "Montserrat", "Gotham", "Proxima Nova", ui-sans-serif, sans-serif',
  mono: 'var(--font-mono), ui-monospace, "Cascadia Code", monospace',
} as const;

export const fontWeights = {
  normal: 400,
  medium: 500,
} as const;
