/**
 * @jest-environment node
 */

import { assertSafeUrl } from './ssrf-guard';

describe('ssrf-guard assertSafeUrl', () => {
  it('allows public https endpoints', () => {
    expect(() => assertSafeUrl('https://mcp.sentry.dev/mcp')).not.toThrow();
    expect(() => assertSafeUrl('https://mcp.grafana.com/mcp')).not.toThrow();
  });

  it('blocks loopback, RFC1918 private IPs, and cloud metadata', () => {
    expect(() => assertSafeUrl('http://localhost:3000/mcp')).toThrow();
    expect(() => assertSafeUrl('http://127.0.0.1:8080/mcp')).toThrow();
    expect(() => assertSafeUrl('http://10.0.0.5/mcp')).toThrow();
    expect(() => assertSafeUrl('http://192.168.1.10/mcp')).toThrow();
    expect(() => assertSafeUrl('http://172.16.0.1/mcp')).toThrow();
    expect(() => assertSafeUrl('http://169.254.169.254/latest/meta-data/')).toThrow();
    expect(() => assertSafeUrl('http://service.internal/mcp')).toThrow();
  });

  it('blocks non-http protocols and malformed URLs', () => {
    expect(() => assertSafeUrl('file:///etc/passwd')).toThrow();
    expect(() => assertSafeUrl('not-a-url')).toThrow();
  });
});
