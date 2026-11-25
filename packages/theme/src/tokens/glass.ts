/**
 * Standardized GlassCard visual variants for the Arch-System design language.
 * Governs blur, opacity, border intensity, and specular lighting for frosted panels.
 */
export const glassVariants = {
  subtle: {
    blur: '12px',
    opacity: '0.5',
    borderOpacity: '0.15',
    background: 'var(--bg-secondary)',
    saturate: '130%',
  },
  moderate: {
    blur: '16px',
    opacity: '0.7',
    borderOpacity: '0.25',
    background: 'var(--bg-secondary)',
    saturate: '140%',
  },
  intense: {
    blur: '24px',
    opacity: '0.85',
    borderOpacity: '0.35',
    background: 'var(--bg-secondary)',
    saturate: '150%',
  },
  glossy: {
    blur: '20px',
    opacity: '0.75',
    borderOpacity: '0.4',
    background: 'rgba(255, 255, 255, 0.72)',
    saturate: '145%',
    sheen: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.8)',
  },
} as const;

export type GlassVariant = keyof typeof glassVariants;

/**
 * Canonical taskbar-derived liquid-glass + golden steel branding tokens.
 * Mirrors the bottom taskbar surface (`liquid-glass-light gold-steel-border gold-steel-border-slim`)
 * so forms, panels, and floating bars inherit uniform transparency, blur, and gold trim.
 */
export const glassSurfaceBranding = {
  taskbarTemplate: {
    classes:
      'liquid-glass-light gold-steel-border gold-steel-border-slim border border-white/25 bg-[var(--material-ultra-thin)] shadow-diffusion-sm backdrop-blur-md',
    background: 'var(--material-ultra-thin)',
    border: 'rgba(255, 255, 255, 0.25)',
    blur: '12px',
    shadow: 'var(--shadow-diffusion-sm)',
    goldBorderClass: 'gold-steel-border gold-steel-border-slim',
  },
  goldSteelTrim: {
    className: 'gold-steel-border gold-steel-border-slim',
    widthSlim: '1.75px',
    widthDefault: '2.25px',
    animation: 'gold-trim-shine 4.2s ease-in-out infinite',
  },
} as const;
