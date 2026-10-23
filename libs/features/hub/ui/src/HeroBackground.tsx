'use client';

export function HeroBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[2rem]"
    >
      <div className="absolute top-8 -left-24 h-64 w-64 rounded-full bg-[var(--accent-blue)]/[0.04] blur-3xl motion-safe:animate-[float-slow_14s_ease-in-out_infinite]" />
      <div className="absolute top-24 -right-20 h-72 w-72 rounded-full bg-accent-green/[0.04] blur-3xl motion-safe:animate-[float-delayed_18s_ease-in-out_infinite]" />
      <div className="absolute inset-0 opacity-15 [background-image:linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] [background-size:32px_32px] [mask-image:linear-gradient(to_bottom,black,transparent_82%)] motion-safe:animate-[grid-drift_24s_linear_infinite]" />
      <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[var(--accent-blue)]/35 to-transparent" />
    </div>
  );
}
