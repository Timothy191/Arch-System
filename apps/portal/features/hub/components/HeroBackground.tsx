"use client";

import { useFocusMode } from "@/hooks/useFocusMode";

export function HeroBackground() {
  const { enabled } = useFocusMode();

  if (enabled) return null;

  return (
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden isolate"
      aria-hidden="true"
    >
      {/* Light ambient base */}
      <div className="absolute inset-0 bg-slate-50" />

      {/* Large ambient blob — top-left */}
      <div
        className="absolute -top-16 -left-16 sm:-top-20 sm:-left-20 w-56 h-56 sm:w-72 sm:h-72 md:w-80 md:h-80 lg:w-[28rem] lg:h-[28rem] xl:w-[32rem] xl:h-[32rem] rounded-full bg-slate-200/30 blur-3xl will-change-transform motion-reduce:opacity-0 animate-blob-in"
        style={{ transform: "translateZ(0)" }}
      />

      {/* Large ambient blob — bottom-right */}
      <div
        className="absolute -bottom-16 -right-16 sm:-bottom-20 sm:-right-20 w-48 h-48 sm:w-64 sm:h-64 md:w-72 md:h-72 lg:w-[26rem] lg:h-[26rem] xl:w-[28rem] xl:h-[28rem] rounded-full bg-slate-300/20 blur-3xl will-change-transform motion-reduce:opacity-0 animate-blob-in"
        style={{ transform: "translateZ(0)", animationDelay: "0.4s" }}
      />
    </div>
  );
}
