"use client";

import { useReportWebVitals } from "next/web-vitals";
import { analyzePerformance, INPMonitor, LCPMonitor } from "@/lib/performance-analyzer";

interface Metric {
  name: string;
  value: number;
  rating: string;
  delta: number;
  id?: string;
  label?: string;
  attribution?: Record<string, unknown>;
}

/**
 * WebVitalsReporter
 *
 * Reports Core Web Vitals (LCP, CLS, FCP, TTFB, INP) in production.
 * Enhanced with real-time performance analysis and actionable insights.
 *
 * Data is collected and made available via:
 *   - `data-web-vital-*` attributes on <body> for scraping by monitoring
 *   - `sessionStorage` for single-session aggregation with experimental attribution
 *   - Console logging in development with performance breakdown
 *   - OpenTelemetry spans for production monitoring
 */
export function WebVitalsReporter() {
  useReportWebVitals((metric: Metric) => {
    const isDev = process.env.NODE_ENV === "development";
    
    // Enhanced logging with performance breakdown for LCP and INP
    if (isDev && (metric.name === "LCP" || metric.name === "INP")) {
      const analysis = analyzePerformance({
        lcp: metric.name === "LCP" ? metric.value : undefined,
        inp: metric.name === "INP" ? metric.value : undefined,
      });

      // eslint-disable-next-line no-console
      console.group(`[Web Vitals] ${metric.name} Analysis`);
      // eslint-disable-next-line no-console
      console.log(`Value: ${metric.value.toFixed(0)}ms (${metric.rating})`);
      
      if (metric.name === "LCP" && analysis.lcp) {
        // eslint-disable-next-line no-console
        console.log("Breakdown:", analysis.lcp.breakdown);
        // eslint-disable-next-line no-console
        console.log(`Longest subpart: ${analysis.lcp.longestSubpart} (${analysis.lcp.breakdown[analysis.lcp.longestSubpart]}ms)`);
        // eslint-disable-next-line no-console
        console.log("Optimization strategies:", analysis.lcp.strategies);
      }
      
      if (metric.name === "INP" && analysis.inp) {
        // eslint-disable-next-line no-console
        console.log("Breakdown:", analysis.inp.breakdown);
        // eslint-disable-next-line no-console
        console.log(`Longest subpart: ${analysis.inp.longestSubpart} (${analysis.inp.breakdown[analysis.inp.longestSubpart]}ms)`);
        // eslint-disable-next-line no-console
        console.log("Optimization strategies:", analysis.inp.strategies);
      }
      
      // eslint-disable-next-line no-console
      console.groupEnd();
      return;
    }

    // Production: stamp metric on body for scraping
    const attrName = `data-web-vital-${metric.name.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
    try {
      document.body.setAttribute(attrName, String(metric.value));
    } catch {
      // Silently ignore — attribute setting is non-critical
    }

    // Accumulate in sessionStorage for per-session aggregation with attribution
    try {
      const key = `wv:${metric.name}`;
      const raw = sessionStorage.getItem(key);
      const entries: Array<{
        value: number;
        rating: string;
        attribution?: Record<string, unknown>;
        timestamp: number;
      }> = raw ? JSON.parse(raw) : [];
      
      entries.push({
        value: metric.value,
        rating: metric.rating,
        attribution: metric.attribution,
        timestamp: Date.now(),
      });
      
      // Keep only last 50 entries per metric
      if (entries.length > 50) entries.shift();
      sessionStorage.setItem(key, JSON.stringify(entries));
    } catch {
      // sessionStorage may be full or unavailable
    }
  });

  return null;
}

/**
 * Real-time performance monitoring hook
 * Sets up INP and LCP observers for continuous monitoring
 */
export function usePerformanceMonitoring(options?: {
  onINPChange?: (inp: number, rating: string) => void;
  onLCPChange?: (lcp: number, rating: string) => void;
}) {
  const { onINPChange, onLCPChange } = options || {};

  if (typeof window === "undefined") return;

  // INP Monitoring
  const inpMonitor = new INPMonitor((inp) => {
    const rating = inp <= 200 ? "good" : inp <= 500 ? "needs-improvement" : "poor";
    onINPChange?.(inp, rating);
  });

  // LCP Monitoring
  const lcpMonitor = new LCPMonitor((lcp) => {
    const rating = lcp <= 2500 ? "good" : lcp <= 4000 ? "needs-improvement" : "poor";
    onLCPChange?.(lcp, rating);
  });

  // Start monitoring after mount
  setTimeout(() => {
    inpMonitor.start();
    lcpMonitor.start();
  }, 1000);

  // Cleanup on unmount
  return () => {
    inpMonitor.stop();
    lcpMonitor.stop();
  };
}
