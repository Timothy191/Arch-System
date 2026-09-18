"use client";

import { cn } from "@repo/ui/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, X } from "lucide-react";
import { useEffect, useState } from "react";

export function BrowserCompatibilityBanner() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if running on client
    if (typeof window === "undefined") return;

    // Detect Chromium-based browsers (Chrome, Edge, Brave, etc.)
    // Note: Firefox does not have window.chrome, Safari does not have it (unless spoofing).
    const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
    const isChromiumBrowser = !!(window as any).chrome || isChrome;

    if (isChromiumBrowser) {
      // Only show if they haven't dismissed it this session
      const dismissed = sessionStorage.getItem("arch-chromium-warning-dismissed");
      if (!dismissed) {
        setIsVisible(true);
      }

      // Optionally add a class to the body to disable heavy filters if needed
      document.body.classList.add("is-chromium");
    }
  }, []);

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -50 }}
        className={cn(
          "fixed top-20 left-1/2 -translate-x-1/2 z-[100] max-w-lg w-[calc(100%-2rem)]",
          "p-4 rounded-xl border shadow-xl flex gap-3",
          "bg-amber-50/95 border-amber-200 text-amber-900",
          "backdrop-blur-md"
        )}
      >
        <AlertCircle className="w-5 h-5 shrink-0 text-amber-600 mt-0.5" />
        <div className="flex-1">
          <h3 className="text-sm font-semibold mb-1">Performance Notice</h3>
          <p className="text-[13px] leading-relaxed opacity-90">
            It looks like you're using a Chromium-based browser. Some of our advanced blur effects
            and rendering (like the Liquid Glass styling) may cause performance drops or visual lag
            on Chromium. For the smoothest experience, we recommend using Safari or Firefox.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setIsVisible(false);
            sessionStorage.setItem("arch-chromium-warning-dismissed", "true");
          }}
          className="shrink-0 p-1 rounded-md hover:bg-amber-900/10 transition-colors h-fit text-amber-700"
          title="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
