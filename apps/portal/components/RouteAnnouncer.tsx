'use client';

import { usePathname } from 'next/navigation';
import { Suspense, useEffect, useRef } from 'react';

function RouteAnnouncerInner() {
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  const announcerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (pathRef.current === pathname) return;
    pathRef.current = pathname;

    // Give the DOM a tick to render the new page content, then announce
    const id = requestAnimationFrame(() => {
      if (announcerRef.current) {
        const title = document.title || pathname;
        announcerRef.current.textContent = `Navigated to ${title}`;
      }
    });
    return () => cancelAnimationFrame(id);
  }, [pathname]);

  return <div ref={announcerRef} aria-live="polite" aria-atomic="true" className="sr-only" />;
}

export function RouteAnnouncer() {
  return (
    <Suspense fallback={null}>
      <RouteAnnouncerInner />
    </Suspense>
  );
}
