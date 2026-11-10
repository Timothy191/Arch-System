import {
  formatServerTimingSummary,
  parseServerTimingHeader,
} from '@/lib/observability/server-timing-client';

describe('server-timing-client', () => {
  it('parses single and multi-metric W3C Server-Timing headers', () => {
    const metrics = parseServerTimingHeader(
      'scada_probe;dur=1.42;desc="SCADA Status", total;dur=2.18;desc="Total Handler"'
    );

    expect(metrics).toEqual([
      { name: 'scada_probe', durationMs: 1.42, description: 'SCADA Status' },
      { name: 'total', durationMs: 2.18, description: 'Total Handler' },
    ]);
    expect(formatServerTimingSummary(metrics)).toBe('2.2ms');
  });

  it('falls back to the first timed metric when total is absent', () => {
    const metrics = parseServerTimingHeader('redis_ping;dur=0.84;desc="Redis L2"');
    expect(formatServerTimingSummary(metrics)).toBe('0.8ms');
  });

  it('returns empty array and null summary for missing or duration-less headers', () => {
    expect(parseServerTimingHeader(null)).toEqual([]);
    expect(parseServerTimingHeader('')).toEqual([]);
    expect(formatServerTimingSummary(parseServerTimingHeader('cache_hit;desc="L1"'))).toBeNull();
  });
});
