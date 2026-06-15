/**
 * Formats a date string (YYYY-MM-DD) to a human readable format
 */
export function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-ZA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Returns the current shift (day/night) based on the hour
 */
export * from "./n8n";
export function getCurrentShift(): "day" | "night" {
  const hour = new Date().getHours();
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
export function getOperationalToday(
  timeZone: string = "Africa/Johannesburg",
): string {
  return new Date().toLocaleDateString("en-CA", { timeZone });
}
