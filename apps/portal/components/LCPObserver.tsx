/**
 * LCP Observer Component
 * 
 * Tracks Largest Contentful Paint element and provides debugging information
 * in development mode. Helps identify what element is considered the LCP.
 * 
 * @see https://web.dev/lcp
 */
"use client";

import { useEffect, useState } from "react";

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

  useEffect(() => {
    setIsDev(process.env.NODE_ENV === "development");
    
    if (typeof PerformanceObserver === "undefined") return;

    const observer = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      const lastEntry = entries[entries.length - 1];
      const entry = lastEntry as any;
      if (!entry || !entry.element) return;

      const element = entry.element;
      const lcpData: LCPElement = {
        element,
        startTime: entry.startTime,
        size: entry.size || 0,
        tagName: element.tagName.toLowerCase(),
        id: element.id || undefined,
        className: element.getAttribute("class") || undefined,
        text: element.textContent?.slice(0, 100).trim(),
        imageUrl: (element as HTMLImageElement).src || 
                  (element as HTMLImageElement).currentSrc ||
                  (element.style.backgroundImage?.match(/url\(["']?(.*?)["']?\)/)?.[1]),
      };

      setLcpElement(lcpData);

      // Debug logging in development
      if (isDev) {
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
        highlightLCPElement(element);
      }
    });

    observer.observe({ type: "largest-contentful-paint", buffered: true });

    return () => observer.disconnect();
  }, [isDev]);

  // Visual highlight for LCP element (development only)
  function highlightLCPElement(element: Element) {
    const originalOutline = (element as HTMLElement).style.outline;
    (element as HTMLElement).style.outline = "4px solid #ff00ff";
    (element as HTMLElement).style.outlineOffset = "2px";
    
    setTimeout(() => {
      (element as HTMLElement).style.outline = originalOutline;
    }, 3000);
  }

  if (!isDev || !lcpElement) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] bg-[var(--arch0)] text-white p-4 rounded-lg shadow-2xl border-2 border-[var(--accent-blue)] max-w-md">
      <h3 className="font-bold text-lg mb-2">📊 LCP Element Detected</h3>
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
          <span className={lcpElement.startTime < 2500 ? "text-[var(--accent-green)]" : "text-[var(--accent-red)]"}>
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
            <span className="text-[var(--accent-purple)] truncate block">{lcpElement.imageUrl}</span>
          </div>
        )}
      </div>
      <p className="text-xs text-[var(--text-secondary)] mt-3">
        💡 Tip: Make this element load faster by preloading resources or optimizing rendering
      </p>
    </div>
  );
}

/**
 * Preload LCP image helper
 * 
 * Call this in your layout or page component to ensure the LCP image
 * is discovered early by the browser.
 * 
 * @example
 * ```tsx
 * // In layout.tsx or page.tsx
 * preloadLCPImage("/hero.webp");
 * 
 * function Page() {
 *   return <img src="/hero.webp" priority alt="Hero" />;
 * }
 * ```
 */
export function preloadLCPImage(src: string, as: "image" | "fetch" | "style" = "image") {
  if (typeof document === "undefined") return;
  
  const link = document.createElement("link");
  link.rel = "preload";
  link.as = as;
  link.href = src;
  
  if (as === "image") {
    link.setAttribute("fetchpriority", "high");
    link.setAttribute("imagesizes", "(max-width: 768px) 100vw, 1200px");
  }
  
  document.head.appendChild(link);
}

/**
 * Preconnect to critical origins
 * 
 * Use this for origins that serve your LCP resources (CDN, image host, etc.)
 * Limit to 4 most important origins to avoid connection overhead.
 * 
 * @example
 * ```tsx
 * // In layout.tsx
 * preconnectToOrigins([
 *   "https://cdn.example.com",
 *   "https://fonts.googleapis.com",
 *   "https://your-supabase-url.supabase.co"
 * ]);
 * ```
 */
export function preconnectToOrigins(origins: string[]) {
  if (typeof document === "undefined") return;
  
  origins.slice(0, 4).forEach((origin) => {
    const link = document.createElement("link");
    link.rel = "preconnect";
    link.href = origin;
    link.crossOrigin = "anonymous";
    document.head.appendChild(link);
  });
}
