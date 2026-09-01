"use client";

import { useMemo, useState, useCallback, useRef, useEffect } from "react";

interface UseVirtualizationOptions {
  itemCount: number;
  itemHeight: number;
  containerHeight: number;
  overscan?: number;
}

interface UseVirtualizationResult {
  virtualItems: Array<{
    offsetTop: number;
    height: number;
  }>;
  totalHeight: number;
  scrollToIndex: (_index: number) => void;
  containerRef: React.RefObject<HTMLDivElement>;
}

/**
 * Hook for implementing virtualization in scrollable lists.
 *
 * Performance Benefits:
 * - Only renders visible items
 * - Reduces DOM complexity
 * - Improves scroll performance
 */
export function useVirtualization({
  itemCount,
  itemHeight,
  containerHeight,
  overscan = 5,
}: UseVirtualizationOptions): UseVirtualizationResult {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Calculate visible range
  const visibleRange = useMemo(() => {
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const visibleCount = Math.ceil(containerHeight / itemHeight);
    const endIndex = Math.min(itemCount - 1, startIndex + visibleCount + overscan * 2);
    return { startIndex, endIndex };
  }, [scrollTop, itemHeight, containerHeight, itemCount, overscan]);

  // Generate virtual items
  const virtualItems = useMemo(() => {
    const items = [];
    for (let i = visibleRange.startIndex; i <= visibleRange.endIndex; i++) {
      items.push({
        offsetTop: i * itemHeight,
        height: itemHeight,
      });
    }
    return items;
  }, [visibleRange.startIndex, visibleRange.endIndex, itemHeight]);

  // Total height for scrollbar
  const totalHeight = itemCount * itemHeight;

  // Scroll to specific index
  const scrollToIndex = useCallback(
    (_index: number) => {
      if (containerRef.current) {
        const scrollTop = _index * itemHeight;
        containerRef.current.scrollTop = scrollTop;
        setScrollTop(scrollTop);
      }
    },
    [itemHeight],
  );

  // Handle scroll events
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      setScrollTop(container.scrollTop);
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  return {
    virtualItems,
    totalHeight,
    scrollToIndex,
    containerRef,
  };
}
