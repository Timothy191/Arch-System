import { cn } from "../lib/utils";

interface EveLogoProps {
  className?: string;
}

/**
 * Official eve wordmark from the Geist brand assets (vercel.com/geist/brands).
 * Rendered verbatim from the official SVG — do not modify the paths.
 * Brand rule: the mark is always referred to as lowercase "eve".
 */
export function EveLogo({ className }: EveLogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 169 53"
      className={cn("fill-current", className)}
      role="img"
      aria-label="eve"
    >
      <path d="M169 8.47h-51.39L81.73 53H70.36L113 0H169zM169 44.51v8.47h-45.87V44.5zM45.87 52.98H0V44.5h45.87zM38.66 30.55H0v-8.47h38.66z" />
      <path d="M169 30.55h-38.66v-8.47H169zM75.52 8.47H0V0h75.52z" />
    </svg>
  );
}
