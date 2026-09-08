"use client";

import { cn } from "@repo/ui/lib/utils";
import { type JSX, useEffect, useRef, useState } from "react";
import { AriaAvatar, type AriaState } from "@/components/ai/AriaAvatar";

/**
 * Aria — the operations assistant launcher. A floating button opens a compact,
 * same-origin iframe to `/assistant`, which the portal server-side proxies to
 * the aria-overlay sidecar (port 3100). While open, the Aria character renders
 * as an overlay on top of the page, anchored at the window's bottom corner, and
 * reflects live assistant state (`idle`/`thinking`/`error`) via the sidecar's
 * `aria-state` postMessage. The iframe stays mounted while hidden so the
 * conversation persists.
 */
export function AriaLauncher(): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [ariaState, setAriaState] = useState<AriaState>("idle");
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
      const data = e.data as { type?: string; state?: string } | null;
      if (!data || typeof data !== "object") return;
      if (data.type === "aria-close") {
        closePanel();
        return;
      }
      if (data.type === "aria-state") {
        // AGENT-TRACE: drive the character overlay from the sidecar's chat
        // lifecycle (submitted/streaming -> thinking, error -> error).
        const state = data.state as AriaState;
        if (["idle", "thinking", "speaking", "happy", "error"].includes(state)) {
          setAriaState(state);
        }
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

  useEffect(() => {
    if (!isOpen) setAriaState("idle");
  }, [isOpen]);

  return (
    <div className="relative">
      {mounted && (
        <div
          className={cn(
            // AGENT-TRACE: z-[110] keeps the FAB + panel above transient bottom
            // banners (e.g. consent bar at z-[100]) so they stay clickable.
            "fixed bottom-6 right-6 z-[110] transition-all duration-200",
            isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          )}
        >
          <div
            className="absolute bottom-[88px] right-0 w-[400px] h-[min(620px,70vh)] rounded-2xl overflow-hidden border border-arch-border-subtle shadow-window bg-[var(--bg-primary)] flex flex-col"
            role="dialog"
            aria-label="Aria operations assistant"
            aria-hidden={!isOpen}
          >
            <div className="flex items-center justify-between px-4 py-2 border-b border-arch-border-subtle bg-black/40 backdrop-blur-md text-xs text-white/70 shrink-0 select-none">
              <span className="font-semibold text-white/90">Aria Operations Assistant</span>
              <div className="flex items-center gap-1.5 opacity-80 hover:opacity-100 transition-opacity">
                <span className="text-[10px] text-white/50 uppercase tracking-wider font-mono">
                  Powered by
                </span>
                <img
                  src="/images/ai-sdk/ai-sdk-logotype-dark.svg"
                  alt="Vercel AI SDK"
                  className="h-3.5 w-auto object-contain dark:block hidden"
                />
                <img
                  src="/images/ai-sdk/ai-sdk-logotype-light.svg"
                  alt="Vercel AI SDK text logo"
                  className="h-3.5 w-auto object-contain dark:hidden block invert"
                />
              </div>
            </div>
            <iframe
              ref={frameRef}
              src="/assistant"
              title="Aria operations assistant"
              className="w-full flex-1 border-0"
              tabIndex={0}
              onLoad={() => isOpen && frameRef.current?.focus()}
            />
          </div>

          {isOpen && (
            <AriaAvatar
              state={ariaState}
              className="absolute bottom-0 right-0 w-20 h-20 drop-shadow-[0_4px_12px_rgba(0,0,0,0.25)]"
            />
          )}
        </div>
      )}

      {!isOpen && (
        <button
          onClick={openPanel}
          className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-gradient-to-r from-[var(--accent-blue)] to-[var(--accent-electric-blue)] text-white flex items-center justify-center drop-shadow-[0_0_8px_rgba(0,102,255,0.5)] hover:from-[var(--accent-electric-blue)] hover:to-[var(--accent-blue)] hover:scale-110 active:scale-95 transition-all duration-200 z-[110]"
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
