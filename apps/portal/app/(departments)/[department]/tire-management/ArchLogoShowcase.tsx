'use client';

/* cspell:ignore monoline */

import { Logo } from '@repo/ui/Logo';
import { cn } from '@repo/ui/lib/utils';
import { m, useReducedMotion } from 'framer-motion';

const PALETTE = [
  {
    name: 'Metallic Gold',
    token: '--accent-gold',
    swatch: 'bg-[var(--accent-gold)]',
    role: 'Primary accent, selection and brand signature',
  },
  {
    name: 'Deep Ink',
    token: '--text-heading',
    swatch: 'bg-[var(--text-heading)]',
    role: 'Headings and glyph mass',
  },
  {
    name: 'Steel Mist',
    token: '--text-muted',
    swatch: 'bg-[var(--text-muted)]',
    role: 'Secondary labels and captions',
  },
  {
    name: 'Glass White',
    token: '--material-ultra-thin',
    swatch: 'bg-white',
    role: 'Surfaces, clear space and highlights',
  },
] as const;

const MOTION_SPECS = [
  { label: 'Entrance', value: '420 ms · cubic-bezier(0.22, 1, 0.36, 1)' },
  { label: 'Hover lift', value: '180 ms · ease-out · translateY(-2 px)' },
  { label: 'Halo pulse', value: '3.6 s · ease-in-out · opacity 0.25 ↔ 0.55' },
  { label: 'Reduced motion', value: 'Transforms and loops disabled via useReducedMotion' },
] as const;

const GUIDELINES = [
  'Clear space: keep 0.5× the glyph height on all sides.',
  'Minimum size: 24 px digital, 10 mm print.',
  'Pair the glyph with “Arch System” in semibold, sentence case.',
  'Never rotate, stretch, or recolor the glyph outside the gold palette.',
] as const;

export interface ArchLogoShowcaseProps {
  readonly className?: string;
}

/**
 * Brand presentation for the Arch System mark.
 *
 * Motion contract (all transform/opacity only — no layout animation):
 * - Entrance: 420 ms, cubic-bezier(0.22, 1, 0.36, 1), 80 ms stagger between blocks.
 * - Hover lift: 180 ms ease-out, translateY(-2 px) on the logo tile.
 * - Halo pulse: 3.6 s ease-in-out opacity loop, 0.25 ↔ 0.55.
 * - Reduced motion: every transform and infinite loop is skipped.
 */
export function ArchLogoShowcase({ className }: ArchLogoShowcaseProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section
      data-testid="arch-logo-showcase"
      aria-labelledby="arch-logo-showcase-title"
      className={cn(
        'gold-steel-border gold-steel-border-slim rounded-xl border border-white/40 bg-white/60 p-4',
        className
      )}
    >
      <div className="grid grid-cols-1 gap-5 md:grid-cols-[176px_1fr]">
        <m.div
          initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
          whileHover={prefersReducedMotion ? undefined : { y: -2 }}
          className="relative flex flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border border-[var(--accent-gold)]/30 bg-white p-4"
        >
          <m.span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-xl bg-[var(--accent-gold)]/10"
            animate={
              prefersReducedMotion
                ? undefined
                : { opacity: [0.25, 0.55, 0.25], scale: [1, 1.06, 1] }
            }
            transition={{ duration: 3.6, ease: 'easeInOut', repeat: Number.POSITIVE_INFINITY }}
          />
          <m.div
            className="relative"
            initial={prefersReducedMotion ? false : { rotate: -8, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            transition={{ duration: 0.42, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
          >
            <Logo className="h-20 w-20 drop-shadow-sm" />
          </m.div>
          <span className="relative font-bold text-[var(--text-heading)] text-sm tracking-tight">
            Arch System
          </span>
          <span className="relative text-[11px] text-[var(--text-muted)] uppercase tracking-widest">
            Plantcor
          </span>
        </m.div>

        <div className="space-y-3">
          <div>
            <h3
              id="arch-logo-showcase-title"
              className="font-bold text-[var(--text-heading)] text-base"
            >
              Arch System identity
            </h3>
            <p className="mt-1 text-[var(--text-secondary)] text-xs leading-relaxed">
              The glyph is a monoline arch rising from a mine-bench baseline — an A-frame portal
              drawn in a single continuous stroke. It reads as both an archway and a haul-road
              ascent, reflecting the platform’s role connecting fleet, plant, and shift data.
            </p>
          </div>

          <ul className="grid grid-cols-2 gap-2" aria-label="Arch System brand palette">
            {PALETTE.map((entry, index) => (
              <m.li
                key={entry.name}
                initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.32,
                  delay: 0.08 * index,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="flex items-center gap-2 rounded-lg border border-[var(--border-default)] bg-white px-2 py-1.5"
              >
                <span
                  aria-hidden="true"
                  className={cn('h-5 w-5 shrink-0 rounded-md border border-black/10', entry.swatch)}
                />
                <span className="min-w-0">
                  <span className="block font-semibold text-[11px] text-[var(--text-heading)]">
                    {entry.name}
                  </span>
                  <span className="block truncate font-mono text-[10px] text-[var(--text-muted)]">
                    {entry.token}
                  </span>
                </span>
              </m.li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 border-[var(--border-default)] border-t pt-3 md:grid-cols-2">
        <div>
          <h4 className="mb-1.5 font-semibold text-[11px] text-[var(--text-secondary)] uppercase tracking-wider">
            Usage guidelines
          </h4>
          <ul className="space-y-1 text-[11px] text-[var(--text-secondary)] leading-relaxed">
            {GUIDELINES.map((guideline) => (
              <li key={guideline} className="flex gap-1.5">
                <span aria-hidden="true" className="text-[var(--accent-gold)]">
                  •
                </span>
                <span>{guideline}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="mb-1.5 font-semibold text-[11px] text-[var(--text-secondary)] uppercase tracking-wider">
            Motion specification
          </h4>
          <dl className="grid grid-cols-1 gap-1 text-[11px]">
            {MOTION_SPECS.map((spec) => (
              <div key={spec.label} className="flex items-baseline justify-between gap-2">
                <dt className="text-[var(--text-muted)]">{spec.label}</dt>
                <dd className="font-mono text-[10px] text-[var(--text-secondary)]">{spec.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
