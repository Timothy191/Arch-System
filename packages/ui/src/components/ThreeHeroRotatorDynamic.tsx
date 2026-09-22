"use client";

import dynamic from "next/dynamic";
import type { HeroRotatorProps } from "./HeroRotator";

// AGENT-TRACE: Dynamic client-only wrapper for ThreeHeroRotator.
// Prevents Three.js and WebGL Canvas (~600KB bundle) from executing during Next.js SSR passes.
const ThreeHeroRotatorInner = dynamic(
  () => import("./ThreeHeroRotator").then((mod) => mod.ThreeHeroRotator),
  {
    ssr: false,
    loading: () => (
      <div
        className="relative w-full rounded-2xl bg-black/[0.02] border border-black/5 flex items-center justify-center animate-pulse"
        style={{ height: "520px" }}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-[var(--accent-blue)] border-t-transparent animate-spin" />
          <span className="text-xs font-mono text-[var(--text-muted)] tracking-wider">
            INITIALIZING 3D TELEMETRY...
          </span>
        </div>
      </div>
    ),
  },
);

export function ThreeHeroRotatorDynamic(props: HeroRotatorProps) {
  return <ThreeHeroRotatorInner {...props} />;
}
