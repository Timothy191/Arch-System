import { cn } from '@repo/ui/lib/utils';
import type { Transition, Variants } from 'framer-motion';

/**
 * Shared class constants & motion presets for the Control Room excavator activity log.
 * Light-mode only, semantic tokens only; each literal stays ≤ 20 utilities.
 */

/** Field labels: darker + bolder for readability on light glass. */
export const FIELD_LABEL_CLASS =
  'flex items-center gap-1 font-semibold text-[11px] text-[var(--text-heading)] tracking-wide';

/** Numbered section headers ("1. Location & Material", …). */
export const SECTION_HEADER_CLASS =
  'block font-bold text-[11px] text-[var(--text-heading)] uppercase tracking-wider';

/** Golden-bordered section container with hover glow. */
export const SECTION_BOX_CLASS = cn(
  'gold-steel-border gold-steel-border-slim space-y-2.5 rounded-xl border border-accent-gold/55 p-3',
  'bg-[var(--bg-secondary)]/60 shadow-2xs transition-shadow duration-200',
  'hover:shadow-diffusion-sm motion-reduce:transition-none'
);

/** Golden select / input / textarea with animated focus-ring glow. */
export const GOLD_FIELD_CLASS = cn(
  'w-full rounded-lg border border-accent-gold/55 bg-white px-2.5 py-1.5 shadow-2xs',
  'font-semibold text-[var(--text-heading)] text-xs',
  'transition-[border-color,box-shadow] duration-200 motion-reduce:transition-none',
  'hover:border-accent-gold focus:border-accent-gold focus:outline-none',
  'focus:shadow-diffusion-sm focus:ring-2 focus:ring-accent-gold/35'
);

/** Excavator card: gold border, layered 3D shadow, hover lift (reduced-motion safe). */
export const EXCAVATOR_CARD_CLASS = cn(
  'gold-steel-border gold-steel-border-slim relative flex flex-col gap-3 rounded-xl border p-4',
  'border-accent-gold/60 bg-gradient-to-b from-white to-[var(--bg-secondary)] shadow-card',
  'transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-card-hover',
  'motion-reduce:transform-none motion-reduce:transition-none'
);

/** Inner top highlight line giving the card its raised, bevelled edge. */
export const CARD_TOP_HIGHLIGHT_CLASS =
  'pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-accent-gold/80 to-transparent';

/** Segmented Waste / Coal / Plant / Other selector shell. */
export const MATERIAL_SEGMENT_SHELL_CLASS = cn(
  'flex shrink-0 flex-wrap items-center gap-0.5 rounded-full border p-0.5 shadow-2xs',
  'border-accent-gold/60 bg-[var(--bg-primary)]'
);

export const MATERIAL_SEGMENT_BUTTON_CLASS = cn(
  'relative cursor-pointer rounded-full px-2.5 py-1 font-semibold text-xs',
  'transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2',
  'focus-visible:ring-accent-gold/50 motion-reduce:transition-none'
);

export const MATERIAL_SEGMENT_IDLE_TEXT =
  'text-[var(--text-secondary)] hover:text-[var(--text-heading)]';

/** Selected pill: per-material fill with a clear gold ring border. */
export const MATERIAL_PILL_ACTIVE_STYLE = {
  Waste: 'bg-[var(--accent-blue)] ring-2 ring-accent-gold shadow-xs',
  Coal: 'bg-neutral-800 ring-2 ring-accent-gold shadow-xs',
  Plant: 'bg-accent-green ring-2 ring-accent-gold shadow-xs',
  Other: 'bg-accent-amber ring-2 ring-accent-gold shadow-xs',
} as const;

export const MATERIAL_PILL_PILL_CLASS = 'absolute inset-0 rounded-full';
export const MATERIAL_PILL_ACTIVE_TEXT = 'text-white';

/** Compact machine / loads table. */
export const LOAD_TABLE_CLASS = 'w-full border-collapse text-left text-[11px]';
export const LOAD_TABLE_CAPTION_CLASS = 'sr-only';
export const LOAD_TABLE_HEAD_CELL_CLASS =
  'border-accent-gold/40 border-b px-2 py-1 font-bold text-[var(--text-heading)] uppercase tracking-wide';
export const LOAD_TABLE_CELL_CLASS =
  'border-[var(--border-default)]/50 border-b px-2 py-1 font-medium text-[var(--text-heading)]';
export const LOAD_TABLE_NUM_CELL_CLASS = 'text-right font-mono tabular-nums';
export const LOAD_TABLE_FOOT_CELL_CLASS =
  'border-accent-gold/40 border-t px-2 py-1 font-bold text-[var(--text-heading)]';
export const LOAD_TABLE_WRAPPER_CLASS =
  'overflow-hidden rounded-lg border border-accent-gold/45 bg-[var(--bg-primary)]';

/** Staggered fade-in for card sections. Opacity-only under reduced motion via MotionConfig. */
export const SECTION_STAGGER_VARIANTS: Variants = {
  hidden: { opacity: 0, y: 6 },
  visible: (index: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.28, ease: 'easeOut', delay: index * 0.07 },
  }),
};

export const PILL_SPRING: Transition = { type: 'spring', stiffness: 520, damping: 38 };
export const REDUCED_MOTION_TRANSITION: Transition = { duration: 0 };
