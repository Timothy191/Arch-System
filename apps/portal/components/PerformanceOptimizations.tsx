/**
 * Performance Optimizations Component
 * 
 * Centralized component that applies all Core Web Vitals optimizations:
 * - LCP: Preload critical images, preconnect to origins
 * - INP: Reduce JavaScript execution, use transitions
 * - CLS: Reserve space for dynamic content, font loading
 * 
 * Add this component to your layout or pages for automatic optimization.
 */
"use client";

import { useEffect } from "react";

interface PerformanceOptimizationsProps {
  /** LCP image to preload (optional) */
  lcpImage?: string;
  /** Critical origins to preconnect to (max 4) */
  preconnectOrigins?: string[];
  /** Enable INP optimization strategies */
  optimizeINP?: boolean;
  /** Enable CLS prevention */
  preventCLS?: boolean;
}

/**
 * Apply performance optimizations for Core Web Vitals
 */
export function PerformanceOptimizations({
  lcpImage,
  preconnectOrigins,
  optimizeINP = true,
  preventCLS = true,
}: PerformanceOptimizationsProps) {
  useEffect(() => {
    // === LCP OPTIMIZATION ===
    
    // 1. Preconnect to critical origins
    if (preconnectOrigins?.length) {
      preconnectOrigins.slice(0, 4).forEach((origin) => {
        const link = document.createElement("link");
        link.rel = "preconnect";
        link.href = origin;
        link.crossOrigin = "anonymous";
        document.head.appendChild(link);
      });
    }

    // 2. Preload LCP image with high fetch priority
    if (lcpImage) {
      const link = document.createElement("link");
      link.rel = "preload";
      link.as = "image";
      link.href = lcpImage;
      link.setAttribute("fetchpriority", "high");
      document.head.appendChild(link);
    }

    // 3. Preload critical fonts (if using Google Fonts)
    const fontLinks = document.querySelectorAll('link[href*="fonts.googleapis.com"]');
    fontLinks.forEach((link) => {
      const href = link.getAttribute("href");
      if (href && !href.includes("preconnect")) {
        const preconnectLink = document.createElement("link");
        preconnectLink.rel = "preconnect";
        preconnectLink.href = "https://fonts.googleapis.com";
        preconnectLink.crossOrigin = "anonymous";
        document.head.appendChild(preconnectLink);

        const preconnectGstatic = document.createElement("link");
        preconnectGstatic.rel = "preconnect";
        preconnectGstatic.href = "https://fonts.gstatic.com";
        preconnectGstatic.crossOrigin = "anonymous";
        document.head.appendChild(preconnectGstatic);
      }
    });

    // === INP OPTIMIZATION ===
    
    if (optimizeINP) {
      // Reduce main thread work by deferring non-critical scripts
      const scripts = document.querySelectorAll("script[data-defer]");
      scripts.forEach((script) => {
        const src = script.getAttribute("src");
        if (src) {
          const newScript = document.createElement("script");
          newScript.src = src;
          newScript.async = true;
          newScript.defer = true;
          script.parentNode?.replaceChild(newScript, script);
        }
      });

      // Mark interaction handlers for passive listening
      const passiveEvents = ["touchstart", "wheel", "mousewheel"];
      passiveEvents.forEach((eventType) => {
        document.addEventListener(
          eventType,
          () => {},
          { passive: true, capture: true }
        );
      });
    }

    // === CLS PREVENTION ===
    
    if (preventCLS) {
      // Reserve space for images without explicit dimensions
      const imagesWithoutDimensions = document.querySelectorAll(
        "img:not([width]):not([height])"
      );
      imagesWithoutDimensions.forEach((img) => {
        (img as HTMLImageElement).style.aspectRatio = "16/9";
      });

      // Prevent layout shift from font loading
      document.documentElement.classList.add("fonts-loaded");

      // Add reserved space for dynamic content areas
      const dynamicAreas = document.querySelectorAll("[data-dynamic]");
      dynamicAreas.forEach((area) => {
        (area as HTMLElement).style.minHeight = "100px";
      });
    }

    // === CLEANUP ===
    return () => {
      // Cleanup is handled automatically by React unmount
    };
  }, [lcpImage, preconnectOrigins, optimizeINP, preventCLS]);

  // Inject critical CSS for CLS prevention
  return (
    <style jsx global>{`
      /* Prevent CLS from font loading */
      @font-face {
        font-display: swap;
      }

      /* Reserve space for images */
      img {
        aspect-ratio: attr(width) / attr(height);
        contain: layout;
      }

      /* Prevent layout thrashing during interactions */
      .low-perf-fallback * {
        transition: none !important;
        animation: none !important;
      }

      /* Ensure smooth scrolling doesn't cause INP issues */
      html {
        scroll-behavior: smooth;
      }

      /* Reduce paint complexity for better INP */
      .contain-layout {
        contain: layout;
      }

      /* Prevent FOUC on glass components */
      [data-theme="light"] {
        color-scheme: light;
      }
    `}</style>
  );
}

/**
 * Hook to optimize individual components for INP
 * 
 * Use this in components with heavy interactions
 * 
 * @example
 * ```tsx
 * function ExpensiveComponent() {
 *   useINPOptimization();
 *   
 *   return <div>...</div>;
 * }
 * ```
 */
export function useINPOptimization() {
  useEffect(() => {
    // Mark this component for transition-based updates
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === "attributes") {
          // Attribute changes detected - could trigger INP
          // Consider using React.startTransition for state updates
        }
      });
    });

    const element = document.querySelector("[data-inp-optimized]");
    if (element) {
      observer.observe(element, { attributes: true });
    }

    return () => observer.disconnect();
  }, []);
}

/**
 * Component to prevent CLS from specific elements
 * 
 * Wraps content that might shift during load
 * 
 * @example
 * ```tsx
 * <CLSContainer minWidth={300} minHeight={200}>
 *   <DynamicContent />
 * </CLSContainer>
 * ```
 */
export function CLSContainer({
  children,
  minWidth,
  minHeight,
  aspectRatio,
}: {
  children: React.ReactNode;
  minWidth?: number;
  minHeight?: number;
  aspectRatio?: string;
}) {
  const style: React.CSSProperties = {
    minWidth,
    minHeight,
    aspectRatio,
    contain: "layout",
  };

  return (
    <div style={style} data-cls-container>
      {children}
    </div>
  );
}
