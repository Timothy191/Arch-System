"use client";

import { useEffect, useRef, useState, type JSX } from "react";
import { cn } from "@repo/ui/lib/utils";

/**
 * Aria — the operations assistant launcher. Renders a floating button that
 * opens a same-origin iframe to `/assistant`, which the portal server-side
 * proxies to the aria-overlay sidecar (port 3100). The iframe is mounted on
 * first open and kept mounted while hidden so the conversation persists.
 */
export function AriaLauncher(): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const frameRef = useRef<HTMLIFrameElement>(null);

  const openPanel = () => {
    setMounted(true);
    setIsOpen(true);
  };
  const closePanel = () => setIsOpen(false);

  useEffect(() => {
    function onOpenEvent() {
      openPanel();
    }
    function onMessage(e: MessageEvent) {
      const data = e.data as { type?: string } | null;
      if (data && typeof data === "object" && data.type === "aria-close") {
        closePanel();
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") closePanel();
    }

    window.addEventListener("open-ai-assistant", onOpenEvent);
    window.addEventListener("message", onMessage);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("open-ai-assistant", onOpenEvent);
      window.removeEventListener("message", onMessage);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <div className="relative">
      {mounted && (
        <div
          className={cn(
            "fixed bottom-6 right-6 z-50 transition-all duration-200",
            isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
          )}
        >
          <div
            className="w-[440px] h-[min(720px,76vh)] rounded-2xl overflow-hidden border border-arch-border-subtle shadow-window bg-[var(--bg-primary)]"
            role="dialog"
            aria-label="Aria operations assistant"
            aria-hidden={!isOpen}
          >
            <iframe
              ref={frameRef}
              src="/assistant"
              title="Aria operations assistant"
              className="w-full h-full border-0"
              tabIndex={0}
              onLoad={() => isOpen && frameRef.current?.focus()}
            />
          </div>
        </div>
      )}

      {!isOpen && (
        <button
          onClick={openPanel}
          className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-gradient-to-r from-[var(--accent-blue)] to-[var(--accent-electric-blue)] text-white flex items-center justify-center drop-shadow-[0_0_8px_rgba(0,102,255,0.5)] hover:from-[var(--accent-electric-blue)] hover:to-[var(--accent-blue)] hover:scale-110 active:scale-95 transition-all duration-200 z-50"
          aria-label="Open Aria operations assistant"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
            />
          </svg>
        </button>
      )}
    </div>
  );
}
