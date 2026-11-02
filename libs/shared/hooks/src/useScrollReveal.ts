'use client';

import { useEffect, useState } from 'react';
import { useMediaQuery } from './useMediaQuery';

const DEFAULT_THRESHOLD = 0.15;
const DEFAULT_ROOT_MARGIN = '0px 0px -40px 0px';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

export interface ScrollRevealOptions {
  readonly threshold?: number;
  readonly rootMargin?: string;
  readonly triggerOnce?: boolean;
  readonly initialVisible?: boolean;
}

export interface ScrollRevealResult<T extends Element = HTMLElement> {
  readonly ref: (node: T | null) => void;
  readonly isVisible: boolean;
  readonly shouldReduceMotion: boolean;
}

/**
 * Zero-dependency React 19 IntersectionObserver hook inspired by jlmakes/scrollreveal
 * and animate-css/animate.css.
 *
 * Automatically respects `(prefers-reduced-motion: reduce)` by immediately revealing
 * elements without motion sickness or scroll jitter on industrial pit tablets.
 */
export function useScrollReveal<T extends Element = HTMLElement>(
  options: Readonly<ScrollRevealOptions> = {}
): ScrollRevealResult<T> {
  const threshold = options.threshold ?? DEFAULT_THRESHOLD;
  const rootMargin = options.rootMargin ?? DEFAULT_ROOT_MARGIN;
  const triggerOnce = options.triggerOnce ?? true;
  const initialVisible = options.initialVisible ?? false;

  const shouldReduceMotion = useMediaQuery(REDUCED_MOTION_QUERY);
  const [targetElement, setTargetElement] = useState<T | null>(null);
  const [hasIntersected, setHasIntersected] = useState<boolean>(initialVisible);

  useEffect(() => {
    if (shouldReduceMotion) {
      setHasIntersected(true);
      return;
    }

    if (!targetElement) {
      return;
    }

    if (typeof window === 'undefined' || typeof window.IntersectionObserver === 'undefined') {
      setHasIntersected(true);
      return;
    }

    const observer = new window.IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) {
          return;
        }
        if (entry.isIntersecting) {
          setHasIntersected(true);
          if (triggerOnce) {
            observer.unobserve(entry.target);
          }
          return;
        }
        if (!triggerOnce) {
          setHasIntersected(false);
        }
      },
      {
        threshold,
        rootMargin,
      }
    );

    observer.observe(targetElement);

    return () => {
      observer.disconnect();
    };
  }, [targetElement, threshold, rootMargin, triggerOnce, shouldReduceMotion]);

  return {
    ref: setTargetElement,
    isVisible: shouldReduceMotion || hasIntersected,
    shouldReduceMotion,
  };
}
