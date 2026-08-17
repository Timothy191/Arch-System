import { formatDate, getCurrentShift, getOperationalToday, getThreeShift } from "@repo/utils";

describe("getThreeShift utility", () => {
  it("should classify Shift A (06:00 - 14:00) correctly", () => {
    // 08:30 SAST (UTC+2) -> 06:30 UTC. Let's construct a date with explicit hours in SAST.
    // We can use a UTC date and let getThreeShift calculate in Africa/Johannesburg (SAST).
    // June 2, 2026 08:00:00 SAST is June 2, 2026 06:00:00 UTC
    const dateShiftA = new Date("2026-06-02T06:00:00Z"); // 08:00:00 SAST
    const result = getThreeShift(dateShiftA);
    expect(result.shift).toBe("A");
    expect(result.label).toBe("Shift A");
    expect(result.start).toBe("06:00");
    expect(result.end).toBe("14:00");
  });

  it("should classify Shift B (14:00 - 22:00) correctly", () => {
    // June 2, 2026 15:30:00 SAST is June 2, 2026 13:30:00 UTC
    const dateShiftB = new Date("2026-06-02T13:30:00Z"); // 15:30:00 SAST
    const result = getThreeShift(dateShiftB);
    expect(result.shift).toBe("B");
    expect(result.label).toBe("Shift B");
    expect(result.start).toBe("14:00");
    expect(result.end).toBe("22:00");
  });

  it("should classify Shift C (22:00 - 06:00) correctly at late night", () => {
    // June 2, 2026 23:15:00 SAST is June 2, 2026 21:15:00 UTC
    const dateShiftC1 = new Date("2026-06-02T21:15:00Z"); // 23:15:00 SAST
    const result = getThreeShift(dateShiftC1);
    expect(result.shift).toBe("C");
    expect(result.label).toBe("Shift C");
    expect(result.start).toBe("22:00");
    expect(result.end).toBe("06:00");
  });

  it("should classify Shift C (22:00 - 06:00) correctly at early morning", () => {
    // June 2, 2026 02:45:00 SAST is June 2, 2026 00:45:00 UTC
    const dateShiftC2 = new Date("2026-06-02T00:45:00Z"); // 02:45:00 SAST
    const result = getThreeShift(dateShiftC2);
    expect(result.shift).toBe("C");
    expect(result.label).toBe("Shift C");
    expect(result.start).toBe("22:00");
    expect(result.end).toBe("06:00");
  });

  it("should handle custom timezones correctly", () => {
    // 08:00:00 UTC. In UTC, hour is 8 -> Shift A.
    const date = new Date("2026-06-02T08:00:00Z");
    const result = getThreeShift(date, "UTC");
    expect(result.shift).toBe("A");
  });
});

describe("formatDate utility", () => {
  it("formats a YYYY-MM-DD string as the same calendar day in any local timezone", () => {
    // Regression: new Date("2026-01-01") is UTC midnight, which rendered the
    // previous day in local timezones west of UTC. Local-midnight parsing keeps
    // the date stable regardless of host timezone.
    expect(formatDate("2026-01-01")).toContain("January");
    expect(formatDate("2026-01-01")).toContain("1");
    expect(formatDate("2026-12-31")).toContain("December");
    expect(formatDate("2026-12-31")).toContain("31");
  });

  it("formats the same date in a given IANA timezone", () => {
    expect(formatDate("2026-01-01", "Africa/Johannesburg")).toContain("January");
    expect(formatDate("2026-06-15", "America/New_York")).toContain("June");
  });
});

describe("getCurrentShift utility", () => {
  it("classifies day shift (06:00-18:00 SAST)", () => {
    // 08:00 SAST = 06:00 UTC
    expect(getCurrentShift(new Date("2026-06-02T06:00:00Z"))).toBe("day");
  });

  it("classifies night shift outside day hours", () => {
    // 02:00 SAST = 00:00 UTC
    expect(getCurrentShift(new Date("2026-06-02T00:00:00Z"))).toBe("night");
    // 20:00 SAST = 18:00 UTC
    expect(getCurrentShift(new Date("2026-06-02T18:00:00Z"))).toBe("night");
  });

  it("honors a custom timezone", () => {
    // 17:00 UTC is day (17 < 18) in UTC but 19:00 SAST = night
    const date = new Date("2026-06-02T17:00:00Z");
    expect(getCurrentShift(date, "UTC")).toBe("day");
    expect(getCurrentShift(date, "Africa/Johannesburg")).toBe("night");
  });
});

describe("getOperationalToday utility", () => {
  it("returns YYYY-MM-DD for the given timezone", () => {
    // 2026-06-02 22:00 UTC is 2026-06-03 00:00 SAST
    const today = getOperationalToday("UTC");
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
