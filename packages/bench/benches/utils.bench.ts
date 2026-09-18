import { bench, describe } from "vitest";
import { formatDate, getCurrentShift, getOperationalToday, getThreeShift } from "../utils/src";

// ---------------------------------------------------------------------------
// Benchmarks — ordered by real hot-path evidence, not by API surface.
//
// getCurrentShift / getThreeShift are the genuine hot pair: useSystemMetrics.ts
// calls them inside setInterval(..., 1000) (1 Hz for the page's lifetime), and
// getCurrentShift additionally runs on every render of several department forms.
// Both construct a fresh Intl.DateTimeFormat per call — the suspected cost.
//
// formatDate is kept as a comparison point: it is the heaviest per call, but has
// no production call sites today.
//
// A fixed Date is passed so results are deterministic and comparable across runs.
// ---------------------------------------------------------------------------

const FIXED_INSTANT = new Date("2026-09-17T10:15:00.000Z");

describe("utils/getThreeShift (hot: 1 Hz interval)", () => {
  bench("getThreeShift (explicit date, Africa/Johannesburg)", () => {
    const r = getThreeShift(FIXED_INSTANT, "Africa/Johannesburg");
    if (!r.shift) throw new Error("unexpected empty result");
  });

  bench("getThreeShift (explicit date, default tz)", () => {
    const r = getThreeShift(FIXED_INSTANT);
    if (!r.shift) throw new Error("unexpected empty result");
  });
});

describe("utils/getCurrentShift (hot: per render + 1 Hz interval)", () => {
  bench("getCurrentShift (explicit date, Africa/Johannesburg)", () => {
    const s = getCurrentShift(FIXED_INSTANT, "Africa/Johannesburg");
    if (!s) throw new Error("unexpected empty result");
  });

  bench("getCurrentShift (explicit date, default tz)", () => {
    const s = getCurrentShift(FIXED_INSTANT);
    if (!s) throw new Error("unexpected empty result");
  });
});

describe("utils/getOperationalToday (per request)", () => {
  bench("getOperationalToday (default tz)", () => {
    const s = getOperationalToday();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error("unexpected format");
  });
});

describe("utils/formatDate (no production callers — comparison point)", () => {
  bench("formatDate (plain, local)", () => {
    const s = formatDate("2026-09-17");
    if (!s) throw new Error("unexpected empty result");
  });

  bench("formatDate (Africa/Johannesburg)", () => {
    const s = formatDate("2026-09-17", "Africa/Johannesburg");
    if (!s) throw new Error("unexpected empty result");
  });
});
