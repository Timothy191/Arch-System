import type { NextResponse } from 'next/server';

const ALLOWED_METHODS = 'GET, POST, PUT, DELETE, PATCH, OPTIONS';
const ALLOWED_HEADERS =
  'Content-Type, Authorization, x-scanner-token, x-scanner-source, x-device-id, apikey, x-client-info';
const DEV_LOCALHOST_ORIGIN_REGEX = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;

function normalizeOriginCandidate(rawCandidate: string | undefined): string | null {
  if (!rawCandidate) return null;
  const trimmed = rawCandidate.trim();
  if (!trimmed) return null;

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    return new URL(withProtocol).origin;
  } catch {
    return null;
  }
}

function buildConfiguredOrigins(): Set<string> {
  const allowedOrigins = new Set<string>();
  const envCandidates = [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.VERCEL_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_BRANCH_URL,
  ];

  for (const candidate of envCandidates) {
    const normalized = normalizeOriginCandidate(candidate);
    if (normalized) {
      allowedOrigins.add(normalized);
    }
  }

  const extraOrigins = process.env.CORS_ALLOWED_ORIGINS;
  if (extraOrigins) {
    for (const part of extraOrigins.split(',')) {
      const normalized = normalizeOriginCandidate(part);
      if (normalized) {
        allowedOrigins.add(normalized);
      }
    }
  }

  return allowedOrigins;
}

function isOriginAllowed(originHeader: string): boolean {
  const normalizedRequestOrigin = normalizeOriginCandidate(originHeader);
  if (!normalizedRequestOrigin || normalizedRequestOrigin !== originHeader.trim()) {
    return false;
  }

  const configuredOrigins = buildConfiguredOrigins();
  if (configuredOrigins.has(normalizedRequestOrigin)) {
    return true;
  }

  if (process.env.NODE_ENV !== 'production') {
    return DEV_LOCALHOST_ORIGIN_REGEX.test(normalizedRequestOrigin);
  }

  return false;
}

function appendVaryOrigin(response: NextResponse): void {
  const existingVary = response.headers.get('Vary');
  if (!existingVary) {
    response.headers.set('Vary', 'Origin');
    return;
  }

  const varyParts = existingVary.split(',').map((entry) => entry.trim().toLowerCase());
  if (!varyParts.includes('origin')) {
    response.headers.set('Vary', `${existingVary}, Origin`);
  }
}

export function applyCors(request: Request, response: NextResponse): NextResponse {
  const requestOrigin = request.headers.get('origin')?.trim() ?? '';

  if (requestOrigin && isOriginAllowed(requestOrigin)) {
    response.headers.set('Access-Control-Allow-Origin', requestOrigin);
  } else {
    response.headers.delete('Access-Control-Allow-Origin');
  }

  appendVaryOrigin(response);
  response.headers.set('Access-Control-Allow-Methods', ALLOWED_METHODS);
  response.headers.set('Access-Control-Allow-Headers', ALLOWED_HEADERS);
  return response;
}
