import Image from "next/image";
import type { ReactNode } from "react";
import { cn } from "@repo/ui/lib/utils";

interface ErrorFullscreenProps {
  children: ReactNode;
  className?: string;
}

/** Full-viewport error surface — graphic fills screen; content overlays center. */
export function ErrorFullscreen({ children, className }: ErrorFullscreenProps) {
  return (
    <div
      className={cn(
        "error-fullscreen fixed inset-0 z-[250] flex min-h-[100dvh] w-full flex-col overflow-hidden bg-[var(--bg-primary)]",
        className,
      )}
    >
      <Image
        src="/error-pages/404-error.png"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover"
        aria-hidden
      />
      <div className="absolute inset-0 bg-[var(--bg-primary)]/35" aria-hidden />
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center p-6 text-center">
        <div className="w-full max-w-lg space-y-6 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)]/88 px-6 py-8 shadow-window backdrop-blur-md">
          {children}
        </div>
      </div>
    </div>
  );
}
