/**
 * LCP Observer Component
 *
 * Tracks Largest Contentful Paint element and provides debugging information
 * in development mode. Helps identify what element is considered the LCP.
 *
 * @see https://web.dev/lcp
 */
"use client";

import { useEffect, useRef, useState } from "react";

interface LCPElement {
  element: Element;
  startTime: number;
  size: number;
  tagName: string;
  id?: string;
  className?: string;
  text?: string;
  imageUrl?: string;
}

export function LCPObserver() {
  const [lcpElement, setLcpElement] = useState<LCPElement | null>(null);
  const [isDev, setIsDev] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [mounted, setMounted] = useState(false);
  // AGENT-TRACE: Ref to the diagnostic panel root. Used to exclude the panel's own
  // DOM subtree from LCP detection so the observer never self-classifies as LCP.
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // AGENT-TRACE: Delay mounting the HUD UI by 5 seconds to guarantee
    // the observer diagnostic elements aren't painted during the critical LCP window,
    // preventing the tip box from self-classifying as LCP.
    const timer = setTimeout(() => {
      setMounted(true);
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const dev = process.env.NODE_ENV === "development";
    setIsDev(dev);

    // AGENT-TRACE: Guard PerformanceObserver behind isDev to avoid
    // running observer setup + callback logic in production.
    if (!dev || typeof PerformanceObserver === "undefined") return;

    const observer = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      const lastEntry = entries[entries.length - 1];
      const entry = lastEntry as any;
      if (!entry || !entry.element) return;

      const element = entry.element;

      // AGENT-TRACE: Self-classification guard — ignore LCP entries that originate
      // from the observer's own floating panel. Without this, the diagnostic UI's
      // tip text (mounted 5s after hydration) becomes the page's reported LCP on
      // slow-hydrating pages, masking the real content's LCP.
      if (panelRef.current?.contains(element)) return;

      const lcpData: LCPElement = {
        element,
        startTime: entry.startTime,
        size: entry.size || 0,
        tagName: element.tagName.toLowerCase(),
        id: element.id || undefined,
        className: element.getAttribute("class") || undefined,
        text: element.textContent?.slice(0, 100).trim(),
        imageUrl:
          (element as HTMLImageElement).src ||
          (element as HTMLImageElement).currentSrc ||
          element.style.backgroundImage?.match(/url\(["']?(.*?)["']?\)/)?.[1],
      };

      setLcpElement(lcpData);

      // Debug logging in development
      if (process.env.NODE_ENV === "development") {
        // eslint-disable-next-line no-console
        console.group("📊 LCP Detected");
        // eslint-disable-next-line no-console
        console.log("Element:", lcpData.tagName, lcpData.id ? `#${lcpData.id}` : "");
        // eslint-disable-next-line no-console
        console.log("Time:", lcpData.startTime.toFixed(0), "ms");
        // eslint-disable-next-line no-console
        console.log("Size:", lcpData.size, "px²");
        // eslint-disable-next-line no-console
        console.log("Class:", lcpData.className);
        if (lcpData.text) {
          // eslint-disable-next-line no-console
          console.log("Text:", lcpData.text);
        }
        if (lcpData.imageUrl) {
          // eslint-disable-next-line no-console
          console.log("Image URL:", lcpData.imageUrl);
        }
        // eslint-disable-next-line no-console
        console.log("Element:", element);
        // eslint-disable-next-line no-console
        console.groupEnd();

        // Highlight the LCP element
        setTimeout(() => {
          highlightLCPElement(element);
        }, 2000);
      }
    });

    observer.observe({ type: "largest-contentful-paint", buffered: true });

    return () => observer.disconnect();
  }, []);

  // Visual highlight for LCP element (development only)
  function highlightLCPElement(element: Element) {
    const originalOutline = (element as HTMLElement).style.outline;
    (element as HTMLElement).style.outline = "4px solid #ff00ff";
    (element as HTMLElement).style.outlineOffset = "2px";

    setTimeout(() => {
      (element as HTMLElement).style.outline = originalOutline;
    }, 3000);
  }

  if (!isDev || !lcpElement || !mounted) return null;

  if (isMinimized) {
    return (
      <div ref={panelRef} className="fixed bottom-4 right-4 z-[9999]">
        <button
          onClick={() => setIsMinimized(false)}
          className="bg-[var(--arch0)] text-white px-3 py-1.5 rounded-full text-xs font-mono border border-[var(--accent-blue)] shadow-lg flex items-center gap-1.5 hover:bg-[var(--arch1)] transition-colors"
          title="Expand LCP Observer"
        >
          📊 LCP:{" "}
          <span
            className={
              lcpElement.startTime < 2500
                ? "text-[var(--accent-green)]"
                : "text-[var(--accent-red)]"
            }
          >
            {lcpElement.startTime.toFixed(0)}ms
          </span>
        </button>
      </div>
    );
  }

  return (
    <div
      ref={panelRef}
      className="fixed bottom-4 right-4 z-[9999] bg-[var(--arch0)] text-white p-4 rounded-lg shadow-lg border-2 border-[var(--accent-blue)] max-w-md"
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-bold text-lg">📊 LCP Element Detected</h3>
        <button
          onClick={() => setIsMinimized(true)}
          className="text-xs text-[var(--text-secondary)] hover:text-white px-2 py-0.5 rounded border border-white/10"
          title="Minimize overlay"
        >
          Minimize
        </button>
      </div>
      <div className="space-y-1 text-sm font-mono">
        <div>
          <span className="text-[var(--text-secondary)]">Tag:</span>{" "}
          <span className="text-[var(--accent-blue)]">{lcpElement.tagName}</span>
        </div>
        {lcpElement.id && (
          <div>
            <span className="text-[var(--text-secondary)]">ID:</span>{" "}
            <span className="text-[var(--accent-yellow)]">#{lcpElement.id}</span>
          </div>
        )}
        {lcpElement.className && (
          <div className="truncate">
            <span className="text-[var(--text-secondary)]">Class:</span>{" "}
            <span className="text-[var(--accent-green)]">{lcpElement.className}</span>
          </div>
        )}
        <div>
          <span className="text-[var(--text-secondary)]">Time:</span>{" "}
          <span
            className={
              lcpElement.startTime < 2500
                ? "text-[var(--accent-green)]"
                : "text-[var(--accent-red)]"
            }
          >
            {lcpElement.startTime.toFixed(0)}ms
          </span>
        </div>
        <div>
          <span className="text-[var(--text-secondary)]">Size:</span>{" "}
          <span className="text-white">{lcpElement.size.toLocaleString()} px²</span>
        </div>
        {lcpElement.imageUrl && (
          <div className="truncate">
            <span className="text-[var(--text-secondary)]">Image:</span>{" "}
            <span className="text-[var(--accent-purple)] truncate block">
              {lcpElement.imageUrl}
            </span>
          </div>
        )}
      </div>
      <p className="text-xs text-[var(--text-secondary)] mt-3">
        💡 Tip: Make this element load faster by preloading resources or optimizing rendering
      </p>
    </div>
  );
}
