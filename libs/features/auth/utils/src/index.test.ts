import { isInternalRedirect, isValidPageRedirect } from './index';

describe('auth redirect utilities', () => {
  describe('isInternalRedirect', () => {
    it('should return true for root and valid internal application paths', () => {
      expect(isInternalRedirect('/')).toBe(true);
      expect(isInternalRedirect('/hub')).toBe(true);
      expect(isInternalRedirect('/control-room/dashboard')).toBe(true);
      expect(isInternalRedirect('/drilling/operations?shift=night&rig=rig-04')).toBe(true);
    });

    it('should return false for empty strings and relative paths without a leading slash', () => {
      expect(isInternalRedirect('')).toBe(false);
      expect(isInternalRedirect('hub')).toBe(false);
      expect(isInternalRedirect('drilling/operations')).toBe(false);
    });

    it('should return false for absolute external URLs and dangerous URI schemes', () => {
      expect(isInternalRedirect('https://malicious.example.com/hub')).toBe(false);
      expect(isInternalRedirect('http://malicious.example.com')).toBe(false);
      expect(isInternalRedirect('javascript:alert(1)')).toBe(false);
      expect(isInternalRedirect('data:text/html,<script>alert(1)</script>')).toBe(false);
    });

    it('should return false for protocol-relative and backslash open-redirect bypass paths', () => {
      expect(isInternalRedirect('//malicious.example.com')).toBe(false);
      expect(isInternalRedirect('///malicious.example.com/path')).toBe(false);
      expect(isInternalRedirect('/\\malicious.example.com')).toBe(false);
      expect(isInternalRedirect('/\\')).toBe(false);
    });
  });

  describe('isValidPageRedirect', () => {
    it('should allow valid internal application page routes', () => {
      expect(isValidPageRedirect('/')).toBe(true);
      expect(isValidPageRedirect('/hub')).toBe(true);
      expect(isValidPageRedirect('/access-control')).toBe(true);
      expect(isValidPageRedirect('/drilling/daily-log?date=2026-11-19')).toBe(true);
      expect(isValidPageRedirect('/reports/v1.6/summary')).toBe(true);
    });

    it('should reject non-internal redirect targets', () => {
      expect(isValidPageRedirect('')).toBe(false);
      expect(isValidPageRedirect('https://evil.example.com')).toBe(false);
      expect(isValidPageRedirect('//evil.example.com/login')).toBe(false);
      expect(isValidPageRedirect('/\\evil.example.com')).toBe(false);
    });

    it('should reject static asset and metadata file paths', () => {
      const disallowedAssetPaths: readonly string[] = [
        '/manifest.json',
        '/favicon.ico',
        '/images/logo.png',
        '/images/banner.jpg',
        '/images/photo.jpeg',
        '/images/hero.webp',
        '/images/hero.avif',
        '/icons/arch.svg',
        '/sitemap.xml',
        '/robots.txt',
        '/site.webmanifest',
        '/_next/static/styles.css',
        '/_next/static/chunk.js',
        '/fonts/anurati.woff',
        '/fonts/anurati.woff2',
      ];

      for (const assetPath of disallowedAssetPaths) {
        expect(isValidPageRedirect(assetPath)).toBe(false);
      }
    });
  });
});
