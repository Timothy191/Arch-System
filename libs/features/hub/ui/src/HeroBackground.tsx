'use client';

export function HeroBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[2rem]"
    >
      <div className="absolute -left-24 top-8 h-64 w-64 rounded-full bg-[var(--accent-blue)]/[0.08] blur-3xl motion-safe:animate-[float-slow_14s_ease-in-out_infinite]" />
      <div className="absolute -right-20 top-24 h-72 w-72 rounded-full bg-accent-green/[0.07] blur-3xl motion-safe:animate-[float-delayed_18s_ease-in-out_infinite]" />
      <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(15,23,42,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.045)_1px,transparent_1px)] [background-size:32px_32px] [mask-image:linear-gradient(to_bottom,black,transparent_82%)] motion-safe:animate-[grid-drift_24s_linear_infinite]" />
      <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[var(--accent-blue)]/30 to-transparent" />
    </div>
  );
}
