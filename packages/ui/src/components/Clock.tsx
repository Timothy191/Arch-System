"use client";

import * as React from "react";
import { cn } from "../lib/utils";

/**
 * Clock — a hydration-safe live time/date renderer styled after the macOS
 * menu-bar clock used throughout the Arch-System portal chrome.
 *
 * AGENT-TRACE: SSR renders an empty placeholder so the server and client first
 * paint match exactly; the live time string is only set inside useEffect. This
 * avoids Next.js App Router hydration mismatches caused by wall-clock variance.
 */
export type ClockFormat = "time" | "date" | "datetime";

export interface ClockProps {
  /** Which fields to render. @default "time" */
  format?: ClockFormat;
  /** BCP-47 locale. Fixed (not auto-detected) for snapshot determinism. @default "en-US" */
  locale?: string;
  /** 12 vs 24 hour time. @default true */
  hour12?: boolean;
  /** Show seconds when format includes time. @default false */
  showSeconds?: boolean;
  /** Passthrough test id. @default "clock" */
  testId?: string;
  /** Accessible label prefix; full time is appended for screen readers. */
  ariaLabel?: string;
  className?: string;
}

function buildFormatter(
  format: ClockFormat,
  locale: string,
  hour12: boolean,
  showSeconds: boolean,
): Intl.DateTimeFormat {
  switch (format) {
    case "date":
      return new Intl.DateTimeFormat(locale, {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
    case "datetime":
      return new Intl.DateTimeFormat(locale, {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12,
      });
    case "time":
    default:
      return new Intl.DateTimeFormat(locale, {
        hour: "numeric",
        minute: "2-digit",
        second: showSeconds ? "2-digit" : undefined,
        hour12,
      });
  }
}

/**
 * Tick interval. Seconds view updates every 1s; otherwise update once per
 * minute on the minute boundary so the component is cheap when seconds are off.
 */
function computeDelay(showSeconds: boolean, now: number): number {
  if (showSeconds) return 1000;
  // Align next tick to the start of the next minute.
  const msIntoMinute = now % 60_000;
  return 60_000 - msIntoMinute;
}

export function Clock({
  format = "time",
  locale = "en-US",
  hour12 = true,
  showSeconds = false,
  testId = "clock",
  ariaLabel,
  className,
}: ClockProps) {
  const [time, setTime] = React.useState<Date | null>(null);

  React.useEffect(() => {
    const update = () => setTime(new Date());
    update(); // set immediately on mount
    let timer: ReturnType<typeof setTimeout>;
    const scheduleNext = () => {
      const delay = computeDelay(showSeconds, Date.now());
      timer = setTimeout(() => {
        update();
        scheduleNext();
      }, delay);
    };
    scheduleNext();
    return () => clearTimeout(timer);
  }, [showSeconds, format, locale, hour12]);

  const formatter = React.useMemo(
    () => buildFormatter(format, locale, hour12, showSeconds),
    [format, locale, hour12, showSeconds],
  );

  const display = time ? formatter.format(time) : "";
  const ariaText = time
    ? `${ariaLabel ? ariaLabel + " " : ""}${new Intl.DateTimeFormat(locale, {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        hour12,
      }).format(time)}`
    : (ariaLabel ?? "");

  return (
    <span
      data-testid={testId}
      role="timer"
      aria-label={ariaText || undefined}
      className={cn(
        // AGENT-TRACE: reads theme tokens only — no hardcoded colors, preserves light-mode invariant
        "tabular-nums select-none text-[var(--text-secondary)]",
        className,
      )}
      suppressHydrationWarning
    >
      {display}
    </span>
  );
}

export default Clock;
