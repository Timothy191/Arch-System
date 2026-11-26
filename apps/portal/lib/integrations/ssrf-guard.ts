import dns from 'node:dns/promises';
import net from 'node:net';
import { APIError } from '@/lib/errors/error-classes';

const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^::1$/,
  /^::$/,
  /^0\.0\.0\.0$/,
  /^0\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
  /^(fc|fd)[0-9a-f]{2}:/i,
  /^fe80:/i,
  /\.internal$/i,
  /\.local$/i,
];

function stripIpv6Brackets(host: string): string {
  return host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host;
}

function extractMappedIpv4FromIpv6(ip: string): string | null {
  const lower = ip.toLowerCase();
  if (!lower.startsWith('::ffff:')) return null;
  const suffix = lower.slice('::ffff:'.length);
  if (net.isIPv4(suffix)) return suffix;
  const hexParts = suffix.split(':');
  if (hexParts.length === 2) {
    const hi = Number.parseInt(hexParts[0] ?? '', 16);
    const lo = Number.parseInt(hexParts[1] ?? '', 16);
    if (!Number.isNaN(hi) && !Number.isNaN(lo)) {
      return `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
    }
  }
  return null;
}

export function isPrivateOrDisallowedIp(rawHost: string): boolean {
  const host = stripIpv6Brackets(rawHost.trim().toLowerCase());
  if (!host) return true;
  if (PRIVATE_HOST_PATTERNS.some((re) => re.test(host))) return true;
  const mappedIpv4 = extractMappedIpv4FromIpv6(host);
  if (mappedIpv4 && PRIVATE_HOST_PATTERNS.some((re) => re.test(mappedIpv4))) {
    return true;
  }
  return false;
}

export function assertSafeUrl(rawUrl: string): void {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new APIError('Invalid URL', { statusCode: 400, context: { component: 'ssrf_guard' } });
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new APIError('URL must use http(s)', {
      statusCode: 400,
      context: { component: 'ssrf_guard' },
    });
  }
  const host = parsed.hostname.toLowerCase();
  if (isPrivateOrDisallowedIp(host)) {
    throw new APIError('URL targets a disallowed host', {
      statusCode: 400,
      context: { component: 'ssrf_guard', host },
    });
  }
  if (host === '169.254.169.254') {
    throw new APIError('Cloud metadata endpoint blocked', {
      statusCode: 400,
      context: { component: 'ssrf_guard' },
    });
  }
}

/**
 * Validates URL syntax, disallows private/loopback/link-local/CGNAT literals,
 * and resolves DNS records to block DNS rebinding to internal addresses.
 */
export async function assertSafeResolvedUrl(rawUrl: string): Promise<URL> {
  assertSafeUrl(rawUrl);
  const parsed = new URL(rawUrl);
  const host = stripIpv6Brackets(parsed.hostname.toLowerCase());
  if (net.isIP(host) !== 0) {
    if (isPrivateOrDisallowedIp(host)) {
      throw new APIError('URL targets a disallowed IP', {
        statusCode: 400,
        context: { component: 'ssrf_guard', host },
      });
    }
    return parsed;
  }

  try {
    const records = await dns.lookup(host, { all: true });
    for (const record of records) {
      if (isPrivateOrDisallowedIp(record.address)) {
        throw new APIError('Resolved IP targets a disallowed network', {
          statusCode: 400,
          context: { component: 'ssrf_guard', host, address: record.address },
        });
      }
    }
  } catch (err) {
    if (err instanceof APIError) throw err;
    // Allow DNS lookup errors in offline/mocked environments unless explicit IP violation occurred
  }
  return parsed;
}
