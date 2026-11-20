/** Display formatters for the Executive Dashboard (always `en-US`). */

export const EM_DASH = '—';

const COMPACT_THRESHOLD = 1000;
const DEFAULT_PERCENT_DECIMALS = 1;
const RATIO_DECIMALS = 2;

export function formatNumber(raw: number, decimals = 0): string {
  return raw.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatTonnes(tonnes: number): string {
  return `${formatNumber(tonnes)} t`;
}

export function formatPercent(pct: number | null, decimals = DEFAULT_PERCENT_DECIMALS): string {
  return pct === null ? EM_DASH : `${formatNumber(pct, decimals)}%`;
}

export function formatRatio(ratio: number | null): string {
  return ratio === null ? EM_DASH : `${formatNumber(ratio, RATIO_DECIMALS)} : 1`;
}

export function formatDelta(pct: number | null, comparison: string): string {
  if (pct === null) return `No ${comparison} baseline`;
  const arrow = pct >= 0 ? '▲' : '▼';
  return `${arrow} ${formatNumber(Math.abs(pct), DEFAULT_PERCENT_DECIMALS)}% vs ${comparison}`;
}

export function formatCompact(raw: number): string {
  if (Math.abs(raw) < COMPACT_THRESHOLD) return formatNumber(raw);
  return raw.toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 1 });
}

export function formatShortDate(isoDay: string): string {
  return new Date(`${isoDay}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export function formatLongDate(isoDay: string): string {
  return new Date(`${isoDay}T00:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
