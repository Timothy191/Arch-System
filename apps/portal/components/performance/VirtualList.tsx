"use client";

import React, { useMemo, useCallback, useRef, useState } from "react";

interface VirtualListProps<T> {
  items: T[];
  itemHeight: number;
  containerHeight: number;
  renderItem: (_item: T, _index: number) => React.ReactNode;
  keyExtractor: (_item: T, _index: number) => string;
  overscan?: number;
  onEndReached?: () => void;
  endReachedThreshold?: number;
}

/**
 * VirtualList renders only visible items for performance optimization.
 *
 * Performance Benefits:
 * - Reduces DOM nodes from O(n) to O(visible items)
 * - Improves scroll performance for large lists
 * - Reduces memory usage
 *
 * @see https://react.dev/reference/react/Fragment#rendering-large-lists
 */
export function VirtualList<T>({
  items,
  itemHeight,
  containerHeight,
  renderItem,
  keyExtractor,
  overscan = 5,
  onEndReached,
  endReachedThreshold = 0.8,
}: VirtualListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Calculate visible range
  const visibleRange = useMemo(() => {
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const visibleCount = Math.ceil(containerHeight / itemHeight);
    const endIndex = Math.min(items.length - 1, startIndex + visibleCount + overscan * 2);
    return { startIndex, endIndex };
  }, [scrollTop, itemHeight, containerHeight, items.length, overscan]);

  // Get visible items
  const visibleItems = useMemo(() => {
    return items.slice(visibleRange.startIndex, visibleRange.endIndex + 1);
  }, [items, visibleRange.startIndex, visibleRange.endIndex]);

  // Handle scroll
  const handleScroll = useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      const target = event.target as HTMLDivElement;
      setScrollTop(target.scrollTop);

      // Check if end reached
      if (onEndReached) {
        const { scrollHeight, clientHeight } = target;
        const scrollPercentage = (scrollTop + clientHeight) / scrollHeight;
        if (scrollPercentage >= endReachedThreshold) {
          onEndReached();
        }
      }
    },
    [scrollTop, onEndReached, endReachedThreshold],
  );

  // Total height for scrollbar
  const totalHeight = items.length * itemHeight;

  // Offset for visible items
  const offsetY = visibleRange.startIndex * itemHeight;

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      style={{ height: containerHeight, overflow: "auto" }}
      role="list"
      aria-label="Virtual list"
    >
      <div style={{ height: totalHeight, position: "relative" }}>
        <div style={{ position: "absolute", top: offsetY, width: "100%" }}>
          {visibleItems.map((item, index) => {
            const actualIndex = visibleRange.startIndex + index;
            return (
              <div
                key={keyExtractor(item, actualIndex)}
                style={{ height: itemHeight }}
                role="listitem"
              >
                {renderItem(item, actualIndex)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
