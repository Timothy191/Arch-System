import { cn } from '../lib/utils';

export const ARCH_LOGO_VIEWBOX = '0 0 172.61 172.61';

export const ARCH_LOGO_PATH =
  'M86.31 0 55.25 31.05 0 86.31l55.25 55.25L86.31 172.61l31.05-31.05L172.61 86.31 117.36 31.05 86.31 0Zm0 31.05 25.19 25.2-25.19 25.19L61.12 56.25 86.31 31.05ZM31.05 86.31l25.2-25.19 25.19 25.19-25.19 25.2-25.2-25.2Zm55.26 55.26-25.19-25.2 25.19-25.19 25.19 25.19-25.19 25.2Z';

interface LogoProps {
  className?: string;
  variant?: 'default' | 'focus' | 'gold';
}

export function Logo({ className, variant: _variant = 'default' }: LogoProps) {
  // AGENT-TRACE: Vector logo rendering the official Arch OS scalable symbol in canonical Metallic Gold (--accent-gold / #d4af37)
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={ARCH_LOGO_VIEWBOX}
      className={cn('fill-current text-accent-gold', className)}
      aria-hidden="true"
    >
      <path d={ARCH_LOGO_PATH} fillRule="evenodd" />
    </svg>
  );
}

const ARCH_LOGO_BADGE_SIZES = {
  xs: { box: 'h-5 w-5', mark: 'h-3 w-3' },
  sm: { box: 'h-8 w-8', mark: 'h-4 w-4' },
  md: { box: 'h-10 w-10', mark: 'h-5 w-5' },
  lg: { box: 'h-12 w-12', mark: 'h-7 w-7' },
} as const;

export type ArchLogoBadgeSize = keyof typeof ARCH_LOGO_BADGE_SIZES;

interface ArchLogoBadgeProps {
  /** Canonical circular gold badge used everywhere the Arch mark appears. */
  size?: ArchLogoBadgeSize;
  className?: string;
  logoClassName?: string;
  testId?: string;
}

export function ArchLogoBadge({
  size = 'md',
  className,
  logoClassName,
  testId,
}: ArchLogoBadgeProps) {
  const scale = ARCH_LOGO_BADGE_SIZES[size];
  return (
    <span
      data-testid={testId}
      aria-hidden="true"
      className={cn(
        'gold-steel-border gold-steel-border-slim relative inline-flex shrink-0 items-center justify-center rounded-full border border-accent-gold/45 bg-white/95 text-accent-gold shadow-diffusion-sm',
        scale.box,
        className
      )}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_22%,rgba(255,255,255,0.95),transparent_62%)]"
      />
      <Logo className={cn('relative', scale.mark, logoClassName)} />
    </span>
  );
}
