/* cspell:ignore Tyre */

export interface TyreArtworkProps {
  readonly variant: 'worn' | 'new';
  readonly className?: string;
}

const NEW_TREAD_COUNT = 28;
const WORN_TREAD_COUNT = 16;

/**
 * Dependency-free SVG tyre illustration used by the Tyre Off / Tyre On column
 * group headers. A worn tyre shows fewer, shallower tread blocks; a new tyre
 * adds a gold sidewall ring so the two sides read apart at a glance.
 */
export function TyreArtwork({ variant, className }: TyreArtworkProps) {
  const isWorn = variant === 'worn';
  const treadCount = isWorn ? WORN_TREAD_COUNT : NEW_TREAD_COUNT;
  const treadHeight = isWorn ? 5 : 9;

  return (
    <svg
      viewBox="0 0 96 96"
      role="img"
      aria-label={isWorn ? 'Worn tyre removed from machine' : 'Replacement tyre mounted to machine'}
      className={className}
    >
      <circle cx="48" cy="48" r="45" className="fill-[var(--text-heading)]" />
      <circle
        cx="48"
        cy="48"
        r="34"
        className={isWorn ? 'fill-[var(--text-secondary)]' : 'fill-[var(--bg-secondary)]'}
      />
      {Array.from({ length: treadCount }, (_, index) => (
        <rect
          key={`${variant}-tread-${index}`}
          x="45.5"
          y="2.5"
          width="5"
          height={treadHeight}
          rx="1.5"
          transform={`rotate(${(360 / treadCount) * index} 48 48)`}
          className={isWorn ? 'fill-[var(--text-muted)]' : 'fill-[var(--accent-gold)]'}
        />
      ))}
      <circle
        cx="48"
        cy="48"
        r="20"
        className="fill-[var(--bg-secondary)] stroke-[var(--border-default)]"
        strokeWidth="2"
      />
      <circle cx="48" cy="48" r="7" className="fill-[var(--text-muted)]" />
      {!isWorn && (
        <circle
          cx="48"
          cy="48"
          r="39"
          strokeOpacity="0.7"
          className="fill-none stroke-[var(--accent-gold)]"
          strokeWidth="1.5"
        />
      )}
    </svg>
  );
}
