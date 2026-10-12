import { createHmac } from 'node:crypto';
import { AppError } from '@repo/errors';

/**
 * Encodes a JSON payload object into a base64url string.
 */
function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

/**
 * Creates a signed JWT token using HMAC-SHA256 for Metabase embedding.
 */
function createMetabaseToken(
  dashboardId: number,
  params: Record<string, unknown>,
  secret: string
): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    resource: { dashboard: dashboardId },
    params,
    iat: now,
    exp: now + 60 * 10, // 10 minutes expiration
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const dataToSign = `${encodedHeader}.${encodedPayload}`;

  const signature = createHmac('sha256', secret)
    .update(dataToSign)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${dataToSign}.${signature}`;
}

export function getMetabaseEmbedUrl(dashboardId: number, departmentId?: string): string {
  const secret = process.env.METABASE_SECRET_KEY || 'dev_metabase_secret_key_change_in_prod';

  if (!process.env.METABASE_SECRET_KEY && process.env.NODE_ENV === 'production') {
    throw new AppError('Metabase secret key is missing', 'CONFIG_ERROR');
  }

  const siteUrl = process.env.NEXT_PUBLIC_METABASE_SITE_URL || 'http://localhost:3000/metabase';

  const params: Record<string, unknown> = {};
  if (departmentId) {
    params.department_id = departmentId;
  }

  const token = createMetabaseToken(dashboardId, params, secret);
  return `${siteUrl}/embed/dashboard/${token}#bordered=true&titled=true`;
}
