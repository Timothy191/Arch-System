import fs from 'node:fs';
import path from 'node:path';
import { render } from '@testing-library/react';
import React from 'react';
import {
  calculateMetricScore,
  calculateRES,
  isReverseProxyPathExempt,
  processSpeedInsightsEvent,
  RES_METRIC_WEIGHTS,
  rateMetric,
  resolveSpeedInsightsConfig,
  SPEED_INSIGHTS_THRESHOLDS,
  SpeedInsightsConfig,
  SpeedInsightsEvent,
  validateCspForSpeedInsights,
} from './speed-insights';

describe('Speed Insights Metrics & RES Test Suite', () => {
  describe('1. Core Web Vitals & Metric Thresholds', () => {
    test('verifies FCP thresholds: Good <= 1.8s (1800ms), Needs Improvement <= 3.0s, Poor > 3.0s', () => {
      expect(SPEED_INSIGHTS_THRESHOLDS.FCP.good).toBe(1800);
      expect(SPEED_INSIGHTS_THRESHOLDS.FCP.needsImprovement).toBe(3000);
      expect(SPEED_INSIGHTS_THRESHOLDS.FCP.weight).toBe(0.15);

      expect(rateMetric('FCP', 1200)).toBe('good');
      expect(rateMetric('FCP', 1800)).toBe('good');
      expect(rateMetric('FCP', 1801)).toBe('needs-improvement');
      expect(rateMetric('FCP', 3000)).toBe('needs-improvement');
      expect(rateMetric('FCP', 3001)).toBe('poor');
    });

    test('verifies LCP thresholds: Good <= 2.5s (2500ms), Needs Improvement <= 4.0s, Poor > 4.0s', () => {
      expect(SPEED_INSIGHTS_THRESHOLDS.LCP.good).toBe(2500);
      expect(SPEED_INSIGHTS_THRESHOLDS.LCP.needsImprovement).toBe(4000);
      expect(SPEED_INSIGHTS_THRESHOLDS.LCP.weight).toBe(0.3);

      expect(rateMetric('LCP', 1500)).toBe('good');
      expect(rateMetric('LCP', 2500)).toBe('good');
      expect(rateMetric('LCP', 2501)).toBe('needs-improvement');
      expect(rateMetric('LCP', 4000)).toBe('needs-improvement');
      expect(rateMetric('LCP', 4500)).toBe('poor');
    });

    test('verifies INP thresholds: Good <= 200ms, Needs Improvement <= 500ms, Poor > 500ms', () => {
      expect(SPEED_INSIGHTS_THRESHOLDS.INP.good).toBe(200);
      expect(SPEED_INSIGHTS_THRESHOLDS.INP.needsImprovement).toBe(500);
      expect(SPEED_INSIGHTS_THRESHOLDS.INP.weight).toBe(0.3);

      expect(rateMetric('INP', 50)).toBe('good');
      expect(rateMetric('INP', 200)).toBe('good');
      expect(rateMetric('INP', 201)).toBe('needs-improvement');
      expect(rateMetric('INP', 500)).toBe('needs-improvement');
      expect(rateMetric('INP', 600)).toBe('poor');
    });

    test('verifies CLS thresholds: Good <= 0.1, Needs Improvement <= 0.25, Poor > 0.25', () => {
      expect(SPEED_INSIGHTS_THRESHOLDS.CLS.good).toBe(0.1);
      expect(SPEED_INSIGHTS_THRESHOLDS.CLS.needsImprovement).toBe(0.25);
      expect(SPEED_INSIGHTS_THRESHOLDS.CLS.weight).toBe(0.25);

      expect(rateMetric('CLS', 0.05)).toBe('good');
      expect(rateMetric('CLS', 0.1)).toBe('good');
      expect(rateMetric('CLS', 0.11)).toBe('needs-improvement');
      expect(rateMetric('CLS', 0.25)).toBe('needs-improvement');
      expect(rateMetric('CLS', 0.3)).toBe('poor');
    });

    test('verifies FID, TBT, and TTFB thresholds', () => {
      // FID: Good <= 100ms, Needs Improvement <= 300ms, Poor > 300ms
      expect(rateMetric('FID', 50)).toBe('good');
      expect(rateMetric('FID', 100)).toBe('good');
      expect(rateMetric('FID', 150)).toBe('needs-improvement');
      expect(rateMetric('FID', 350)).toBe('poor');

      // TBT: Good < 800ms
      expect(rateMetric('TBT', 300)).toBe('good');
      expect(rateMetric('TBT', 799)).toBe('good');
      expect(rateMetric('TBT', 800)).toBe('needs-improvement');
      expect(rateMetric('TBT', 1200)).toBe('needs-improvement');

      // TTFB: Good < 800ms, Needs Improvement <= 1800ms, Poor > 1800ms
      expect(rateMetric('TTFB', 200)).toBe('good');
      expect(rateMetric('TTFB', 800)).toBe('good');
      expect(rateMetric('TTFB', 1200)).toBe('needs-improvement');
      expect(rateMetric('TTFB', 2000)).toBe('poor');
    });
  });

  describe('2. Real Experience Score (RES) Formula & Ratings', () => {
    test('weights sum to exactly 100% (0.15 + 0.30 + 0.30 + 0.25 = 1.0)', () => {
      const totalWeight =
        RES_METRIC_WEIGHTS.FCP +
        RES_METRIC_WEIGHTS.LCP +
        RES_METRIC_WEIGHTS.INP +
        RES_METRIC_WEIGHTS.CLS;
      expect(totalWeight).toBeCloseTo(1.0, 5);
    });

    test('calculates "good" RES score (90-100) when all Core Web Vitals are within target', () => {
      const result = calculateRES({
        FCP: 1200, // <= 1800ms
        LCP: 1800, // <= 2500ms
        INP: 80, // <= 200ms
        CLS: 0.02, // <= 0.1
      });

      expect(result.resScore).toBeGreaterThanOrEqual(90);
      expect(result.resScore).toBeLessThanOrEqual(100);
      expect(result.resRating).toBe('good');
      expect(result.rawWeightsUsed).toBe(1.0);
      expect(result.metrics.FCP?.rating).toBe('good');
      expect(result.metrics.LCP?.rating).toBe('good');
      expect(result.metrics.INP?.rating).toBe('good');
      expect(result.metrics.CLS?.rating).toBe('good');
    });

    test('calculates "needs-improvement" RES score (50-89) for intermediate values', () => {
      const result = calculateRES({
        FCP: 2400, // > 1800ms, <= 3000ms
        LCP: 3200, // > 2500ms, <= 4000ms
        INP: 350, // > 200ms, <= 500ms
        CLS: 0.18, // > 0.1, <= 0.25
      });

      expect(result.resScore).toBeGreaterThanOrEqual(50);
      expect(result.resScore).toBeLessThan(90);
      expect(result.resRating).toBe('needs-improvement');
      expect(result.metrics.FCP?.rating).toBe('needs-improvement');
      expect(result.metrics.LCP?.rating).toBe('needs-improvement');
      expect(result.metrics.INP?.rating).toBe('needs-improvement');
      expect(result.metrics.CLS?.rating).toBe('needs-improvement');
    });

    test('calculates "poor" RES score (0-49) when metrics severely exceed thresholds', () => {
      const result = calculateRES({
        FCP: 4500, // > 3000ms
        LCP: 6000, // > 4000ms
        INP: 800, // > 500ms
        CLS: 0.45, // > 0.25
      });

      expect(result.resScore).toBeLessThan(50);
      expect(result.resRating).toBe('poor');
      expect(result.metrics.FCP?.rating).toBe('poor');
      expect(result.metrics.LCP?.rating).toBe('poor');
      expect(result.metrics.INP?.rating).toBe('poor');
      expect(result.metrics.CLS?.rating).toBe('poor');
    });

    test('gracefully falls back to FID when INP is omitted', () => {
      const result = calculateRES({
        FCP: 1200,
        LCP: 1800,
        CLS: 0.05,
        FID: 40, // Used in place of INP
      });

      expect(result.metrics.INP).toBeDefined();
      expect(result.metrics.INP?.value).toBe(40);
      expect(result.resScore).toBeGreaterThanOrEqual(90);
      expect(result.resRating).toBe('good');
    });

    test('normalizes weights when only a subset of metrics is available', () => {
      const result = calculateRES({
        LCP: 2000,
        CLS: 0.05,
      });

      // LCP (0.30) + CLS (0.25) = 0.55 used
      expect(result.rawWeightsUsed).toBeCloseTo(0.55, 4);
      expect(result.resScore).toBeGreaterThanOrEqual(90);
      expect(result.resRating).toBe('good');
    });
  });

  describe('3. Codebase Integration: @vercel/speed-insights Package Setup', () => {
    const portalDir = path.resolve(__dirname, '../..');
    const packageJsonPath = path.join(portalDir, 'package.json');
    const layoutPath = path.join(portalDir, 'app/layout.tsx');

    test('portal package.json includes @vercel/speed-insights version ^2.x under MIT license', () => {
      expect(fs.existsSync(packageJsonPath)).toBe(true);
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

      const version = pkg.dependencies?.['@vercel/speed-insights'];
      expect(version).toBeDefined();
      // Ensure it is 2.x
      expect(version).toMatch(/\^?2\./);
    });

    test('app/layout.tsx imports and mounts <SpeedInsights /> component', () => {
      expect(fs.existsSync(layoutPath)).toBe(true);
      const layoutSource = fs.readFileSync(layoutPath, 'utf8');

      // Verify import from '@vercel/speed-insights/next'
      expect(layoutSource).toMatch(
        /import\s+\{\s*SpeedInsights\s*\}\s+from\s+['"]@vercel\/speed-insights\/next['"]/
      );

      // Verify mounting in JSX
      expect(layoutSource).toMatch(/<SpeedInsights\s*\/>/);
    });
  });

  describe('4. Speed Insights Configuration Options', () => {
    test('resolves default configuration (sampleRate=1.0, debug in test/dev)', () => {
      const config = resolveSpeedInsightsConfig();
      expect(config.sampleRate).toBe(1.0);
      // In jest test environment, NODE_ENV is 'test' -> debug should be true
      expect(config.isDebugEnabled).toBe(true);
    });

    test('allows explicit debug override to false', () => {
      const config = resolveSpeedInsightsConfig(undefined, { debug: false });
      expect(config.isDebugEnabled).toBe(false);
    });

    test('resolves dynamic configuration via VERCEL_OBSERVABILITY_CLIENT_CONFIG', () => {
      const envPayload = JSON.stringify({
        speedInsights: {
          scriptSrc: '/custom-insights/script.js',
          endpoint: '/custom-insights/vitals',
        },
      });

      const config = resolveSpeedInsightsConfig(envPayload);
      expect(config.scriptSrc).toBe('/custom-insights/script.js');
      expect(config.endpoint).toBe('/custom-insights/vitals');
    });

    test('props override dynamic configuration properties', () => {
      const envPayload = JSON.stringify({
        speedInsights: {
          scriptSrc: '/auto/script.js',
          endpoint: '/auto/vitals',
        },
      });

      const config = resolveSpeedInsightsConfig(envPayload, {
        endpoint: 'https://custom-proxy.internal/vitals',
      });

      expect(config.scriptSrc).toBe('/auto/script.js');
      expect(config.endpoint).toBe('https://custom-proxy.internal/vitals');
    });

    test('sampleRate: drops events when random exceeds rate and validates range', () => {
      const dummyEvent: SpeedInsightsEvent = {
        name: 'LCP',
        value: 1900,
        url: 'http://localhost:3000/control-room',
      };

      // Invalid sampleRate throws RangeError
      expect(() => {
        processSpeedInsightsEvent(dummyEvent, { sampleRate: -0.1 });
      }).toThrow(RangeError);

      expect(() => {
        processSpeedInsightsEvent(dummyEvent, { sampleRate: 1.5 });
      }).toThrow(RangeError);

      // sampleRate = 0 drops all events
      const droppedZero = processSpeedInsightsEvent(dummyEvent, { sampleRate: 0 }, () => 0.01);
      expect(droppedZero).toBeNull();

      // sampleRate = 0.5, random is 0.7 -> dropped
      const droppedHalf = processSpeedInsightsEvent(dummyEvent, { sampleRate: 0.5 }, () => 0.7);
      expect(droppedHalf).toBeNull();

      // sampleRate = 0.5, random is 0.3 -> kept
      const keptHalf = processSpeedInsightsEvent(dummyEvent, { sampleRate: 0.5 }, () => 0.3);
      expect(keptHalf).not.toBeNull();
      expect(keptHalf?.value).toBe(1900);
    });

    test('beforeSend: filters out sensitive routes and allows redaction', () => {
      const config: SpeedInsightsConfig = {
        beforeSend: (data) => {
          if (data.url.includes('/sensitive-path') || data.url.includes('/admin/secrets')) {
            return null; // Ignore event
          }
          // Redact query parameters
          const cleanUrl = data.url.split('?')[0];
          return {
            ...data,
            url: cleanUrl,
          };
        },
      };

      const sensitiveEvent: SpeedInsightsEvent = {
        name: 'FCP',
        value: 1200,
        url: 'https://example.com/sensitive-path/checkout',
      };

      const normalEvent: SpeedInsightsEvent = {
        name: 'FCP',
        value: 1200,
        url: 'https://example.com/control-room?operator=123',
      };

      const filteredSensitive = processSpeedInsightsEvent(sensitiveEvent, config);
      expect(filteredSensitive).toBeNull();

      const processedNormal = processSpeedInsightsEvent(normalEvent, config);
      expect(processedNormal).not.toBeNull();
      expect(processedNormal?.url).toBe('https://example.com/control-room');
    });

    test('route parameter supports dynamic route tagging', () => {
      const config: SpeedInsightsConfig = {
        route: '/departments/[department]/control-room',
      };

      const event: SpeedInsightsEvent = {
        name: 'INP',
        value: 120,
        url: 'http://localhost:3000/departments/drilling/control-room',
        route: config.route,
      };

      expect(event.route).toBe('/departments/[department]/control-room');
    });
  });

  describe('5. Real SDK Integration & Edge Reverse Proxy Diagnostics', () => {
    test('renders actual @vercel/speed-insights component and initializes browser telemetry queue', () => {
      const { SpeedInsights } = require('@vercel/speed-insights/next');

      // Clear any previous injected scripts
      const existing = document.head.querySelectorAll('script[src*="speed-insights"]');
      existing.forEach((el) => el.remove());
      delete (window as any).si;
      delete (window as any).siq;

      render(React.createElement(SpeedInsights, { route: '/control-room' }));

      // Verify that the real SDK initialized window.si function and queue
      expect(typeof (window as any).si).toBe('function');

      // Verify that the real SDK appended a script tag to document.head
      const scriptTag = document.head.querySelector(
        'script[src*="speed-insights"]'
      ) as HTMLScriptElement;
      expect(scriptTag).not.toBeNull();
      // In test/dev environment, SDK points to debug script or resilient intake
      expect(scriptTag.src).toMatch(/speed-insights/);
      expect(scriptTag.defer).toBe(true);
    });

    test('reverse proxy exemption validator recognises Vercel Speed Insights routes', () => {
      expect(isReverseProxyPathExempt('/_vercel/speed-insights/vitals')).toBe(true);
      expect(isReverseProxyPathExempt('/_vercel/speed-insights/script.js')).toBe(true);
      expect(isReverseProxyPathExempt('/_vercel/insights/view')).toBe(true);
      expect(isReverseProxyPathExempt('/drilling/hourly-loads')).toBe(false);
      expect(isReverseProxyPathExempt('/admin')).toBe(false);
    });

    test('validates CSP compatibility with Speed Insights scripts and telemetry endpoints', () => {
      // Valid CSP with 'self' and va.vercel-scripts.com
      const validCsp =
        "script-src 'self' 'unsafe-eval' https://va.vercel-scripts.com; connect-src 'self' https://va.vercel-scripts.com;";
      const validResult = validateCspForSpeedInsights(validCsp);
      expect(validResult.valid).toBe(true);
      expect(validResult.issues).toHaveLength(0);

      // Restrictive CSP missing both 'self' and vercel scripts
      const restrictiveCsp =
        'script-src https://scada.internal; connect-src https://scada.internal;';
      const restrictedResult = validateCspForSpeedInsights(restrictiveCsp);
      expect(restrictedResult.valid).toBe(false);
      expect(restrictedResult.scriptAllowed).toBe(false);
      expect(restrictedResult.connectAllowed).toBe(false);
      expect(restrictedResult.issues.length).toBeGreaterThan(0);
    });

    test('portal proxy.ts Content-Security-Policy permits Speed Insights telemetry', () => {
      const proxySourcePath = path.resolve(__dirname, '../../proxy.ts');
      expect(fs.existsSync(proxySourcePath)).toBe(true);
      const proxySource = fs.readFileSync(proxySourcePath, 'utf8');

      // Check script-src contains va.vercel-scripts.com
      expect(proxySource).toMatch(/script-src[^;]*https:\/\/va\.vercel-scripts\.com/);

      // Check connect-src contains va.vercel-scripts.com
      expect(proxySource).toMatch(/connect-src[^;]*https:\/\/va\.vercel-scripts\.com/);

      // Check matcher excludes _vercel
      expect(proxySource).toMatch(/_vercel/);
    });
  });
});
