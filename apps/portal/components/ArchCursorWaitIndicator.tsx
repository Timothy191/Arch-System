'use client';

import { useIsFetching, useIsMutating } from '@tanstack/react-query';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

const WAIT_SELECTOR = [
  '[aria-busy="true"]',
  '[data-loading="true"]',
  '[data-state="loading"]',
  '.cursor-wait',
  '.cursor-progress',
  'button:disabled .animate-spin',
  '[role="progressbar"]',
].join(', ');

/**
 * Renders a bouncing animated Google Antigravity Logo next to the user's
 * Gold Arch cursor whenever a loading state, route transition, query/mutation,
 * or operator-wait process is active.
 */
export function ArchCursorWaitIndicator() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pathname = usePathname();
  const isFetching = useIsFetching();
  const isMutating = useIsMutating();

  const [isPointerVisible, setIsPointerVisible] = useState(false);
  const [isRoutePending, setIsRoutePending] = useState(false);
  const [isDomBusy, setIsDomBusy] = useState(false);

  // Clear route-pending state as soon as pathname updates
  useEffect(() => {
    if (!pathname) return;
    setIsRoutePending(false);
  }, [pathname]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    let routeTimer: ReturnType<typeof setTimeout> | null = null;

    const clearRouteTimer = () => {
      if (routeTimer !== null) {
        clearTimeout(routeTimer);
        routeTimer = null;
      }
    };

    const startTimedWait = (durationMs = 1400) => {
      setIsRoutePending(true);
      clearRouteTimer();
      routeTimer = setTimeout(() => {
        setIsRoutePending(false);
      }, durationMs);
    };

    const checkDomBusy = (target?: EventTarget | null) => {
      const rootBusy =
        document.readyState !== 'complete' ||
        document.documentElement.dataset.cursorWait === 'true' ||
        document.querySelector(WAIT_SELECTOR) !== null;

      if (rootBusy) {
        setIsDomBusy(true);
        return;
      }

      if (target instanceof Element && target.closest(WAIT_SELECTOR)) {
        setIsDomBusy(true);
        return;
      }

      setIsDomBusy(false);
    };

    const handleMouseMove = (e: MouseEvent) => {
      const node = containerRef.current;
      if (node && Number.isFinite(e.clientX) && Number.isFinite(e.clientY)) {
        node.style.transform = `translate3d(${e.clientX + 20}px, ${e.clientY + 6}px, 0)`;
      }
      setIsPointerVisible(true);
      checkDomBusy(e.target);
    };

    const handleMouseLeave = () => {
      setIsPointerVisible(false);
    };

    const handleDocumentClick = (e: MouseEvent) => {
      const target = e.target;
      if (!(target instanceof Element)) return;

      const anchor = target.closest('a[href]');
      if (anchor instanceof HTMLAnchorElement) {
        const href = anchor.getAttribute('href');
        if (
          href?.startsWith('/') &&
          !href.startsWith('//') &&
          anchor.target !== '_blank' &&
          !e.metaKey &&
          !e.ctrlKey &&
          !e.shiftKey &&
          !e.altKey
        ) {
          startTimedWait(1600);
          return;
        }
      }

      const submitBtn = target.closest('button[type="submit"], input[type="submit"]');
      if (submitBtn) {
        startTimedWait(1400);
      }
    };

    const handleFormSubmit = () => {
      startTimedWait(1600);
    };

    const handleCustomWait = (e: Event) => {
      const custom = e as CustomEvent<{ active?: boolean; durationMs?: number }>;
      if (custom.detail?.active === false) {
        clearRouteTimer();
        setIsRoutePending(false);
        setIsDomBusy(false);
      } else {
        startTimedWait(custom.detail?.durationMs ?? 1500);
      }
    };

    const handleReadyStateChange = () => {
      checkDomBusy();
    };

    checkDomBusy();

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    document.addEventListener('mouseleave', handleMouseLeave, { passive: true });
    document.addEventListener('click', handleDocumentClick, { passive: true });
    document.addEventListener('submit', handleFormSubmit, { passive: true });
    window.addEventListener('arch:cursor-wait', handleCustomWait);
    document.addEventListener('readystatechange', handleReadyStateChange);

    return () => {
      clearRouteTimer();
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('click', handleDocumentClick);
      document.removeEventListener('submit', handleFormSubmit);
      window.removeEventListener('arch:cursor-wait', handleCustomWait);
      document.removeEventListener('readystatechange', handleReadyStateChange);
    };
  }, []);

  const isWaiting = isFetching > 0 || isMutating > 0 || isRoutePending || isDomBusy;
  const shouldShow = isPointerVisible && isWaiting;

  return (
    <div
      ref={containerRef}
      data-testid="arch-cursor-wait-indicator"
      data-active={shouldShow ? 'true' : 'false'}
      aria-hidden="true"
      className={`fixed top-0 left-0 pointer-events-none select-none z-[var(--z-priority)] transition-opacity duration-150 ${
        shouldShow ? 'opacity-100' : 'opacity-0'
      }`}
      style={{ transform: 'translate3d(-100px, -100px, 0)' }}
    >
      <div className="flex flex-col items-center animate-bounce">
        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-white/90 backdrop-blur-md border border-[var(--accent-blue)]/45 shadow-sm">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 16 16"
            className="w-3.5 h-3.5 text-[var(--accent-blue)] fill-current"
            aria-hidden="true"
          >
            <path d="M14.1452 14.6818C14.9937 15.3182 16.2664 14.894 15.0997 13.7273C11.5998 10.3333 12.3421 1 7.99366 1C3.64518 1 4.3876 10.3333 0.887603 13.7273C-0.385123 15 0.993664 15.3182 1.84215 14.6818C5.13002 12.4545 4.9179 8.5303 7.99366 8.5303C11.0694 8.5303 10.8573 12.4545 14.1452 14.6818Z" />
          </svg>
        </div>
        <span className="w-1.5 h-0.5 mt-0.5 rounded-full bg-[var(--accent-blue)]/60 animate-pulse" />
      </div>
    </div>
  );
}
