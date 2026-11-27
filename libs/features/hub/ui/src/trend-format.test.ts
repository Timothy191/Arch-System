import {
  buildTrendSummary,
  formatCompactNumber,
  formatTrendDelta,
  isTimeSeriesTrend,
  MIN_TREND_POINTS,
} from './trend-format';

describe('trend-format', () => {
  describe('formatTrendDelta', () => {
    it('expresses huge rises from a small base as a multiplier instead of "+3400.0%"', () => {
      expect(formatTrendDelta(18, 630)).toEqual({
        direction: 'up',
        deltaLabel: '▲ 35×',
        deltaSpoken: 'up 35 times',
      });
      expect(formatTrendDelta(2, 2500).deltaLabel).toBe('▲ 1,250×');
    });

    it('uses one decimal below 10% and whole percents above', () => {
      expect(formatTrendDelta(100, 104.2).deltaLabel).toBe('▲ 4.2%');
      expect(formatTrendDelta(10, 25).deltaLabel).toBe('▲ 150%');
      expect(formatTrendDelta(78, 86).deltaLabel).toBe('▲ 10%');
      expect(formatTrendDelta(100, 88)).toEqual({
        direction: 'down',
        deltaLabel: '▼ 12%',
        deltaSpoken: 'down 12%',
      });
    });

    it('falls back to an absolute delta when the baseline is zero', () => {
      expect(formatTrendDelta(0, 42)).toEqual({
        direction: 'up',
        deltaLabel: '+42',
        deltaSpoken: 'up 42',
      });
      expect(formatTrendDelta(0, -1500).deltaLabel).toBe('−1.5K');
    });

    it('treats unchanged or sub-0.5% moves as flat', () => {
      expect(formatTrendDelta(5, 5).deltaLabel).toBe('Flat');
      expect(formatTrendDelta(0, 0).direction).toBe('flat');
      expect(formatTrendDelta(1000, 1004).direction).toBe('flat');
    });

    it('caps rises from a negative base at >999% instead of a multiplier', () => {
      expect(formatTrendDelta(-1, 20).deltaLabel).toBe('▲ >999%');
    });
  });

  it('formats compact numbers for low/high/now labels', () => {
    expect(formatCompactNumber(48200)).toBe('48.2K');
    expect(formatCompactNumber(9)).toBe('9');
    expect(formatCompactNumber(Number.NaN)).toBe('—');
  });

  it('only treats arrays with enough finite points as a time series', () => {
    expect(MIN_TREND_POINTS).toBe(5);
    expect(isTimeSeriesTrend([18, 13, 9, 630])).toBe(false);
    expect(isTimeSeriesTrend(undefined)).toBe(false);
    expect(isTimeSeriesTrend([1, 2, 3, Number.NaN, 5])).toBe(false);
    expect(isTimeSeriesTrend([1, 2, 3, 4, 5])).toBe(true);
  });

  it('builds a summary with an accessible description', () => {
    const summary = buildTrendSummary([42500, 43800, 44600, 48200, 47500], 'Production');
    expect(summary).toMatchObject({
      direction: 'up',
      deltaLabel: '▲ 12%',
      lowLabel: '42.5K',
      highLabel: '48.2K',
      latestLabel: '47.5K',
    });
    expect(summary.ariaLabel).toBe(
      'Production 24-hour trend: up 12%, now 47.5K, low 42.5K, high 48.2K'
    );
  });
});
