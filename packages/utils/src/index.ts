/**
 * Formats a date string (YYYY-MM-DD) to a human readable format.
 *
 * Date-only strings are parsed as LOCAL midnight rather than UTC midnight.
 * `new Date("2026-01-01")` is interpreted as UTC, so formatting it in a local
 * timezone west of UTC rendered the PREVIOUS day (off-by-one). Parsing the
 * components into `new Date(year, month - 1, day)` keeps the date stable in
 * the local timezone and only shifts when an explicit `timeZone` is given.
 */
export function formatDate(dateStr: string, timeZone?: string): string {
  const date = timeZone ? midnightInTimeZone(dateStr, timeZone) : parseDateOnly(dateStr);
  return date.toLocaleDateString("en-ZA", {
    year: "numeric",
    month: "long",
    day: "numeric",
    ...(timeZone ? { timeZone } : {}),
  });
}

/**
 * Parses a YYYY-MM-DD string as local midnight (no UTC conversion).
 */
function parseDateOnly(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  if (!year || !month || !day) {
    return new Date(NaN);
  }
  return new Date(year, month - 1, day);
}

/**
 * Returns the UTC instant that corresponds to midnight of `dateStr` in the
 * given IANA timezone, using the Intl offset technique.
 */
function midnightInTimeZone(dateStr: string, timeZone: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  if (!year || !month || !day) {
    return new Date(NaN);
  }
  const utcGuess = Date.UTC(year, month - 1, day);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    hour12: false,
    hourCycle: "h23",
  });
  const hour = Number(
    formatter.formatToParts(new Date(utcGuess)).find((p) => p.type === "hour")?.value,
  );
  const utcHour = new Date(utcGuess).getUTCHours();
  // Shift the guess by the timezone's offset so the result is midnight there.
  return new Date(utcGuess - (hour - utcHour) * 3600000);
}

/**
 * Returns the current shift (day/night) based on the hour in the mine's
 * operational timezone. Accepts a Date for deterministic testing.
 */
export * from "./n8n";
export * from "./analytics";
export function getCurrentShift(
  date: Date = new Date(),
  timeZone: string = "Africa/Johannesburg",
): "day" | "night" {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    hour12: false,
    hourCycle: "h23",
  });
  const hour = parseInt(formatter.format(date), 10);
  // Day shift usually 06:00 to 18:00
  return hour >= 6 && hour < 18 ? "day" : "night";
}

/**
 * Calculates the current active operational shift based on the 24-hour clock:
 * - Shift A: 06:00 - 14:00
 * - Shift B: 14:00 - 22:00
 * - Shift C: 22:00 - 06:00
 *
 * Can accept a Date object, defaults to the current time.
 */
export function getThreeShift(
  date: Date = new Date(),
  timeZone: string = "Africa/Johannesburg",
): {
  shift: "A" | "B" | "C";
  label: string;
  start: string;
  end: string;
} {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    hour12: false,
  });
  const hour = parseInt(formatter.format(date), 10);

  if (hour >= 6 && hour < 14) {
    return { shift: "A", label: "Shift A", start: "06:00", end: "14:00" };
  } else if (hour >= 14 && hour < 22) {
    return { shift: "B", label: "Shift B", start: "14:00", end: "22:00" };
  } else {
    return { shift: "C", label: "Shift C", start: "22:00", end: "06:00" };
  }
}

/**
 * Returns the current date in the mine's operational timezone as YYYY-MM-DD.
 * Use this on the SERVER only – never on the client.
 */
export function getOperationalToday(timeZone: string = "Africa/Johannesburg"): string {
  return new Date().toLocaleDateString("en-CA", { timeZone });
}
