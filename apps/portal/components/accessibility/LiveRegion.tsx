"use client";

import React, { useEffect, useState } from "react";

interface LiveRegionProps {
  children: React.ReactNode;
  atomic?: boolean;
  busy?: boolean;
  live?: "polite" | "assertive";
  relevant?: "additions" | "removals" | "text" | "all";
}

/**
 * LiveRegion provides dynamic content announcements for screen readers.
 *
 * WCAG 2.1 Success Criteria:
 * - 4.1.3 Status Messages (Level AA)
 *
 * @see https://www.w3.org/WAI/WCAG21/Understanding/status-messages.html
 */
export function LiveRegion({
  children,
  atomic = false,
  busy = false,
  live = "polite",
  relevant = "additions",
}: LiveRegionProps) {
  return (
    <div
      aria-atomic={atomic}
      aria-busy={busy}
      aria-live={live}
      aria-relevant={relevant}
      className="sr-only"
    >
      {children}
    </div>
  );
}

interface AnnouncerProps {
  message: string;
  live?: "polite" | "assertive";
  onAnnounced?: () => void;
}

/**
 * Announcer component for announcing messages to screen readers.
 * Automatically clears the message after announcement.
 */
export function Announcer({ message, live = "polite", onAnnounced }: AnnouncerProps) {
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    if (message) {
      // Clear first to ensure re-announcement
      setAnnouncement("");
      // Then set the message
      const timer = setTimeout(() => {
        setAnnouncement(message);
        onAnnounced?.();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [message, onAnnounced]);

  return (
    <LiveRegion live={live} atomic>
      {announcement}
    </LiveRegion>
  );
}
