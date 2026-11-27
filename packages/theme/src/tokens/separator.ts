/**
 * Separator standard tokens — the design-system contract behind
 * `@repo/ui/Separator` (`ArchSeparator`). Values are registered in
 * `packages/theme/tokens.json` under the `separator` group and emitted as
 * `--separator-*` custom properties by Style Dictionary.
 */
export const separatorTokens = {
  hairlineThickness: 'var(--separator-hairline-thickness)',
  goldThickness: 'var(--separator-gold-thickness)',
  gap: 'var(--separator-gap)',
  markSize: 'var(--separator-mark-size)',
  pipeSize: 'var(--separator-pipe-size)',
  glow: 'var(--separator-glow)',
} as const;

export type SeparatorTokens = typeof separatorTokens;
