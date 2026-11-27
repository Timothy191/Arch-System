import { cn } from '../lib/utils';

export const ARCH_LOGO_VIEWBOX = '22.75 16.625 166.16 166.19';

export const ARCH_LOGO_PATH =
  'm 105.8125,16.625 c -7.39687,18.135158 -11.858304,29.997682 -20.09375,47.59375 5.04936,5.35232 11.247211,11.585364 21.3125,18.625 C 96.210077,78.390904 88.828713,73.920352 83.3125,69.28125 72.7727,91.274163 56.259864,122.60209 22.75,182.8125 49.087628,167.60733 69.504089,158.23318 88.53125,154.65625 87.714216,151.1422 87.2497,147.34107 87.28125,143.375 l 0.03125,-0.84375 c 0.417917,-16.87382 9.195665,-29.84979 19.59375,-28.96875 10.39809,0.88104 18.48041,15.28242 18.0625,32.15625 -0.0786,3.17512 -0.43674,6.22955 -1.0625,9.0625 18.82058,3.68164 39.01873,13.03179 65,28.03125 -5.123,-9.4318 -9.69572,-17.93388 -14.0625,-26.03125 -6.87839,-5.33121 -14.05289,-12.2698 -28.6875,-19.78125 10.05899,2.61375 17.2611,5.62932 22.875,9 C 124.63297,63.338161 121.03766,52.354109 105.8125,16.625 z';

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
