import { APIError } from '@/lib/errors/error-classes';

const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^::1$/,
  /^0\.0\.0\.0$/,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./,
  /\.internal$/i,
  /\.local$/i,
];

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
  if (PRIVATE_HOST_PATTERNS.some((re) => re.test(host))) {
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
