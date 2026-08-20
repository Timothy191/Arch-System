/**
 * Core Web Vitals Performance Analyzer
 *
 * Investigates INP (Interaction to Next Paint) and LCP (Largest Contentful Paint)
 * performance issues by analyzing the longest subparts and providing optimization strategies.
 *
 * Usage: Import and call analyzePerformance() in development or monitoring contexts
 */

export interface PerformanceMetric {
  name: string;
  value: number;
  rating: "good" | "needs-improvement" | "poor";
  threshold: {
    good: number;
    needsImprovement: number;
  };
}

const LCP_THRESHOLDS = { good: 2500, needsImprovement: 4000 };
const INP_THRESHOLDS = { good: 200, needsImprovement: 500 };

export interface PerformanceBreakdown {
  lcp: {
    value: number;
    rating: "good" | "needs-improvement" | "poor";
    breakdown: {
      ttfb: number; // Time to First Byte
      resourceLoadDelay: number;
      resourceLoadTime: number;
      elementRenderDelay: number;
    };
    longestSubpart: "ttfb" | "resourceLoadDelay" | "resourceLoadTime" | "elementRenderDelay";
    strategies: string[];
  };
  inp: {
    value: number;
    rating: "good" | "needs-improvement" | "poor";
    breakdown: {
      inputDelay: number; // Time before event handlers run
      processingTime: number; // Event handler execution
      presentationDelay: number; // Time to paint next frame
    };
    longestSubpart: "inputDelay" | "processingTime" | "presentationDelay";
    strategies: string[];
  };
  recommendations: Array<{
    priority: "high" | "medium" | "low";
    category: "lcp" | "inp" | "both";
    action: string;
    impact: string;
  }>;
}

/**
 * Analyze LCP and INP performance with detailed breakdown
 */
export function analyzePerformance(metrics?: { lcp?: number; inp?: number }): PerformanceBreakdown {
  // Mock data for analysis (replace with real metrics from WebVitalsReporter)
  const lcpValue = metrics?.lcp ?? 3200; // Example: 3.2s LCP
  const inpValue = metrics?.inp ?? 350; // Example: 350ms INP

  // LCP Breakdown Analysis
  const lcpBreakdown = analyzeLCP(lcpValue, LCP_THRESHOLDS);

  // INP Breakdown Analysis
  const inpBreakdown = analyzeINP(inpValue, INP_THRESHOLDS);

  // Generate prioritized recommendations
  const recommendations = generateRecommendations(lcpBreakdown, inpBreakdown);

  return {
    lcp: lcpBreakdown,
    inp: inpBreakdown,
    recommendations,
  };
}

function analyzeLCP(value: number, thresholds: typeof LCP_THRESHOLDS): PerformanceBreakdown["lcp"] {
  const rating = value <= thresholds.good ? "good" : value <= thresholds.needsImprovement ? "needs-improvement" : "poor";

  // Simulate LCP breakdown (in real implementation, use Performance API)
  const ttfb = Math.min(value * 0.15, 600); // 15% of LCP or max 600ms
  const resourceLoadDelay = Math.min(value * 0.25, 800); // 25% or max 800ms
  const resourceLoadTime = Math.max(value * 0.45, 1200); // 45% (typically longest)
  const elementRenderDelay = value - ttfb - resourceLoadDelay - resourceLoadTime;

  const breakdown = {
    ttfb: Math.round(ttfb),
    resourceLoadDelay: Math.round(resourceLoadDelay),
    resourceLoadTime: Math.round(resourceLoadTime),
    elementRenderDelay: Math.round(Math.max(0, elementRenderDelay)),
  };

  // Identify longest subpart
  const subparts = {
    ttfb: breakdown.ttfb,
    resourceLoadDelay: breakdown.resourceLoadDelay,
    resourceLoadTime: breakdown.resourceLoadTime,
    elementRenderDelay: breakdown.elementRenderDelay,
  };

  const longestSubpart = Object.entries(subparts).reduce((a, b) => (b[1] > a[1] ? b : a))[0] as typeof breakdown extends { [key: string]: infer T } ? keyof typeof breakdown : never;

  // Generate strategies based on longest subpart
  const strategies: string[] = [];

  if (longestSubpart === "ttfb") {
    strategies.push(
      "Optimize server response time (use Edge Functions, CDN caching)",
      "Implement early hints for critical resources",
      "Reduce redirect chains",
      "Preconnect to required origins",
    );
  } else if (longestSubpart === "resourceLoadDelay") {
    strategies.push(
      "Prioritize critical resources with preload hints",
      "Remove render-blocking resources",
      "Defer non-critical CSS/JS",
      "Use resource hints (preconnect, prefetch, preload)",
    );
  } else if (longestSubpart === "resourceLoadTime") {
    strategies.push(
      "Compress and optimize images (WebP, AVIF)",
      "Implement responsive images with srcset",
      "Use a CDN for static assets",
      "Enable text compression (gzip, brotli)",
      "Reduce resource file sizes through tree-shaking",
    );
  } else if (longestSubpart === "elementRenderDelay") {
    strategies.push(
      "Optimize CSS for LCP element (avoid layout thrashing)",
      "Reduce DOM complexity around LCP element",
      "Use content-visibility for off-screen content",
      "Prioritize LCP element in rendering queue",
    );
  }

  if (rating === "poor") {
    strategies.unshift("CRITICAL: LCP >4s severely impacts user experience - address immediately");
  }

  return {
    value,
    rating,
    breakdown,
    longestSubpart,
    strategies,
  };
}

function analyzeINP(value: number, thresholds: typeof INP_THRESHOLDS): PerformanceBreakdown["inp"] {
  const rating = value <= thresholds.good ? "good" : value <= thresholds.needsImprovement ? "needs-improvement" : "poor";

  // Simulate INP breakdown (in real implementation, use event timing API)
  const inputDelay = Math.min(value * 0.3, 150); // Time before event handlers run
  const processingTime = Math.max(value * 0.5, 200); // Event handler execution (typically longest)
  const presentationDelay = value - inputDelay - processingTime;

  const breakdown = {
    inputDelay: Math.round(inputDelay),
    processingTime: Math.round(processingTime),
    presentationDelay: Math.round(Math.max(0, presentationDelay)),
  };

  // Identify longest subpart
  const subparts = {
    inputDelay: breakdown.inputDelay,
    processingTime: breakdown.processingTime,
    presentationDelay: breakdown.presentationDelay,
  };

  const longestSubpart = Object.entries(subparts).reduce((a, b) => (b[1] > a[1] ? b : a))[0] as keyof typeof breakdown;

  // Generate strategies based on longest subpart
  const strategies: string[] = [];

  if (longestSubpart === "inputDelay") {
    strategies.push(
      "Reduce main thread work (break up long tasks)",
      "Use Web Workers for heavy computations",
      "Defer non-critical JavaScript",
      "Minimize style recalculations during interaction",
    );
  } else if (longestSubpart === "processingTime") {
    strategies.push(
      "Optimize event handlers (debounce/throttle)",
      "Use React.memo and useMemo for expensive calculations",
      "Break up state updates with useTransition",
      "Move non-critical work to useEffect (post-interaction)",
      "Consider using Suspense for conditional content",
    );
  } else if (longestSubpart === "presentationDelay") {
    strategies.push(
      "Reduce paint complexity (simplify DOM structure)",
      "Use CSS containment (contain: layout)",
      "Avoid forced synchronous layouts",
      "Use requestAnimationFrame for visual updates",
    );
  }

  if (rating === "poor") {
    strategies.unshift("CRITICAL: INP >500ms makes interface feel sluggish - optimize event handlers");
  }

  return {
    value,
    rating,
    breakdown,
    longestSubpart,
    strategies,
  };
}

function generateRecommendations(
  lcp: PerformanceBreakdown["lcp"],
  inp: PerformanceBreakdown["inp"],
): PerformanceBreakdown["recommendations"] {
  const recommendations: PerformanceBreakdown["recommendations"] = [];

  // High priority: Address poor ratings first
  if (lcp.rating === "poor") {
    recommendations.push({
      priority: "high",
      category: "lcp",
      action: `Reduce LCP from ${lcp.value}ms to <2500ms by optimizing ${lcp.longestSubpart}`,
      impact: "Significantly improves perceived load time and user retention",
    });
  }

  if (inp.rating === "poor") {
    recommendations.push({
      priority: "high",
      category: "inp",
      action: `Reduce INP from ${inp.value}ms to <200ms by optimizing ${inp.longestSubpart}`,
      impact: "Makes interface feel responsive and snappy",
    });
  }

  // Medium priority: Address needs-improvement ratings
  if (lcp.rating === "needs-improvement") {
    recommendations.push({
      priority: "medium",
      category: "lcp",
      action: `Improve LCP from ${lcp.value}ms to <2500ms by addressing ${lcp.longestSubpart}`,
      impact: "Better user experience and SEO rankings",
    });
  }

  if (inp.rating === "needs-improvement") {
    recommendations.push({
      priority: "medium",
      category: "inp",
      action: `Improve INP from ${inp.value}ms to <200ms by optimizing ${inp.longestSubpart}`,
      impact: "Smoother interactions and better engagement",
    });
  }

  // Specific actionable recommendations based on longest subparts
  if (lcp.longestSubpart === "resourceLoadTime") {
    recommendations.push({
      priority: "high",
      category: "lcp",
      action: "Implement image optimization strategy (WebP/AVIF, responsive images, lazy loading)",
      impact: "Can reduce LCP by 30-50% on image-heavy pages",
    });
  }

  if (inp.longestSubpart === "processingTime") {
    recommendations.push({
      priority: "high",
      category: "inp",
      action: "Audit and optimize event handlers using React DevTools Profiler",
      impact: "Can reduce INP by 40-60% on interaction-heavy pages",
    });
  }

  // General best practices
  recommendations.push({
    priority: "medium",
    category: "both",
    action: "Enable React Compiler (experimental) for automatic memoization",
    impact: "Reduces both LCP (faster renders) and INP (optimized handlers)",
  });

  recommendations.push({
    priority: "low",
    category: "both",
    action: "Implement speculative prerendering for likely navigation targets",
    impact: "Improves perceived performance for navigation interactions",
  });

  return recommendations.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

/**
 * Real-time INP observer using Event Timing API
 */
export class INPMonitor {
  private observer: PerformanceObserver | null = null;
  private entries: PerformanceEventTiming[] = [];
  private callback: (inp: number) => void;

  constructor(callback: (inp: number) => void) {
    this.callback = callback;
  }

  start() {
    if (typeof PerformanceObserver === "undefined") return;

    this.observer = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries() as any[];
      this.entries.push(...entries);

      // Keep only last 50 interactions
      if (this.entries.length > 50) {
        this.entries.shift();
      }

      // Calculate INP (98th percentile of interaction durations)
      const sorted = this.entries.map((e) => e.duration).sort((a, b) => a - b);
      const inpIndex = Math.floor(sorted.length * 0.98);
      const inp = sorted[inpIndex] || 0;

      this.callback(inp);
    });

    this.observer.observe({ type: "event", buffered: true });
  }

  stop() {
    this.observer?.disconnect();
    this.observer = null;
  }

  getEntries() {
    return this.entries;
  }
}

/**
 * Real-time LCP observer
 */
export class LCPMonitor {
  private observer: PerformanceObserver | null = null;
  private callback: (lcp: number) => void;

  constructor(callback: (lcp: number) => void) {
    this.callback = callback;
  }

  start() {
    if (typeof PerformanceObserver === "undefined") return;

    this.observer = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      const lastEntry = entries[entries.length - 1];
      const lcp = lastEntry?.startTime || 0;

      this.callback(lcp);
    });

    this.observer.observe({ type: "largest-contentful-paint", buffered: true });
  }

  stop() {
    this.observer?.disconnect();
    this.observer = null;
  }
}
